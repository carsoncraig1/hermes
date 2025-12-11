import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { serverLog } from '@/lib/serverLogger';
import { updateMessageRecord } from '@/lib/actions/messages';
import { parseDeliveryError, getUnsubscribeReason } from '@/lib/errorParsing';

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

    // Log the webhook event for debugging
    console.log(`[Telnyx Webhook] ${event_type} - Message ID: ${telnyxMessageId}, Status: ${status}, To: ${toNumber}`);

    // Find the user by messaging profile ID
    const user = await prisma.user.findFirst({
      where: {
        telnyxMessagingProfileId: messagingProfileId
      },
      select: { 
        id: true,
        autoUnsubscribeOnFailure: true
      }
    });

    if (!user) {
      console.warn(`[Telnyx Webhook] No user found for messaging profile: ${messagingProfileId}`);
      // Still return 200 to acknowledge receipt
      return NextResponse.json({ success: true, message: 'Webhook received but user not found' });
    }

    // Update message record if it exists
    let messageRecord = null;
    if (telnyxMessageId) {
      try {
        const updateData = {
          status,
          costAmount,
          costCurrency,
          telnyxMetadata: payload
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
        
        // Get contactId from the updated message record
        messageRecord = {
          contactId: updatedMessage.contactId,
          to: updatedMessage.to,
          errorMessage: updatedMessage.errorMessage
        };
      } catch (error) {
        console.error(`[Telnyx Webhook] Error updating message record ${telnyxMessageId}:`, error);
        // Continue processing even if update fails
      }
    }

    // Handle auto-unsubscribe on delivery failures
    if (user.autoUnsubscribeOnFailure && 
        (status === 'sending_failed' || status === 'delivery_failed') &&
        messageRecord?.contactId &&
        toNumber) {
      try {
        const unsubscribeReason = getUnsubscribeReason(status, errors);
        
        if (unsubscribeReason) {
          const errorParsed = parseDeliveryError(errors);
          
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
            const logMessage = `Auto-unsubscribed contact ${toNumber} due to ${status} (${unsubscribeReason})`;
            const logMeta = {
              contactId: messageRecord.contactId,
              phone: toNumber,
              status,
              unsubscribeReason,
              errorParsed,
              messageId: telnyxMessageId
            };
            
            await serverLog(logMessage, 'warn', logMeta, user.id).catch(err => {
              console.error('Error logging auto-unsubscribe:', err);
            });
            
            console.log(`[Auto-Unsubscribe] User ${user.id}: Unsubscribed contact ${toNumber} (${messageRecord.contactId}) - Reason: ${unsubscribeReason}`);
          }
        }
      } catch (unsubscribeError) {
        console.error(`[Telnyx Webhook] Error auto-unsubscribing contact:`, unsubscribeError);
        // Continue processing even if unsubscribe fails
      }
    }

    // Log the status update to console for the user
    const logMessage = `Message ${status}: ${toNumber}${telnyxMessageId ? ` (ID: ${telnyxMessageId})` : ''}`;
    const logMeta = {
      messageId: telnyxMessageId,
      to: toNumber,
      status,
      eventType: event_type,
      cost: payload.cost,
      direction: payload.direction
    };

    await serverLog(logMessage, 'info', logMeta, user.id).catch(err => {
      console.error('Error logging webhook event:', err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing Telnyx webhook:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

