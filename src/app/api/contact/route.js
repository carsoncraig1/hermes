import prisma from '@/lib/prisma'

// Helper function to validate API key
function validateApiKey(request) {
  const apiKey = request.headers.get('hermes-api-key')
  if (!apiKey || apiKey !== process.env.HERMES_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function GET(request) {
  // Validate API key
  const authError = validateApiKey(request)
  if (authError) return authError

  try {
    const contacts = await prisma.contact.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })
    return Response.json(contacts)
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  // Validate API key
  const authError = validateApiKey(request)
  if (authError) return authError

  try {
    const data = await request.json()
    
    // Validate required fields
    const requiredFields = ['firstName', 'lastName'] // Phone is now optional
    const missingFields = requiredFields.filter(field => !data[field])
    
    if (missingFields.length > 0) {
      return Response.json({
        error: `Missing required fields: ${missingFields.join(', ')}`
      }, { status: 400 })
    }

    // Optional email validation if provided
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(data.email)) {
        return Response.json({
          error: 'Invalid email format'
        }, { status: 400 })
      }
    }

    // Build the data object for prisma.contact.create
    const contactData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || null,
      phone: data.phone || null,
      clickid: data.clickId || null,
      subscribed: data.subscribed || true,
    }
    // Only add tags if provided
    if (data.tags) {
      contactData.tags = data.tags
    }

    const contact = await prisma.contact.create({
      data: contactData
    })

    return Response.json(contact, { status: 201 })
  } catch (error) {
    console.error('API Error:', error)
    
    if (error.code === 'P2002') {
      return Response.json({
        error: 'A contact with this email already exists'
      }, { status: 409 })
    }

    return Response.json({ 
      error: 'Failed to create contact',
      details: error.message 
    }, { status: 500 })
  }
}

export async function PUT(request) {
  // Validate API key
  const authError = validateApiKey(request)
  if (authError) return authError

  try {
    const data = await request.json()
    
    // Ensure phone is provided if updating
    if (data.phone === undefined || data.phone === null) {
      return Response.json({
        error: 'Phone number is required'
      }, { status: 400 })
    }

    const contact = await prisma.contact.update({
      where: { id: data.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.phone,
        clickid: data.clickId || null,
        subscribed: data.subscribed,
        tags: data.tags || [], // Update tags array
      }
    })
    return Response.json(contact)
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  // Validate API key
  const authError = validateApiKey(request)
  if (authError) return authError

  try {
    const data = await request.json()
    await prisma.contact.delete({
      where: { id: data.id }
    })
    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
} 