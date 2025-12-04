'use server'
import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user.id
}

export async function getTags() {
  try {
    const userId = await getUserId()
    
    const tags = await prisma.tag.findMany({
      where: { userId },
      orderBy: {
        name: 'asc'
      }
    })
    return tags
  } catch (error) {
    console.error('Error fetching tags:', error)
    throw new Error('Failed to fetch tags')
  }
}
