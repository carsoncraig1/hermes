import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

const UPDATE_CHUNK_SIZE = 200

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user.id
}

export async function POST() {
  try {
    const userId = await getUserId()

    const availableNumbers = await prisma.phoneNumber.findMany({
      where: {
        userId,
        enabled: true,
        acceptingNewLeads: true
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' }
    })

    if (availableNumbers.length === 0) {
      return Response.json({
        success: false,
        error: 'No enabled phone numbers accepting new leads'
      }, { status: 400 })
    }

    const unassignedContacts = await prisma.contact.findMany({
      where: {
        userId,
        assignedPhoneNumberId: null
      },
      select: { id: true },
      orderBy: { id: 'asc' }
    })

    if (unassignedContacts.length === 0) {
      return Response.json({
        success: true,
        migratedCount: 0
      })
    }

    const updatesByNumber = new Map()
    unassignedContacts.forEach((contact, index) => {
      const numberId = availableNumbers[index % availableNumbers.length].id
      if (!updatesByNumber.has(numberId)) updatesByNumber.set(numberId, [])
      updatesByNumber.get(numberId).push(contact.id)
    })

    const txOps = []
    for (const [numberId, contactIds] of updatesByNumber.entries()) {
      for (let i = 0; i < contactIds.length; i += UPDATE_CHUNK_SIZE) {
        const chunk = contactIds.slice(i, i + UPDATE_CHUNK_SIZE)
        txOps.push(
          prisma.contact.updateMany({
            where: {
              userId,
              id: { in: chunk },
              assignedPhoneNumberId: null
            },
            data: { assignedPhoneNumberId: numberId }
          })
        )
      }
    }

    if (txOps.length > 0) {
      await prisma.$transaction(txOps)
    }

    return Response.json({
      success: true,
      migratedCount: unassignedContacts.length
    })
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error migrating contacts to revolver:', error)
    return Response.json({ error: 'Failed to migrate contacts' }, { status: 500 })
  }
}
