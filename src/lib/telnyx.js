'use server';

import { Telnyx } from 'telnyx';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { validateMessage } from '@/lib/messageUtils';
import { checkRateLimit, createMessageRecord } from '@/lib/actions/messages';
import { createMessageClickCodes } from '@/lib/messageClickCodes';

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
    const settings = await getUserTelnyxSettings(finalUserId);

    // Use provided from number, or user's default, or fallback
    const fromNumber = from || settings.phoneNumber || process.env.TELNYX_PHONE_NUMBER || process.env.TELNYX_FROM_NUMBER;
    
    if (!fromNumber) {
      return {
        success: false,
        error: 'No sender phone number configured. Please configure it in Settings.',
      };
    }

    // STEP 1: Create message record FIRST (before sending) so we have messageId
    // This allows us to create MessageClickCodes that reference the message
    let messageRecord = null;
    let messageId = null;
    let messageTextWithCodes = text; // Will be modified with click codes
    
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
    const messageParams = {
      from: fromNumber,
      to,
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
    
    if (error.response) {
      // Telnyx API error response
      errorDetails = error.response.data;
      errorMessage = error.response.data?.errors?.[0]?.detail || 
                     error.response.data?.errors?.[0]?.title || 
                     error.message || errorMessage;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    // Create failed message record for tracking (only if we have userId)
    if (finalUserId) {
      try {
        const settings = await getUserTelnyxSettings(finalUserId);
        const fromNumber = from || settings.phoneNumber || process.env.TELNYX_PHONE_NUMBER || process.env.TELNYX_FROM_NUMBER;
        
        await createMessageRecord({
          userId: finalUserId,
          telnyxMessageId: null,
          contactId,
          campaignId,
          from: fromNumber || 'unknown',
          to,
          text,
          type: 'SMS',
          parts: validation?.parts || 1,
          status: 'sending_failed',
          direction: 'outbound',
          costAmount: null,
          costCurrency: 'USD',
          telnyxMetadata: errorDetails || { error: errorMessage }
        });
      } catch (dbError) {
        console.error('Error creating failed message record:', dbError);
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
