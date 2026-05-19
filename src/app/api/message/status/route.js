import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { findRecentMessageForRecipient, updateMessageRecord } from '@/lib/actions/messages';
import { trackSpamFilterEvent } from '@/lib/actions/spamTracking';
import { getUnsubscribeReason } from '@/lib/errorParsing';
import { getUserForMessagingProfile } from '@/lib/messagingProfileCache';

const DEBUG_TELNYX_WEBHOOK = process.env.DEBUG_TELNYX_WEBHOOK === 'true';

function debugWebhook(label, payload) {
  if (!DEBUG_TELNYX_WEBHOOK) return;
  try {
    console.log(`[Telnyx Webhook Debug] ${label}: ${JSON.stringify(payload)}`);
  } catch {
    console.log(`[Telnyx Webhook Debug] ${label}:`, payload);
  }
}

function hasErrorCode(errors, code) {
  if (!Array.isArray(errors)) return false;
  return errors.some((err) => String(err?.code || '') === String(code));
}

/**
 * Telnyx Webhook Handler for Message Status Updates
 * 
 * This endpoint receives delivery status updates from Telnyx for outbound messages.
 * Event types include:
 * - message.sent: Message was sent to carrier
 * - message.finalized: Message delivery was finalized (delivered, failed, etc.)
 * 
 * Webhook Payload Structure (from Telnyx docs):
 * {
 *   "data": {
 *     "record_type": "event",
 *     "id": "event_id",
 *     "event_type": "message.sent" | "message.finalized",
 *     "occurred_at": "2023-10-01T12:00:00Z",
 *     "payload": {
 *       "record_type": "message",
 *       "direction": "outbound",
 *       "id": "message_id",
 *       "type": "SMS",
 *       "messaging_profile_id": "profile_id",
 *       "from": { "phone_number": "+1234567890", ... },
 *       "to": [{ "phone_number": "+0987654321", "status": "delivered", ... }],
 *       "text": "message text",
 *       "status": "queued" | "sending" | "sent" | "delivered" | "sending_failed" | "delivery_failed" | "delivery_unconfirmed",
 *       "cost": { "amount": "0.01", "currency": "USD" },
 *       ...
 *     }
 *   },
 *   "meta": {
 *     "attempt": 1,
 *     "delivered_to": "https://your-webhook-url.com"
 *   }
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    
    // Validate webhook payload structure
    if (!body.data || !body.data.event_type || !body.data.payload) {
      console.warn('Invalid webhook payload structure:', body);
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      );
    }

    const { event_type, payload } = body.data;
    const telnyxMessageId = payload.id;
    const toNumber = payload.to?.[0]?.phone_number || payload.to?.phone_number;
    const status = payload.to?.[0]?.status || payload.status;
    const messagingProfileId = payload.messaging_profile_id;
    const costAmount = payload.cost?.amount || null;
    const costCurrency = payload.cost?.currency || 'USD';
    const sentAt = payload.sent_at || null;
    const completedAt = payload.completed_at || null;
    const errors = payload.errors || [];
    const isSpamFilter40002 = hasErrorCode(errors, '40002');

    debugWebhook('received', {
      eventType: event_type,
      telnyxMessageId,
      status,
      toNumber,
      messagingProfileId,
      sentAt,
      completedAt,
      errors,
      occurredAt: body?.data?.occurred_at,
      payloadTo: payload?.to,
      payloadStatus: payload?.status
    });

    // Only log final status (delivered or failed), not intermediate "sent" status

    // Resolve user from messaging profile id with a TTL cache to avoid hammering
    // the DB on every Telnyx webhook (legacy user.telnyxMessagingProfileId, then
    // revolver phone-number profile mapping).
    const user = await getUserForMessagingProfile(messagingProfileId);

    if (!user) {
      debugWebhook('user-not-found', { messagingProfileId, telnyxMessageId, toNumber, status });
      console.warn(`[Telnyx Webhook] No user found for messaging profile: ${messagingProfileId}`);
      // Still return 200 to acknowledge receipt
      return NextResponse.json({ success: true, message: 'Webhook received but user not found' });
    }

    debugWebhook('user-resolved', {
      userId: user.id,
      autoUnsubscribeOnFailure: user.autoUnsubscribeOnFailure,
      telnyxMessageId,
      status
    });

    // Update message record if it exists
    let messageRecord = null;
    if (telnyxMessageId) {
      try {
        const updateData = {
          status,
          // Only set costAmount for sent/delivered/unconfirmed messages (Telnyx bills for these)
          // delivery_unconfirmed messages are still billed (sent to carrier, no confirmation)
          ...(status === 'sent' || status === 'delivered' || status === 'delivery_unconfirmed' ? { costAmount, costCurrency } : { costAmount: null, costCurrency }),
          ...((status === 'sending_failed' || status === 'delivery_failed') ? { telnyxMetadata: payload } : {})
        };

        if (sentAt) updateData.sentAt = sentAt;
        if (completedAt) {
          if (status === 'delivered') {
            updateData.deliveredAt = completedAt;
          } else if (status === 'sending_failed' || status === 'delivery_failed') {
            updateData.failedAt = completedAt;
            updateData.errorMessage = errors.length > 0 
              ? errors.map(e => e.detail || e.title).join('; ')
              : 'Message delivery failed';
          }
        }

        const updatedMessage = await updateMessageRecord(telnyxMessageId, updateData);
        
        if (!updatedMessage) {
          // Message record doesn't exist - fall back to recent outbound message by recipient.
          const fallbackMessage = await findRecentMessageForRecipient(user.id, toNumber);

          if (fallbackMessage) {
            const linkedMessage = await prisma.message.update({
              where: { id: fallbackMessage.id },
              data: {
                ...updateData,
                costAmount: updateData.costAmount !== null && updateData.costAmount !== undefined
                  ? parseFloat(updateData.costAmount)
                  : null,
                telnyxMessageId
              }
            });

            messageRecord = {
              messageId: linkedMessage.id,
              contactId: linkedMessage.contactId,
              to: linkedMessage.to,
              errorMessage: linkedMessage.errorMessage,
              campaignId: linkedMessage.campaignId || null,
              text: linkedMessage.text || null
            };
            debugWebhook('message-linked-via-fallback', {
              fallbackMessageId: linkedMessage.id,
              telnyxMessageId,
              toNumber,
              status,
              contactId: linkedMessage.contactId
            });

            console.warn(
              `[Telnyx Webhook] Linked missing message by recipient fallback for telnyxMessageId: ${telnyxMessageId}`
            );
          } else {
            // Message record doesn't exist - this can happen if message was sent outside our system
            // or if the record was never created. Log a warning but continue processing.
            debugWebhook('message-not-found', { telnyxMessageId, toNumber, status });
            console.warn(`[Telnyx Webhook] Message record not found for telnyxMessageId: ${telnyxMessageId}`);
          }
        } else {
          // Fire-and-forget: lastMessageSent is best-effort and the webhook
          // response doesn't depend on it. Don't hold a pool connection while
          // the message-update transaction is already finishing.
          if (updatedMessage.contactId && (status === 'delivered' || status === 'sent' || status === 'delivery_unconfirmed' || status === 'sending')) {
            prisma.contact.update({
              where: { id: updatedMessage.contactId },
              data: { lastMessageSent: new Date() }
            }).catch((err) => {
              console.error('Error updating contact lastMessageSent:', err);
            });
          }
          
          // Get contactId from the updated message record
          messageRecord = {
            messageId: updatedMessage.id,
            contactId: updatedMessage.contactId,
            to: updatedMessage.to,
            errorMessage: updatedMessage.errorMessage,
            campaignId: updatedMessage.campaignId || null,
            text: updatedMessage.text || null
          };
          debugWebhook('message-updated', {
            telnyxMessageId,
            status,
            messageRecord
          });
        }
      } catch (error) {
        // Only log if it's not a "record not found" error (which is already handled above)
        if (error.code !== 'P2025') {
          console.error(`[Telnyx Webhook] Error updating message record ${telnyxMessageId}:`, error);
        }
        // Continue processing even if update fails
      }
    }

    if (isSpamFilter40002 && (status === 'sending_failed' || status === 'delivery_failed')) {
      const firstError = errors.find(err => String(err?.code || '') === '40002') || null;
      const toPayload = payload.to?.[0] || payload.to || {};

      // Fire-and-forget: spam tracking is observability and the response
      // doesn't depend on it. The .catch already swallows errors, so the
      // outer await was just blocking pool connections needlessly.
      trackSpamFilterEvent({
        userId: user.id,
        campaignId: messageRecord?.campaignId || null,
        messageId: messageRecord?.messageId || null,
        providerMessageId: telnyxMessageId,
        fromNumber: payload.from?.phone_number || null,
        toNumber: toNumber || null,
        carrier: toPayload?.carrier || null,
        lineType: toPayload?.line_type || null,
        errorCode: '40002',
        errorTitle: firstError?.title || null,
        errorDetail: firstError?.detail || null,
        occurredAt: body?.data?.occurred_at || completedAt || new Date().toISOString(),
        rawPayload: payload
      }).catch((error) => {
        console.error('[Telnyx Webhook] Error tracking spam filter event:', error);
      });

      debugWebhook('spam-event-tracked', {
        telnyxMessageId,
        status,
        toNumber,
        campaignId: messageRecord?.campaignId || null,
        messageId: messageRecord?.messageId || null
      });
    }

    // Handle auto-unsubscribe on delivery failures
    const autoUnsubscribeEnabled = (user.autoUnsubscribeOnFailure ?? true) === true;
    if (autoUnsubscribeEnabled &&
        (status === 'sending_failed' || status === 'delivery_failed') &&
        messageRecord?.contactId &&
        toNumber) {
      try {
        const unsubscribeReason = getUnsubscribeReason(status, errors);
        debugWebhook('unsubscribe-evaluation', {
          telnyxMessageId,
          status,
          toNumber,
          contactId: messageRecord.contactId,
          autoUnsubscribeEnabled,
          errors,
          unsubscribeReason
        });
        
        if (isSpamFilter40002) {
          console.log(`ℹ️ Skipped auto-unsubscribe for ${toNumber} due to temporary spam filter code 40002`);
          debugWebhook('unsubscribe-skipped', {
            contactId: messageRecord.contactId,
            toNumber,
            reason: 'temporary_spam_filter_40002'
          });
        } else if (unsubscribeReason) {
          // Unsubscribe the contact
          const updateResult = await prisma.contact.updateMany({
            where: {
              id: messageRecord.contactId,
              userId: user.id
            },
            data: {
              subscribed: false,
              unsubscribeReason: unsubscribeReason
            }
          });

          if (updateResult.count > 0) {
            // Simple one-line log for auto-unsubscribe (error already logged above)
            console.log(`⚠️ Auto-unsubscribed: ${toNumber} (${unsubscribeReason})`);
            debugWebhook('unsubscribe-applied', {
              contactId: messageRecord.contactId,
              toNumber,
              unsubscribeReason
            });
          }
        } else {
          console.log(`ℹ️ Delivery failure did not qualify for auto-unsubscribe: ${toNumber}`);
          debugWebhook('unsubscribe-skipped', {
            contactId: messageRecord.contactId,
            toNumber,
            reason: 'no-unsubscribe-reason'
          });
        }
      } catch (unsubscribeError) {
        console.error(`[Telnyx Webhook] Error auto-unsubscribing contact:`, unsubscribeError);
        // Continue processing even if unsubscribe fails
      }
    } else if (
      (status === 'sending_failed' || status === 'delivery_failed') &&
      !autoUnsubscribeEnabled &&
      toNumber
    ) {
      console.log(`ℹ️ Auto-unsubscribe disabled for ${toNumber} (delivery failure)`);
    }

    // Only log final status (delivered or failed) - one line per message
    // Don't use serverLog here to avoid duplicate console output
    if (event_type === 'message.finalized' && (status === 'delivered' || status === 'delivery_failed' || status === 'sending_failed')) {
      if (status === 'delivered') {
        console.log(`✅ delivered to ${toNumber}`);
      } else {
        const errorMsg = errors.length > 0 
          ? errors.map(e => e.detail || e.title).join('; ')
          : 'Message delivery failed';
        console.log(`❌ ${toNumber}: ${errorMsg}`);
      }
      debugWebhook('finalized-event-processed', {
        eventType: event_type,
        telnyxMessageId,
        toNumber,
        status,
        errors
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing Telnyx webhook:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
