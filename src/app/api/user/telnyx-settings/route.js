import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { invalidateMessagingProfile } from '@/lib/messagingProfileCache'
import { normalizePhoneNumber } from '@/lib/phoneUtils'

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

    let normalizedPhoneNumber
    if (telnyxPhoneNumber !== undefined) {
      const clearing = telnyxPhoneNumber === null ||
        (typeof telnyxPhoneNumber === 'string' && !telnyxPhoneNumber.trim())
      normalizedPhoneNumber = clearing ? null : normalizePhoneNumber(telnyxPhoneNumber)
      if (!clearing && !normalizedPhoneNumber) {
        return Response.json(
          { error: 'Invalid phone number. Include + and the country code for international numbers; bare 10-digit numbers default to +1.' },
          { status: 400 }
        )
      }
    }

    const previous = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { telnyxMessagingProfileId: true },
    })

    const nextProfileId = telnyxMessagingProfileId?.trim() || null

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        telnyxApiKey: telnyxApiKey?.trim() || null,
        telnyxPhoneNumber: normalizedPhoneNumber,
        telnyxMessagingProfileId: nextProfileId,
      },
      select: {
        telnyxApiKey: true,
        telnyxPhoneNumber: true,
        telnyxMessagingProfileId: true,
      },
    })

    invalidateMessagingProfile(previous?.telnyxMessagingProfileId)
    invalidateMessagingProfile(nextProfileId)

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

