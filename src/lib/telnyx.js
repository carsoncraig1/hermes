'use server';

import { Telnyx } from 'telnyx';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { validateMessage } from '@/lib/messageUtils';
import { checkRateLimit, createMessageRecord } from '@/lib/actions/messages';
import { createMessageClickCodes } from '@/lib/messageClickCodes';
import { serverLog } from '@/lib/serverLogger';
import { getPermanentUnsubscribeReason } from '@/lib/errorParsing';
import { normalizePhoneForTelnyx } from '@/lib/phoneUtils';

const OUTBOUND_SENDS_DISABLED = false;

/**
 * Bulk-send optimized Telnyx sender.
 * Performs only the Telnyx API call and returns normalized response metadata.
 */
export async function sendMessageBulkOptimized({
  telnyxClient,
  from,
  to,
  text,
  messagingProfileId,
  idempotencyKey,
}) {
  if (OUTBOUND_SENDS_DISABLED) {
    throw new Error('Outbound sends are temporarily disabled');
  }

  // SDK 2.0.0 does not surface custom headers, so call the API directly to
  // attach an Idempotency-Key. Auth field already includes the "Bearer " prefix.
  const authorization = telnyxClient?.getApiField?.('auth');
  if (!authorization) {
    throw new Error('Telnyx API key not configured');
  }

  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from,
      to: [to],
      text,
      type: 'SMS',
      messaging_profile_id: messagingProfileId,
      webhook_url: 'https://txt.cx/api/message/status',
      webhook_failover_url: '',
    }),
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const firstError = responseBody?.errors?.[0];
    const error = new Error(firstError?.detail || firstError?.title || `Telnyx API error ${response.status}`);
    error.statusCode = response.status;
    error.raw = responseBody?.errors
      ? {
          ...responseBody,
          errors: responseBody.errors.map(err => ({
            ...err,
            status: Number(err.status) || response.status,
          })),
        }
      : { errors: [{ status: response.status, title: response.statusText }] };
    throw error;
  }

  return {
    success: true,
    telnyxMessageId: responseBody.data?.id,
    initialStatus: responseBody.data?.to?.[0]?.status || responseBody.data?.status || 'queued',
    costAmount: responseBody.data?.cost?.amount || null,
    costCurrency: responseBody.data?.cost?.currency || 'USD',
    rawData: responseBody.data,
  };
}

/**
 * Get all Telnyx configuration for a user in a single query
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Telnyx configuration including client, phone, and profile
 */
export async function getTelnyxConfig(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      telnyxApiKey: true,
      telnyxPhoneNumber: true,
      telnyxMessagingProfileId: true,
    },
  });

  if (!user?.telnyxApiKey) {
    return {
      client: null,
      phoneNumber: null,
      messagingProfileId: null,
      error: 'Telnyx API key not configured'
    };
  }

  return {
    client: new Telnyx(user.telnyxApiKey),
    phoneNumber: user.telnyxPhoneNumber || null,
    messagingProfileId: user.telnyxMessagingProfileId || '400196b2-9253-4a8b-8936-6ac04b4e6bbd',
    error: null
  };
}

/**
 * @deprecated Use getTelnyxConfig instead for better performance
 * Get Telnyx client for a specific user
 */
async function getTelnyxClient(userId) {
  const config = await getTelnyxConfig(userId);
  return config.client;
}

/**
 * @deprecated Use getTelnyxConfig instead for better performance
 * Get user's Telnyx settings
 */
async function getUserTelnyxSettings(userId) {
  const config = await getTelnyxConfig(userId);
  return {
    phoneNumber: config.phoneNumber,
    messagingProfileId: config.messagingProfileId || '400196b2-9253-4a8b-8936-6ac04b4e6bbd',
  };
}

/**
 * Send an SMS message using Telnyx
 * @param {Object} params - Message parameters
 * @param {string} params.from - Sender phone number (optional, will use user's default if not provided)
 * @param {string} params.to - Recipient phone number
 * @param {string} params.text - Message text
 * @param {string} params.userId - User ID (optional, will get from session if not provided)
 * @param {number} params.contactId - Contact ID (optional)
 * @param {number} params.campaignId - Campaign ID (optional)
 * @param {Object} params.telnyxConfig - Pre-fetched Telnyx config (optional, for bulk sends)
 * @param {boolean} params.skipRateLimit - Skip rate limit check (use when already checked at batch level)
 * @param {boolean} params.skipSubscriptionCheck - Skip subscription check (use when contacts pre-filtered)
 * @returns {Promise<Object>} - Telnyx API response
 */
export async function sendMessage({
  from,
  to,
  text,
  userId = null,
  contactId = null,
  campaignId = null,
  telnyxConfig = null,
  skipRateLimit = false,
  skipSubscriptionCheck = false,
}) {
  // Declare variables in outer scope for error handling
  let finalUserId = userId;
  let validation = null;
  let messageRecord = null; // Declare in outer scope for error handling
  let messageId = null; // Declare in outer scope for error handling
  let messageTextWithCodes = text; // Declare in outer scope for error handling
  let fromNumber = null; // Declare in outer scope for error handling
  let normalizedTo = null; // Declare in outer scope for error handling
  let settings = null; // Declare in outer scope for error handling

  try {
    if (OUTBOUND_SENDS_DISABLED) {
      return {
        success: false,
        error: 'Outbound sends are temporarily disabled',
      };
    }

    // Get userId from session if not provided
    if (!finalUserId) {
      const session = await auth();
      if (!session?.user?.id) {
        return {
          success: false,
          error: 'User not authenticated',
        };
      }
      finalUserId = session.user.id;
    }

    // Validate message text
    validation = validateMessage(text);
    if (!validation.valid) {
      // Log validation failure
      await serverLog(
        `Message validation failed: ${validation.error}`,
        'warn',
        {
          textLength: text.length,
          parts: validation.parts,
          error: validation.error
        },
        finalUserId
      ).catch(err => console.error('Error logging validation failure:', err));
      
      return {
        success: false,
        error: validation.error,
        validation
      };
    }

    // Enforce subscription check if contactId is provided (skip if pre-filtered in bulk send)
    if (contactId && !skipSubscriptionCheck) {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { subscribed: true }
      });
      
      if (!contact || !contact.subscribed) {
        return {
          success: false,
          error: 'Contact is not subscribed',
        };
      }
    }

    // Check rate limits (skip if already checked at batch level in bulk sends)
    let rateLimit = null;
    if (!skipRateLimit) {
      rateLimit = await checkRateLimit(finalUserId, 1200, 30000, true);
      if (!rateLimit.allowed) {
        // Log rate limit hit
        await serverLog(
          `Rate limit exceeded: ${rateLimit.minuteCount}/${rateLimit.minuteLimit} messages/minute, ${rateLimit.hourCount}/${rateLimit.hourLimit} messages/hour`,
          'warn',
          {
            minuteCount: rateLimit.minuteCount,
            minuteLimit: rateLimit.minuteLimit,
            hourCount: rateLimit.hourCount,
            hourLimit: rateLimit.hourLimit,
            retryAfter: rateLimit.retryAfter
          },
          finalUserId
        ).catch(err => console.error('Error logging rate limit:', err));
        
        return {
          success: false,
          error: `Rate limit exceeded. ${rateLimit.minuteCount}/${rateLimit.minuteLimit} messages in the last minute, ${rateLimit.hourCount}/${rateLimit.hourLimit} in the last hour.`,
          rateLimit,
          retryAfter: rateLimit.retryAfter
        };
      }
    }

    // Get Telnyx client and settings (use pre-fetched config if provided for bulk sends)
    let telnyx;
    if (telnyxConfig) {
      // Use pre-fetched config (bulk send optimization)
      if (!telnyxConfig.client) {
        return {
          success: false,
          error: telnyxConfig.error || 'Telnyx API key not configured. Please configure it in Settings.',
        };
      }
      telnyx = telnyxConfig.client;
      settings = {
        phoneNumber: telnyxConfig.phoneNumber,
        messagingProfileId: telnyxConfig.messagingProfileId
      };
    } else {
      // Fetch config (single message sends)
      const config = await getTelnyxConfig(finalUserId);
      if (!config.client) {
        return {
          success: false,
          error: config.error || 'Telnyx API key not configured. Please configure it in Settings.',
        };
      }
      telnyx = config.client;
      settings = {
        phoneNumber: config.phoneNumber,
        messagingProfileId: config.messagingProfileId
      };
    }

    // Normalize phone numbers to E.164 format for Telnyx
    normalizedTo = normalizePhoneForTelnyx(to);
    if (!normalizedTo) {
      return {
        success: false,
        error: 'Invalid recipient phone number format.',
      };
    }

    // Use provided from number, or user's default, or fallback
    fromNumber = normalizePhoneForTelnyx(from || settings.phoneNumber || process.env.TELNYX_PHONE_NUMBER || process.env.TELNYX_FROM_NUMBER);
    
    if (!fromNumber) {
      return {
        success: false,
        error: 'No sender phone number configured. Please configure it in Settings.',
      };
    }

    // STEP 1: Create message record FIRST (before sending) so we have messageId
    // This allows us to create MessageClickCodes that reference the message
    messageTextWithCodes = text; // Will be modified with click codes
    
    try {
      messageRecord = await createMessageRecord({
        userId: finalUserId,
        telnyxMessageId: null, // Will be updated after sending
        contactId,
        campaignId,
        from: fromNumber,
        to,
        text, // Store original text
        type: 'SMS',
        parts: validation.parts,
        status: 'queued', // Will be updated after sending
        direction: 'outbound',
        costAmount: null, // Will be updated after sending
        costCurrency: 'USD',
        telnyxMetadata: null // Will be updated after sending
      });
      messageId = messageRecord.id;
    } catch (dbError) {
      console.error('Error creating message record before sending:', dbError);
      // Continue - we'll create it after sending if this fails
    }

    // STEP 2: Create MessageClickCodes for all shortlinks in the message
    // This replaces shortlink markers with code-only URLs (txt.cx/CODE)
    if (messageId && contactId) {
      try {
        const { modifiedText } = await createMessageClickCodes(
          messageId,
          text,
          contactId,
          finalUserId
        );
        messageTextWithCodes = modifiedText;
      } catch (codeError) {
        console.error('Error creating message click codes:', codeError);
        // Continue with original text if code creation fails
        messageTextWithCodes = text;
      }
    }

    // STEP 3: Build message parameters with code-embedded URLs
    // Telnyx requires 'to' to be an array of phone numbers
    const messageParams = {
      from: fromNumber,
      to: [normalizedTo], // Telnyx requires an array of phone numbers
      text: messageTextWithCodes, // Use text with click codes embedded
      type: 'SMS', // SMS or MMS
      messaging_profile_id: settings.messagingProfileId,
      // Webhook configuration - use profile webhooks if configured, otherwise use explicit webhook
      webhook_url: 'https://txt.cx/api/message/status',
      webhook_failover_url: '', // Optional failover webhook URL
      // Note: If messaging profile has webhooks configured, they will be used
      // If webhook_url is provided in request, it takes precedence
    };

    // STEP 4: Send message via Telnyx SDK
    // According to docs: telnyx.messages.create(params, callback) for Node.js
    // But we're using async/await, so we call it without callback
    const response = await telnyx.messages.create(messageParams);
    
    // Response structure from Telnyx API:
    // {
    //   data: {
    //     id: "message-id",
    //     record_type: "message",
    //     direction: "outbound",
    //     from: "+1234567890",
    //     to: [{ phone_number: "+1234567890", status: "queued" }],
    //     text: "message text",
    //     status: "queued" | "sending" | "sent" | "delivered" | etc.
    //     cost: { amount: "0.01", currency: "USD" }
    //     ...
    //   }
    // }
    
    const telnyxMessageId = response.data?.id;
    const initialStatus = response.data?.to?.[0]?.status || response.data?.status || 'queued';
    const costAmount = response.data?.cost?.amount || null;
    const costCurrency = response.data?.cost?.currency || 'USD';

    // STEP 5: Update message record with Telnyx response data
    // OPTIMIZED: Run message update and contact update in parallel
    if (messageRecord && messageId) {
      const updatePromises = [];
      
      // Update message record
      updatePromises.push(
        prisma.message.update({
          where: { id: messageId },
          data: {
            telnyxMessageId,
            status: initialStatus,
            // Only set costAmount for sent/delivered/unconfirmed messages (Telnyx bills for these)
            // delivery_unconfirmed messages are still billed (sent to carrier, no confirmation)
            costAmount: (initialStatus === 'sent' || initialStatus === 'delivered' || initialStatus === 'delivery_unconfirmed') && costAmount ? parseFloat(costAmount) : null,
            costCurrency: (initialStatus === 'sent' || initialStatus === 'delivered') ? costCurrency : 'USD',
            telnyxMetadata: response.data ? JSON.parse(JSON.stringify(response.data)) : null,
            sentAt: initialStatus === 'sent' || initialStatus === 'sending' ? new Date() : null,
            text: messageTextWithCodes // Update with code-embedded text
          }
        }).catch(err => {
          console.error('Error updating message record:', err);
        })
      );

      // Update Contact.lastMessageSent when message is successfully sent (parallel)
      if (contactId && (initialStatus === 'sent' || initialStatus === 'sending')) {
        updatePromises.push(
          prisma.contact.update({
            where: { id: contactId },
            data: { lastMessageSent: new Date() }
          }).catch(err => {
            console.error('Error updating contact lastMessageSent:', err);
          })
        );
      }
      
      // Wait for all updates in parallel
      await Promise.all(updatePromises);
    } else if (!messageRecord) {
      // If we didn't create the record before sending, create it now
      try {
        messageRecord = await createMessageRecord({
          userId: finalUserId,
          telnyxMessageId,
          contactId,
          campaignId,
          from: fromNumber,
          to,
          text: messageTextWithCodes, // Store text with codes
          type: 'SMS',
          parts: validation.parts,
          status: initialStatus,
          direction: 'outbound',
          costAmount,
          costCurrency,
          telnyxMetadata: response.data
        });
        messageId = messageRecord.id;
      } catch (dbError) {
        console.error('Error creating message record after send:', dbError);
        // Continue even if DB record creation fails - message was sent
      }
    }
    
    // Invalidate rate limit cache after successful send
    const { invalidateRateLimitCache } = await import('@/lib/rateLimitCache');
    invalidateRateLimitCache(finalUserId).catch(() => {});
    
    // Don't log here - final status will be logged by webhook handler
    
    return { 
      success: true, 
      data: response.data,
      messageId: telnyxMessageId,
      messageRecordId: messageRecord?.id,
      status: initialStatus,
      validation,
      rateLimit
    };
  } catch (error) {
    // Handle Telnyx API errors more specifically
    let errorMessage = 'Failed to send message';
    let errorDetails = null;
    
    // Try to extract error details from various possible locations in Telnyx SDK error structure
    let errorCode = null;
    if (error.raw?.errors && Array.isArray(error.raw.errors) && error.raw.errors.length > 0) {
      // Telnyx SDK error structure: error.raw.errors[0]
      const firstError = error.raw.errors[0];
      errorDetails = error.raw;
      errorMessage = firstError.detail || firstError.title || firstError.message || errorMessage;
      errorCode = firstError.code;
    } else if (error.response?.data) {
      // Alternative error response structure
      errorDetails = error.response.data;
      const firstError = error.response.data?.errors?.[0];
      errorMessage = firstError?.detail || firstError?.title || error.message || errorMessage;
      errorCode = firstError?.code;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    // Get settings again for error handling (variables might not be in scope if error occurred early)
    let errorFromNumber = null;
    let errorNormalizedTo = null;
    let errorSettings = null;
    try {
      if (finalUserId) {
        errorSettings = await getUserTelnyxSettings(finalUserId);
        const rawFromNumber = from || errorSettings.phoneNumber || process.env.TELNYX_PHONE_NUMBER || process.env.TELNYX_FROM_NUMBER;
        errorFromNumber = rawFromNumber ? normalizePhoneForTelnyx(rawFromNumber) : null;
        errorNormalizedTo = normalizePhoneForTelnyx(to) || to;
      }
    } catch (settingsError) {
      console.error('Error getting settings for error handling:', settingsError);
    }
    
    // Log the request parameters that were sent (for debugging)
    // Use error-scoped variables with fallbacks to try-catch scoped variables
    const loggedFrom = errorFromNumber || (typeof fromNumber !== 'undefined' ? fromNumber : null) || 'unknown';
    const loggedTo = errorNormalizedTo || (typeof normalizedTo !== 'undefined' ? normalizedTo : null) || to || 'unknown';
    const loggedProfileId = errorSettings?.messagingProfileId || (typeof settings !== 'undefined' ? settings?.messagingProfileId : null) || 'unknown';
    
    // Auto-unsubscribe for permanently ineligible destinations
    const unsubscribeReason = getPermanentUnsubscribeReason(
      errorDetails?.errors || error.raw?.errors || errorDetails || errorMessage
    );
    if (unsubscribeReason && contactId && finalUserId) {
      try {
        // Get user's auto-unsubscribe setting
        const user = await prisma.user.findUnique({
          where: { id: finalUserId },
          select: { autoUnsubscribeOnFailure: true }
        });

        if ((user?.autoUnsubscribeOnFailure ?? true) === true) {
          // Unsubscribe the contact
          const updateResult = await prisma.contact.updateMany({
            where: {
              id: contactId,
              userId: finalUserId
            },
            data: {
              subscribed: false,
              unsubscribeReason
            }
          });

          if (updateResult.count > 0) {
            // Simple one-line log for auto-unsubscribe (error already logged above)
            console.log(`⚠️ Auto-unsubscribed: ${loggedTo} (${unsubscribeReason})`);
          }
        } else {
          console.log(`ℹ️ Auto-unsubscribe disabled for ${loggedTo} (reason: ${unsubscribeReason})`);
        }
      } catch (unsubscribeError) {
        console.error('Error auto-unsubscribing contact on send failure:', unsubscribeError);
        // Continue processing even if unsubscribe fails
      }
    } else if (contactId && finalUserId) {
      console.log(`ℹ️ Send failure did not qualify for auto-unsubscribe: ${loggedTo}`);
    }

    // Log message send failure (simple one-line format)
    // Don't use serverLog here to avoid duplicate verbose console output
    console.log(`❌ ${loggedTo}: ${errorMessage}`);
    
    // Update existing message record to failed status, or create one if it doesn't exist
    if (finalUserId) {
      try {
        const normalizedToForError = errorNormalizedTo || normalizePhoneForTelnyx(to) || to;
        
        // If we have an existing message record (created before sending), update it
        if (messageRecord && messageId) {
          await prisma.message.update({
            where: { id: messageId },
            data: {
              status: 'sending_failed',
              failedAt: new Date(),
              errorMessage: errorMessage,
              telnyxMetadata: errorDetails || { error: errorMessage }
            }
          });
        } else {
          // If no existing record, create a new failed message record
          await createMessageRecord({
            userId: finalUserId,
            telnyxMessageId: null,
            contactId,
            campaignId,
            from: errorFromNumber || 'unknown',
            to: normalizedToForError,
            text,
            type: 'SMS',
            parts: validation?.parts || 1,
            status: 'sending_failed',
            direction: 'outbound',
            costAmount: null,
            costCurrency: 'USD',
            errorMessage: errorMessage,
            failedAt: new Date(),
            telnyxMetadata: errorDetails || { error: errorMessage }
          });
        }
      } catch (dbError) {
        console.error('Error updating/creating failed message record:', dbError);
        // Continue even if DB record creation fails
      }
    }
    
    return {
      success: false,
      error: errorMessage,
      errorDetails: errorDetails,
      // Include original error for debugging
      originalError: process.env.NODE_ENV === 'development' ? error : undefined
    };
  }
}
