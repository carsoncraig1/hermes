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
        campaign: {
          select: {
            id: true,
            name: true,
            userId: true,
            message: true,
            workflow: true,
            enabled: true,
            messagesSent: true,
            lastMessageSent: true,
            createdAt: true,
            updatedAt: true
            // Exclude totalRevenue to avoid Decimal issues
          }
        }
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
    
    // For legacy shortlinks, check if slug is already taken
    if (data.type === 'legacy' && data.slug) {
      const existing = await prisma.shortlink.findUnique({
        where: { slug: data.slug.toLowerCase() }
      })
      if (existing) {
        throw new Error(`Slug "${data.slug}" is already taken. Please choose a different one.`)
      }
    }
    
    const shortlink = await prisma.shortlink.create({
      data: {
        userId,
        type: data.type || 'dynamic',
        nickname: data.nickname || null,
        slug: data.slug ? data.slug.toLowerCase() : null,
        destination: data.destination,
        enabled: data.enabled !== undefined ? data.enabled : true,
        campaignId: data.campaignId || null,
        ogEnabled: data.ogEnabled ?? false,
        ogImage: data.ogImage || null,
        ogTitle: data.ogTitle || null,
        ogDescription: data.ogDescription || null
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            userId: true,
            message: true,
            workflow: true,
            enabled: true,
            messagesSent: true,
            lastMessageSent: true,
            createdAt: true,
            updatedAt: true
            // Exclude totalRevenue to avoid Decimal issues
          }
        }
      }
    })
    return shortlink
  } catch (error) {
    const isSlugTaken = error.code === 'P2002' || (error.message && error.message.includes('already taken'))
    if (!isSlugTaken) {
      console.error('Error adding shortlink:', error)
    }
    if (error.code === 'P2002') {
      throw new Error('This slug is already taken. Please choose a different one.')
    }
    throw new Error(error.message || 'Failed to add shortlink')
  }
}

export async function updateShortlink({ id, nickname, slug, destination, enabled, campaignId, ogEnabled, ogImage, ogTitle, ogDescription }) {
  try {
    const userId = await getUserId()
    
    // Verify ownership
    const existing = await prisma.shortlink.findFirst({
      where: { id, userId }
    })
    if (!existing) {
      throw new Error('Shortlink not found')
    }
    
    // For legacy shortlinks, check if slug is already taken (if changing)
    if (slug && existing.type === 'legacy' && slug !== existing.slug) {
      const slugTaken = await prisma.shortlink.findUnique({
        where: { slug: slug.toLowerCase() }
      })
      if (slugTaken && slugTaken.id !== id) {
        throw new Error(`Slug "${slug}" is already taken. Please choose a different one.`)
      }
    }
    
    const updateData = {
      nickname: nickname || null,
      destination,
      ogEnabled: ogEnabled ?? false,
      ogImage: ogImage || null,
      ogTitle: ogTitle || null,
      ogDescription: ogDescription || null
    }
    
    // Only update slug for legacy shortlinks
    if (existing.type === 'legacy' && slug) {
      updateData.slug = slug.toLowerCase()
    }
    
    // Only update enabled for legacy shortlinks
    if (existing.type === 'legacy' && enabled !== undefined) {
      updateData.enabled = enabled
    }
    
    // Only update campaignId for dynamic shortlinks
    if (existing.type === 'dynamic') {
      updateData.campaignId = campaignId || null
    }
    
    const shortlink = await prisma.shortlink.update({
      where: { id },
      data: updateData,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            userId: true,
            message: true,
            workflow: true,
            enabled: true,
            messagesSent: true,
            lastMessageSent: true,
            createdAt: true,
            updatedAt: true
            // Exclude totalRevenue to avoid Decimal issues
          }
        }
      }
    })
    return shortlink
  } catch (error) {
    const isSlugTaken = error.code === 'P2002' || (error.message && error.message.includes('already taken'))
    if (!isSlugTaken) {
      console.error('Error updating shortlink:', error)
    }
    if (error.code === 'P2002') {
      throw new Error('This slug is already taken. Please choose a different one.')
    }
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
        campaign: {
          select: {
            id: true,
            name: true,
            userId: true,
            message: true,
            workflow: true,
            enabled: true,
            messagesSent: true,
            lastMessageSent: true,
            createdAt: true,
            updatedAt: true
            // Exclude totalRevenue to avoid Decimal issues
          }
        }
      }
    })
    return shortlink
  } catch (error) {
    console.error('Error toggling shortlink status:', error)
    throw new Error('Failed to toggle shortlink status')
  }
}
