'use server';

import { Telnyx } from 'telnyx';

// Initialize Telnyx client
const telnyx = new Telnyx(process.env.TELNYX_API_KEY);

/**
 * Send an SMS message using Telnyx
 * @param {Object} params - Message parameters
 * @param {string} params.from - Sender phone number
 * @param {string} params.to - Recipient phone number
 * @param {string} params.text - Message text
 * @returns {Promise<Object>} - Telnyx API response
 */
export async function sendMessage({
  from,
  to,
  text,
}) {
  try {
    const messageParams = {
      from,
      to,
      text,
      type: 'SMS',
      messaging_profile_id: '400196b2-9253-4a8b-8936-6ac04b4e6bbd',
      webhook_url: 'https://txt.cx/api/message/status',
      use_profile_webhooks: true
    };

    const response = await telnyx.messages.create(messageParams);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error sending message:', error);
    return {
      success: false,
      error: error.message || 'Failed to send message'
    };
  }
}
