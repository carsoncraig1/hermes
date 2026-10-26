import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { invalidateMessagingProfile } from '@/lib/messagingProfileCache'
import { normalizePhoneNumber } from '@/lib/phoneUtils'

const ALLOWED_TYPES = new Set(['toll_free', 'local', 'short_code'])

// Shared shape returned to the settings UI (includes the attached .vcf card, if any).
const PHONE_SELECT = {
  id: true,
  phoneNumber: true,
  friendlyName: true,
  type: true,
  messagingProfileId: true,
  enabled: true,
  acceptingNewLeads: true,
  rateLimit: true,
  currentMonthMessages: true,
  mediaAssetId: true,
  mediaAsset: { select: { id: true, label: true, kind: true, contentType: true, sizeBytes: true, source: true } },
  _count: { select: { contacts: true } },
  createdAt: true,
}

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user.id
}

export async function GET() {
  try {
    const userId = await getUserId()
    const phoneNumbers = await prisma.phoneNumber.findMany({
      where: { userId },
      select: PHONE_SELECT,
      orderBy: { createdAt: 'asc' }
    })

    const unassignedContacts = await prisma.contact.count({
      where: {
        userId,
        assignedPhoneNumberId: null
      }
    })

    return Response.json({
      phoneNumbers,
      unassignedContacts
    })
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching phone numbers:', error)
    return Response.json({ error: 'Failed to fetch phone numbers' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const userId = await getUserId()
    const body = await request.json()

    const phoneNumber = normalizePhoneNumber(body.phoneNumber)
    const friendlyName = body.friendlyName?.trim() || null
    const type = body.type?.trim() || 'toll_free'
    const messagingProfileId = body.messagingProfileId?.trim() || null

    if (!phoneNumber) {
      return Response.json({ error: 'Invalid phone number. Include + and the country code for international numbers; bare 10-digit numbers default to +1.' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(type)) {
      return Response.json({ error: 'Invalid phone number type' }, { status: 400 })
    }

    const existing = await prisma.phoneNumber.findUnique({
      where: {
        userId_phoneNumber: {
          userId,
          phoneNumber
        }
      },
      select: { id: true }
    })
    if (existing) {
      return Response.json({ error: 'Phone number already exists' }, { status: 409 })
    }

    const created = await prisma.phoneNumber.create({
      data: {
        userId,
        phoneNumber,
        friendlyName,
        type,
        messagingProfileId,
        enabled: true,
        acceptingNewLeads: true,
        rateLimit: 1200
      },
      select: PHONE_SELECT
    })

    invalidateMessagingProfile(messagingProfileId)

    return Response.json(created, { status: 201 })
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error creating phone number:', error)
    return Response.json({ error: 'Failed to create phone number' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const userId = await getUserId()
    const body = await request.json()
    const id = Number(body.id)

    if (!id) {
      return Response.json({ error: 'Phone number id is required' }, { status: 400 })
    }

    const existing = await prisma.phoneNumber.findFirst({
      where: { id, userId },
      select: { id: true, messagingProfileId: true }
    })
    if (!existing) {
      return Response.json({ error: 'Phone number not found' }, { status: 404 })
    }

    const updateData = {}
    if (body.friendlyName !== undefined) updateData.friendlyName = body.friendlyName?.trim() || null
    if (body.messagingProfileId !== undefined) updateData.messagingProfileId = body.messagingProfileId?.trim() || null
    if (body.enabled !== undefined) updateData.enabled = Boolean(body.enabled)
    if (body.acceptingNewLeads !== undefined) updateData.acceptingNewLeads = Boolean(body.acceptingNewLeads)
    if (body.rateLimit !== undefined) {
      const parsedRate = Number(body.rateLimit)
      if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
        return Response.json({ error: 'rateLimit must be a positive number' }, { status: 400 })
      }
      updateData.rateLimit = Math.floor(parsedRate)
    }

    if (updateData.enabled === false) {
      updateData.acceptingNewLeads = false
    }

    // Attach/detach a .vcf contact card for this number (verify the asset is the user's).
    if (body.mediaAssetId !== undefined) {
      if (body.mediaAssetId) {
        const asset = await prisma.mediaAsset.findFirst({
          where: { id: body.mediaAssetId, userId },
          select: { id: true }
        })
        if (!asset) {
          return Response.json({ error: 'Media asset not found' }, { status: 404 })
        }
        updateData.mediaAssetId = asset.id
      } else {
        updateData.mediaAssetId = null
      }
    }

    const updated = await prisma.phoneNumber.update({
      where: { id },
      data: updateData,
      select: PHONE_SELECT
    })

    if (updateData.messagingProfileId !== undefined) {
      invalidateMessagingProfile(existing.messagingProfileId)
      invalidateMessagingProfile(updated.messagingProfileId)
    }

    return Response.json(updated)
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error updating phone number:', error)
    return Response.json({ error: 'Failed to update phone number' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const userId = await getUserId()
    const body = await request.json()
    const id = Number(body.id)

    if (!id) {
      return Response.json({ error: 'Phone number id is required' }, { status: 400 })
    }

    const existing = await prisma.phoneNumber.findFirst({
      where: { id, userId },
      select: { id: true, messagingProfileId: true }
    })
    if (!existing) {
      return Response.json({ error: 'Phone number not found' }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.contact.updateMany({
        where: { userId, assignedPhoneNumberId: id },
        data: { assignedPhoneNumberId: null }
      }),
      prisma.phoneNumber.delete({
        where: { id }
      })
    ])

    invalidateMessagingProfile(existing.messagingProfileId)

    return Response.json({ success: true })
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error deleting phone number:', error)
    return Response.json({ error: 'Failed to delete phone number' }, { status: 500 })
  }
}
