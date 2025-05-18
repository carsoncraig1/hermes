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
      const { from, text } = body.data;
      
      // Check for STOP message anywhere in the text
      if (text.trim().toUpperCase().includes("STOP")) {
        // Find and update the contact's subscription status
        const contact = await prisma.contact.updateMany({
          where: {
            phone: from
          },
          data: {
            subscribed: false
          }
        });

        return new Response(JSON.stringify({ 
          success: true,
          message: 'Contact unsubscribed successfully',
          contact
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
