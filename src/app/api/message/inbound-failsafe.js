import prisma from '@/lib/prisma'

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

    if (body.data?.direction === "inbound") {
      const { from, to, text } = body.data;
      
      // Check for STOP message anywhere in the text
      if (text.trim().toUpperCase().includes("STOP")) {
        // Find which user this message belongs to based on the 'to' phone number
        // The 'to' number should match a user's telnyxPhoneNumber
        const user = await prisma.user.findFirst({
          where: {
            telnyxPhoneNumber: to
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

        // Update only contacts belonging to this user with the matching phone number
        const result = await prisma.contact.updateMany({
          where: {
            userId: user.id,
            phone: from
          },
          data: {
            subscribed: false
          }
        });

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
