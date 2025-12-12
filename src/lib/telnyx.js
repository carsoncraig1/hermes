'use server';

import { Telnyx } from 'telnyx';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { validateMessage } from '@/lib/messageUtils';
import { checkRateLimit, createMessageRecord } from '@/lib/actions/messages';
import { createMessageClickCodes } from '@/lib/messageClickCodes';

/**
 * Normalize phone number to E.164 format for Telnyx
 * Ensures phone numbers are in the format +1XXXXXXXXXX
 */
function normalizePhoneForTelnyx(phone) {
  if (!phone) return null;
  
  // If already in E.164 format, return as-is
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it has 11 digits and starts with 1, add +
  if (digits.length === 11 && digits[0] === '1') {
    return `+${digits}`;
  }
  
  // If it has 10 digits, assume US number and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it has 11 digits but doesn't start with 1, might be missing country code
  // Try adding +1 prefix
  if (digits.length === 11) {
    return `+${digits}`;
  }
  
  // Return as-is if we can't normalize (let Telnyx validate)
  return phone;
}

/**
 * Get Telnyx client for a specific user
 * @param {string} userId - User ID
 * @returns {Promise<Telnyx|null>} - Telnyx client instance or null if no API key
 */
async function getTelnyxClient(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telnyxApiKey: true },
  });

  if (!user?.telnyxApiKey) {
    return null;
  }

  return new Telnyx(user.telnyxApiKey);
}

/**
 * Get user's Telnyx settings
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - User's Telnyx settings
 */
async function getUserTelnyxSettings(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      telnyxPhoneNumber: true,
      telnyxMessagingProfileId: true,
    },
  });

  return {
    phoneNumber: user?.telnyxPhoneNumber || null,
    messagingProfileId: user?.telnyxMessagingProfileId || '400196b2-9253-4a8b-8936-6ac04b4e6bbd', // Default fallback
  };
}

/**
 * Send an SMS message using Telnyx
 * @param {Object} params - Message parameters
 * @param {string} params.from - Sender phone number (optional, will use user's default if not provided)
 * @param {string} params.to - Recipient phone number
 * @param {string} params.text - Message text
 * @param {string} params.userId - User ID (optional, will get from session if not provided)
 * @returns {Promise<Object>} - Telnyx API response
 */
export async function sendMessage({
  from,
  to,
  text,
  userId = null,
  contactId = null,
  campaignId = null,
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

    // Enforce subscription check if contactId is provided
    if (contactId) {
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

    // Check rate limits
    const rateLimit = await checkRateLimit(finalUserId);
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

    // Get Telnyx client for user
    const telnyx = await getTelnyxClient(finalUserId);
    if (!telnyx) {
      return {
        success: false,
        error: 'Telnyx API key not configured. Please configure it in Settings.',
      };
    }

    // Get user's Telnyx settings
    settings = await getUserTelnyxSettings(finalUserId);

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
    if (messageRecord && messageId) {
      try {
        await prisma.message.update({
          where: { id: messageId },
          data: {
            telnyxMessageId,
            status: initialStatus,
            costAmount: costAmount ? parseFloat(costAmount) : null,
            costCurrency,
            telnyxMetadata: response.data ? JSON.parse(JSON.stringify(response.data)) : null,
            sentAt: initialStatus === 'sent' || initialStatus === 'sending' ? new Date() : null,
            text: messageTextWithCodes // Update with code-embedded text
          }
        });
      } catch (dbError) {
        console.error('Error updating message record:', dbError);
        // Continue even if update fails
      }
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
    
    // Log successful message send
    await serverLog(
      `Message sent successfully to ${normalizedTo}`,
      'info',
      {
        messageId: telnyxMessageId,
        contactId,
        campaignId,
        from: fromNumber,
        to: normalizedTo,
        status: initialStatus,
        cost: costAmount,
        parts: validation.parts
      },
      finalUserId
    ).catch(err => console.error('Error logging message send:', err));
    
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
    console.error('Error sending message:', error);
    
    // Handle Telnyx API errors more specifically
    let errorMessage = 'Failed to send message';
    let errorDetails = null;
    
    // Try to extract error details from various possible locations in Telnyx SDK error structure
    if (error.raw?.errors && Array.isArray(error.raw.errors) && error.raw.errors.length > 0) {
      // Telnyx SDK error structure: error.raw.errors[0]
      const firstError = error.raw.errors[0];
      errorDetails = error.raw;
      errorMessage = firstError.detail || firstError.title || firstError.message || errorMessage;
      console.error('Telnyx error details:', JSON.stringify(error.raw, null, 2));
    } else if (error.response?.data) {
      // Alternative error response structure
      errorDetails = error.response.data;
      errorMessage = error.response.data?.errors?.[0]?.detail || 
                     error.response.data?.errors?.[0]?.title || 
                     error.message || errorMessage;
      console.error('Telnyx error response:', JSON.stringify(error.response.data, null, 2));
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
    
    // Log message send failure
    await serverLog(
      `Failed to send message to ${loggedTo}: ${errorMessage}`,
      'error',
      {
        contactId,
        campaignId,
        from: loggedFrom,
        to: loggedTo,
        error: errorMessage,
        errorDetails: errorDetails?.errors?.[0] || errorDetails,
        telnyxRequestId: errorDetails?.requestId || error.requestId
      },
      finalUserId
    ).catch(err => console.error('Error logging message failure:', err));
    
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
