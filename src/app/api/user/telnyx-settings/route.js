import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        telnyxApiKey: true,
        telnyxPhoneNumber: true,
        telnyxMessagingProfileId: true,
      },
    })

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    return Response.json({
      telnyxApiKey: user.telnyxApiKey || '',
      telnyxPhoneNumber: user.telnyxPhoneNumber || '',
      telnyxMessagingProfileId: user.telnyxMessagingProfileId || '',
    })
  } catch (error) {
    console.error('Error fetching Telnyx settings:', error)
    return Response.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { telnyxApiKey, telnyxPhoneNumber, telnyxMessagingProfileId } = body

    // Validate phone number format if provided
    if (telnyxPhoneNumber && telnyxPhoneNumber.trim()) {
      // Basic validation - should be in E.164 format
      const phoneRegex = /^\+1[0-9]{10}$/
      if (!phoneRegex.test(telnyxPhoneNumber.trim())) {
        return Response.json(
          { error: 'Phone number must be in E.164 format (+1XXXXXXXXXX)' },
          { status: 400 }
        )
      }
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        telnyxApiKey: telnyxApiKey?.trim() || null,
        telnyxPhoneNumber: telnyxPhoneNumber?.trim() || null,
        telnyxMessagingProfileId: telnyxMessagingProfileId?.trim() || null,
      },
      select: {
        telnyxApiKey: true,
        telnyxPhoneNumber: true,
        telnyxMessagingProfileId: true,
      },
    })

    return Response.json({
      telnyxApiKey: user.telnyxApiKey || '',
      telnyxPhoneNumber: user.telnyxPhoneNumber || '',
      telnyxMessagingProfileId: user.telnyxMessagingProfileId || '',
    })
  } catch (error) {
    console.error('Error updating Telnyx settings:', error)
    return Response.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}

