'use server'

import prisma from '@/lib/prisma'

const LOCK_DURATION_MS = 60 * 60 * 1000 // 1 hour

/**
 * Acquire a lock for campaign execution
 * @param {number} campaignId - Campaign ID
 * @param {string} lockedBy - Identifier for who is locking (process ID, etc.)
 * @returns {Promise<boolean>} - True if lock acquired, false if already locked
 */
export async function acquireCampaignLock(campaignId, lockedBy = 'default') {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + LOCK_DURATION_MS)
  
  try {
    // Try to create lock (will fail if one exists due to unique constraint)
    await prisma.campaignExecutionLock.create({
      data: {
        campaignId,
        lockedAt: now,
        expiresAt,
        lockedBy
      }
    })
    return true
  } catch (error) {
    // Check if lock exists and is expired
    const existingLock = await prisma.campaignExecutionLock.findUnique({
      where: { campaignId }
    })
    
    if (existingLock && existingLock.expiresAt < now) {
      // Lock expired - delete it and create new one
      await prisma.campaignExecutionLock.delete({
        where: { campaignId }
      })
      
      try {
        await prisma.campaignExecutionLock.create({
          data: {
            campaignId,
            lockedAt: now,
            expiresAt,
            lockedBy
          }
        })
        return true
      } catch {
        // Race condition - another process got the lock
        return false
      }
    }
    
    // Lock exists and is still valid
    return false
  }
}

/**
 * Release a campaign execution lock
 * @param {number} campaignId - Campaign ID
 */
export async function releaseCampaignLock(campaignId) {
  await prisma.campaignExecutionLock.deleteMany({
    where: { campaignId }
  }).catch(() => {
    // Ignore errors - lock release is best effort
  })
}

/**
 * Check if a campaign is currently locked
 * @param {number} campaignId - Campaign ID
 * @returns {Promise<boolean>} - True if locked
 */
export async function isCampaignLocked(campaignId) {
  const lock = await prisma.campaignExecutionLock.findUnique({
    where: { campaignId }
  })
  
  if (!lock) return false
  
  // Check if expired
  if (lock.expiresAt < new Date()) {
    // Clean up expired lock
    await releaseCampaignLock(campaignId)
    return false
  }
  
  return true
}

/**
 * Clean up expired locks (should be called periodically)
 */
export async function cleanupExpiredLocks() {
  const now = new Date()
  await prisma.campaignExecutionLock.deleteMany({
    where: {
      expiresAt: { lt: now }
    }
  })
}

