import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { triggerWorkflowsForContact } from '@/lib/workflow/executor'
import { normalizePhoneNumber } from '@/lib/phoneUtils'


// Helper function to get user ID from session or API key
async function getUserId(request) {
  // Try to get from session first (for web app usage)
  try {
    const session = await auth()
    if (session?.user?.id) {
      return { userId: session.user.id }
    }
  } catch (error) {
    // Session not available, continue to API key method
  }
  
  // Try to get from API key header (for external API usage)
  const apiKey = request.headers.get('hermes-api-key')
  if (apiKey) {
    const user = await prisma.user.findUnique({
      where: { apiKey: apiKey }
    })
    if (!user) {
      return { 
        error: Response.json({ error: 'Invalid API key' }, { status: 401 }) 
      }
    }
    return { userId: user.id }
  }
  
  // If no authentication found, return error
  return { 
    error: Response.json({ 
      error: 'Authentication required. Please provide hermes-api-key header or authenticate via session.' 
    }, { status: 401 }) 
  }
}

export async function GET(request) {
  try {
    // Get userId from session or API key
    const userIdResult = await getUserId(request)
    if (userIdResult.error) return userIdResult.error
    const userId = userIdResult.userId

    const contacts = await prisma.contact.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        tags: true
      }
    })
    return Response.json(contacts)
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const data = await request.json()
    
    // Get userId from session or API key
    const userIdResult = await getUserId(request)
    if (userIdResult.error) return userIdResult.error
    const userId = userIdResult.userId
    
    // Validate required field: phone number
    if (!data.phone) {
      return Response.json({
        error: 'Phone number is required'
      }, { status: 400 })
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(data.phone)
    
    if (!normalizedPhone) {
      return Response.json({
        error: 'Invalid phone number format. Include + and the country code for international numbers; 10-digit NANP numbers may omit +1.'
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
    
    // Check for existing contact with same phone number (within same user)
    // If found, we'll update it instead of creating a new one
    const existingContact = await prisma.contact.findFirst({
      where: {
        userId,
        phone: normalizedPhone
      },
      select: {
        id: true,
        clickid: true,
        assignedPhoneNumberId: true,
        tags: true
      }
    })

    // Handle tags - support both single tag and tags array (for backward compatibility)
    let tagConnections = []
    if (data.tag) {
      const tag = await prisma.tag.upsert({
        where: {
          name_userId: {
            name: data.tag,
            userId
          }
        },
        update: {},
        create: {
          name: data.tag,
          userId
        }
      })
      tagConnections = [{ id: tag.id }]
    } else if (data.tags && Array.isArray(data.tags)) {
      tagConnections = await Promise.all(
        data.tags.map(async (tagName) => {
          const tag = await prisma.tag.upsert({
            where: {
              name_userId: {
                name: tagName,
                userId
              }
            },
            update: {},
            create: {
              name: tagName,
              userId
            }
          })
          return { id: tag.id }
        })
      )
    }

    // Handle clickid - merge arrays if duplicate found
    let clickidArray = []
    if (data.clickid) {
      // Support both single clickid and array
      if (Array.isArray(data.clickid)) {
        clickidArray = data.clickid.filter(c => c) // Remove empty values
      } else {
        clickidArray = [data.clickid]
      }
    }

    let contact

    if (existingContact) {
      // Update existing contact with new data
      // Only update fields that are provided in the request
      const updatePayload = {
        phone: normalizedPhone // Phone is always updated
      }
      
      // Only update fields if they're provided in the request
      if (data.firstName !== undefined) updatePayload.firstName = data.firstName || null
      if (data.lastName !== undefined) updatePayload.lastName = data.lastName || null
      if (data.email !== undefined) updatePayload.email = data.email || null
      if (data.source !== undefined) updatePayload.source = data.source || null
      if (data.age !== undefined) updatePayload.age = data.age || null
      if (data.ip !== undefined) updatePayload.ip = data.ip || null
      if (data.useragent !== undefined) updatePayload.useragent = data.useragent || null
      if (data.referrer !== undefined) updatePayload.referrer = data.referrer || null
      if (data.subscribed !== undefined) updatePayload.subscribed = data.subscribed

      // Merge clickids - combine existing and new, remove duplicates
      if (clickidArray.length > 0) {
        const existingClickids = existingContact.clickid || []
        const mergedClickids = [...new Set([...existingClickids, ...clickidArray])]
        updatePayload.clickid = mergedClickids
      }

      // Update tags if provided
      if (tagConnections.length > 0) {
        updatePayload.tags = {
          set: tagConnections
        }
      }

      contact = await prisma.contact.update({
        where: { id: existingContact.id },
        data: updatePayload,
        include: {
          tags: true
        }
      })
    } else {
      // Create new contact - all fields except phone are optional
      const contactData = {
        userId,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        email: data.email || null,
        phone: normalizedPhone, // Required
        clickid: clickidArray,
        source: data.source || null,
        age: data.age || null,
        ip: data.ip || null,
        useragent: data.useragent || null,
        referrer: data.referrer || null,
        subscribed: data.subscribed !== undefined ? data.subscribed : true,
      }

      if (tagConnections.length > 0) {
        contactData.tags = {
          connect: tagConnections
        }
      }

      contact = await prisma.contact.create({
        data: contactData,
        include: {
          tags: true
        }
      })

      // Log new lead event to console
      if (userId) {
        const { serverLog } = await import('@/lib/serverLogger')
        const logMessage = `New lead received: ${contact.phone}${contact.firstName || contact.lastName ? ` (${[contact.firstName, contact.lastName].filter(Boolean).join(' ')})` : ''}`
        const logMeta = {
          contactId: contact.id,
          phone: contact.phone,
          source: contact.source,
          clickid: contact.clickid,
          tags: contact.tags.map(t => t.name)
        }
        serverLog(logMessage, 'info', logMeta, userId).catch(err => {
          console.error('Error logging new lead event:', err)
        })
      }

      // Trigger workflows for new contact (only for new contacts, not updates).
      // Awaited so the send completes within the request lifecycle (serverless
      // can terminate the function before an unawaited promise resolves).
      if (userId) {
        try {
          await triggerWorkflowsForContact(contact, userId)
        } catch (err) {
          console.error('Error triggering workflows:', err)
        }
      }
    }

    // === REVOLVER: Assign phone number to new/unassigned contact ===
    if (!existingContact?.assignedPhoneNumberId) {
      try {
        const availableNumbers = await prisma.phoneNumber.findMany({
          where: {
            userId,
            enabled: true,
            acceptingNewLeads: true,
          },
          select: {
            id: true,
            phoneNumber: true,
            _count: { select: { contacts: true } }
          },
          orderBy: { createdAt: 'asc' }
        })

        if (availableNumbers.length > 0) {
          const leastLoaded = availableNumbers.reduce((min, num) =>
            num._count.contacts < min._count.contacts ? num : min
          )

          await prisma.contact.update({
            where: { id: contact.id },
            data: { assignedPhoneNumberId: leastLoaded.id }
          })
        }
      } catch (assignError) {
        console.error('Error assigning phone number to contact:', assignError)
      }
    }

    return Response.json(contact, { status: existingContact ? 200 : 201 })
  } catch (error) {
    console.error('API Error:', error)
    
    if (error.code === 'P2002') {
      return Response.json({
        error: 'A contact with this email already exists'
      }, { status: 409 })
    }

    return Response.json({ 
      error: 'Failed to create/update contact',
      details: error.message 
    }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const data = await request.json()
    
    // Get userId from session or API key
    const userIdResult = await getUserId(request)
    if (userIdResult.error) return userIdResult.error
    const userId = userIdResult.userId
    
    // Verify contact belongs to this user
    const existing = await prisma.contact.findFirst({
      where: { id: data.id, userId }
    })
    if (!existing) {
      return Response.json({ error: 'Contact not found' }, { status: 404 })
    }
    
    // Ensure phone is provided if updating
    if (data.phone === undefined || data.phone === null) {
      return Response.json({
        error: 'Phone number is required'
      }, { status: 400 })
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(data.phone)
    if (!normalizedPhone) {
      return Response.json({
        error: 'Invalid phone number format. Include + and the country code for international numbers; 10-digit NANP numbers may omit +1.'
      }, { status: 400 })
    }
    
    // Check for duplicate phone number (excluding current contact)
    if (normalizedPhone) {
      const duplicateContact = await prisma.contact.findFirst({
        where: {
          userId,
          phone: normalizedPhone,
          id: { not: data.id }
        }
      })
      
      if (duplicateContact) {
        return Response.json({
          error: 'A contact with this phone number already exists',
          existingContactId: duplicateContact.id
        }, { status: 409 })
      }
    }

    // Handle clickid array for PUT
    let clickidArray = []
    if (data.clickid !== undefined) {
      if (Array.isArray(data.clickid)) {
        clickidArray = data.clickid.filter(c => c)
      } else if (data.clickid) {
        clickidArray = [data.clickid]
      }
    }

    const contact = await prisma.contact.update({
      where: { id: data.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: normalizedPhone,
        clickid: clickidArray.length > 0 ? clickidArray : undefined,
        source: data.source !== undefined ? (data.source || null) : undefined,
        age: data.age !== undefined ? (data.age || null) : undefined,
        ip: data.ip !== undefined ? (data.ip || null) : undefined,
        useragent: data.useragent !== undefined ? (data.useragent || null) : undefined,
        referrer: data.referrer !== undefined ? (data.referrer || null) : undefined,
        subscribed: data.subscribed,
      }
    })
    return Response.json(contact)
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const data = await request.json()
    
    // Get userId from session or API key
    const userIdResult = await getUserId(request)
    if (userIdResult.error) return userIdResult.error
    const userId = userIdResult.userId
    
    // Verify contact belongs to this user
    const existing = await prisma.contact.findFirst({
      where: { id: data.id, userId }
    })
    if (!existing) {
      return Response.json({ error: 'Contact not found' }, { status: 404 })
    }
    
    await prisma.contact.delete({
      where: { id: data.id }
    })
    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
