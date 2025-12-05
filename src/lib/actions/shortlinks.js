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

export async function getShortlinks() {
  try {
    const userId = await getUserId()
    
    const shortlinks = await prisma.shortlink.findMany({
      where: { userId },
      include: {
        campaign: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    return shortlinks
  } catch (error) {
    console.error('Error fetching shortlinks:', error)
    throw new Error('Failed to fetch shortlinks')
  }
}

export async function addShortlink(data) {
  try {
    const userId = await getUserId()
    
    const shortlink = await prisma.shortlink.create({
      data: {
        userId,
        slug: data.slug,
        destination: data.destination,
        enabled: true // Default to enabled
      },
      include: {
        campaign: true
      }
    })
    return shortlink
  } catch (error) {
    console.error('Error adding shortlink:', error)
    throw new Error('Failed to add shortlink')
  }
}

export async function updateShortlink({ id, slug, destination, campaignId, ogEnabled, ogImage, ogTitle, ogDescription }) {
  try {
    const userId = await getUserId()
    
    // Verify ownership
    const existing = await prisma.shortlink.findFirst({
      where: { id, userId }
    })
    if (!existing) {
      throw new Error('Shortlink not found')
    }
    
    const shortlink = await prisma.shortlink.update({
      where: { id },
      data: {
        slug,
        destination,
        campaignId: campaignId || null, // Allow removing campaign association
        ogEnabled: ogEnabled ?? false,
        ogImage: ogImage || null,
        ogTitle: ogTitle || null,
        ogDescription: ogDescription || null
      },
      include: {
        campaign: true
      }
    })
    return shortlink
  } catch (error) {
    console.error('Error updating shortlink:', error)
    throw error
  }
}

export async function deleteShortlink(id) {
  try {
    const userId = await getUserId()
    
    // Verify ownership
    const existing = await prisma.shortlink.findFirst({
      where: { id, userId }
    })
    if (!existing) {
      throw new Error('Shortlink not found')
    }
    
    await prisma.shortlink.delete({
      where: { id }
    })
    return true
  } catch (error) {
    console.error('Error deleting shortlink:', error)
    throw new Error('Failed to delete shortlink')
  }
}

export async function toggleShortlinkStatus(id, enabled) {
  try {
    const userId = await getUserId()
    
    // Verify ownership
    const existing = await prisma.shortlink.findFirst({
      where: { id, userId }
    })
    if (!existing) {
      throw new Error('Shortlink not found')
    }
    
    const shortlink = await prisma.shortlink.update({
      where: { id },
      data: { enabled },
      include: {
        campaign: true
      }
    })
    return shortlink
  } catch (error) {
    console.error('Error toggling shortlink status:', error)
    throw new Error('Failed to toggle shortlink status')
  }
}
