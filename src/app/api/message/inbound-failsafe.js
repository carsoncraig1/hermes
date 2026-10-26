import prisma from '@/lib/prisma'

import { normalizePhoneNumber } from '@/lib/phoneUtils'

export async function POST(request) {
  try {
    const body = await request.json();
    
    /* Expected webhook format:
    {
      "data": {
        "id": "1234567890",
        "record_type": "message",
        "direction": "inbound",
        "from": "+1234567890",
        "to": "+0987654321",
        "text": "Hello, this is a test message",
        "received_at": "2023-10-01T12:00:00Z",
        "webhook_url": "https://your-webhook-url.com",
        "webhook_failover_url": "https://your-failover-url.com",
        "webhook_api_version": "2"
      }
    }
    */

    // Telnyx inbound webhook structure:
    // body.data.event_type = "message.received"
    // body.data.payload.direction = "inbound"
    // body.data.payload.from.phone_number = "+1234567890"
    // body.data.payload.to[0].phone_number = "+0987654321"
    // body.data.payload.text = "message text"
    
    const payload = body.data?.payload || body.data;
    const eventType = body.data?.event_type;
    
    if (payload?.direction === "inbound" || eventType === "message.received") {
      // Extract phone numbers and text from Telnyx webhook format
      const from = payload.from?.phone_number || payload.from;
      const to = Array.isArray(payload.to) 
        ? payload.to[0]?.phone_number || payload.to[0]
        : payload.to?.phone_number || payload.to;
      const text = payload.text || '';
      
      // Check for STOP message anywhere in the text
      if (text && text.trim().toUpperCase().includes("STOP")) {
        // Normalize phone numbers before matching
        const normalizedFrom = normalizePhoneNumber(from);
        const normalizedTo = normalizePhoneNumber(to);
        
        if (!normalizedFrom || !normalizedTo) {
          console.warn(`STOP message: Invalid phone number format. From: ${from}, To: ${to}`);
          return new Response(JSON.stringify({ 
            success: true,
            message: 'Invalid phone number format',
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        // Find which user this message belongs to based on the 'to' phone number
        // The 'to' number should match a user's telnyxPhoneNumber (normalized)
        const user = await prisma.user.findFirst({
          where: {
            telnyxPhoneNumber: normalizedTo
          },
          select: {
            id: true
          }
        });

        if (!user) {
          // If we can't determine the user, log it but don't unsubscribe
          console.warn(`STOP message received from ${from} to ${to}, but no user found with that phone number`);
          return new Response(JSON.stringify({ 
            success: true,
            message: 'STOP message received but user could not be identified',
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          });
        }

        // Update only contacts belonging to this user with the matching phone number (normalized)
        const result = await prisma.contact.updateMany({
          where: {
            userId: user.id,
            phone: normalizedFrom
          },
          data: {
            subscribed: false,
            unsubscribeReason: 'STOP'
          }
        });

        // Log the unsubscribe action for debugging
        console.log(`[STOP Message] User ${user.id}: Unsubscribed ${result.count} contact(s) with phone ${normalizedFrom} (original: ${from})`);

        return new Response(JSON.stringify({ 
          success: true,
          message: 'Contact unsubscribed successfully',
          contactsUpdated: result.count
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error processing inbound message:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
