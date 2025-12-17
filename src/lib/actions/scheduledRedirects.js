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

/**
 * Create a scheduled redirect change for a shortlink
 */
export async function createScheduledRedirect({ shortlinkId, newDestination, scheduledAt }) {
  try {
    const userId = await getUserId()
    
    // Verify shortlink ownership
    const shortlink = await prisma.shortlink.findFirst({
      where: { id: shortlinkId, userId }
    })
    if (!shortlink) {
      throw new Error('Shortlink not found')
    }
    
    // Check if there's already a pending scheduled redirect for this shortlink
    const existing = await prisma.scheduledShortlinkRedirect.findFirst({
      where: {
        shortlinkId,
        status: 'pending'
      }
    })
    if (existing) {
      throw new Error('A scheduled redirect is already pending for this shortlink. Cancel it first or wait for it to execute.')
    }
    
    // Validate scheduledAt is in the future
    const scheduledDate = new Date(scheduledAt)
    if (scheduledDate <= new Date()) {
      throw new Error('Scheduled time must be in the future')
    }
    
    const scheduledRedirect = await prisma.scheduledShortlinkRedirect.create({
      data: {
        shortlinkId,
        userId,
        newDestination,
        scheduledAt: scheduledDate
      },
      include: {
        shortlink: {
          select: {
            id: true,
            nickname: true,
            slug: true,
            destination: true
          }
        }
      }
    })
    
    return scheduledRedirect
  } catch (error) {
    console.error('Error creating scheduled redirect:', error)
    throw error
  }
}

/**
 * Get scheduled redirects for a shortlink
 */
export async function getScheduledRedirects(shortlinkId) {
  try {
    const userId = await getUserId()
    
    // Verify shortlink ownership
    const shortlink = await prisma.shortlink.findFirst({
      where: { id: shortlinkId, userId }
    })
    if (!shortlink) {
      throw new Error('Shortlink not found')
    }
    
    const scheduledRedirects = await prisma.scheduledShortlinkRedirect.findMany({
      where: { shortlinkId },
      orderBy: {
        scheduledAt: 'desc'
      }
    })
    
    return scheduledRedirects
  } catch (error) {
    console.error('Error fetching scheduled redirects:', error)
    throw error
  }
}

/**
 * Cancel a scheduled redirect
 */
export async function cancelScheduledRedirect(id) {
  try {
    const userId = await getUserId()
    
    const scheduledRedirect = await prisma.scheduledShortlinkRedirect.findFirst({
      where: { id, userId }
    })
    if (!scheduledRedirect) {
      throw new Error('Scheduled redirect not found')
    }
    
    if (scheduledRedirect.status !== 'pending') {
      throw new Error('Only pending scheduled redirects can be cancelled')
    }
    
    const updated = await prisma.scheduledShortlinkRedirect.update({
      where: { id },
      data: { status: 'cancelled' }
    })
    
    return updated
  } catch (error) {
    console.error('Error cancelling scheduled redirect:', error)
    throw error
  }
}

/**
 * Process scheduled redirects that are ready to execute
 * Called by the job processor
 */
export async function processScheduledRedirects() {
  try {
    const now = new Date()
    
    // Find all pending scheduled redirects that are ready to execute
    const readyRedirects = await prisma.scheduledShortlinkRedirect.findMany({
      where: {
        status: 'pending',
        scheduledAt: {
          lte: now // scheduledAt <= now
        }
      },
      include: {
        shortlink: {
          select: {
            id: true,
            destination: true,
            nickname: true,
            slug: true
          }
        }
      },
      orderBy: {
        scheduledAt: 'asc'
      }
    })
    
    const results = []
    
    for (const scheduledRedirect of readyRedirects) {
      try {
        // Update the shortlink destination
        await prisma.shortlink.update({
          where: { id: scheduledRedirect.shortlinkId },
          data: {
            destination: scheduledRedirect.newDestination
          }
        })
        
        // Mark the scheduled redirect as completed
        await prisma.scheduledShortlinkRedirect.update({
          where: { id: scheduledRedirect.id },
          data: {
            status: 'completed',
            executedAt: new Date()
          }
        })
        
        const shortlinkName = scheduledRedirect.shortlink.nickname || 
                             scheduledRedirect.shortlink.slug || 
                             `Shortlink #${scheduledRedirect.shortlinkId}`
        
        console.log(`✅ Scheduled redirect executed: ${shortlinkName} → ${scheduledRedirect.newDestination}`)
        
        results.push({
          id: scheduledRedirect.id,
          shortlinkId: scheduledRedirect.shortlinkId,
          status: 'completed'
        })
      } catch (error) {
        console.error(`Error processing scheduled redirect ${scheduledRedirect.id}:`, error)
        
        // Mark as failed (we could add a retry mechanism later)
        await prisma.scheduledShortlinkRedirect.update({
          where: { id: scheduledRedirect.id },
          data: {
            status: 'failed',
            errorMessage: error.message
          }
        }).catch(() => {})
        
        results.push({
          id: scheduledRedirect.id,
          shortlinkId: scheduledRedirect.shortlinkId,
          status: 'error',
          error: error.message
        })
      }
    }
    
    return results
  } catch (error) {
    console.error('Error processing scheduled redirects:', error)
    throw error
  }
}

