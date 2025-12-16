'use server'

import prisma from '@/lib/prisma'

const CACHE_TTL_SECONDS = 10 // Cache for 10 seconds
const CACHE_EXPIRY_MS = CACHE_TTL_SECONDS * 1000

/**
 * Get cached rate limit data or calculate fresh
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Rate limit data
 */
export async function getCachedRateLimit(userId) {
  const now = new Date()
  
  // Try to get cached data
  const cache = await prisma.rateLimitCache.findUnique({
    where: { userId }
  })
  
  // If cache exists and is still valid, return it
  if (cache && cache.expiresAt > now) {
    return {
      minuteCount: cache.minuteCount,
      hourCount: cache.hourCount,
      cached: true
    }
  }
  
  // Cache miss or expired - calculate fresh
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  
  const [recentMinute, recentHour] = await Promise.all([
    prisma.message.count({
      where: {
        userId,
        direction: 'outbound',
        createdAt: { gte: oneMinuteAgo },
        status: { not: 'sending_failed' }
      }
    }),
    prisma.message.count({
      where: {
        userId,
        direction: 'outbound',
        createdAt: { gte: oneHourAgo },
        status: { not: 'sending_failed' }
      }
    })
  ])
  
  // Update or create cache
  const expiresAt = new Date(now.getTime() + CACHE_EXPIRY_MS)
  await prisma.rateLimitCache.upsert({
    where: { userId },
    create: {
      userId,
      minuteCount: recentMinute,
      hourCount: recentHour,
      expiresAt
    },
    update: {
      minuteCount: recentMinute,
      hourCount: recentHour,
      expiresAt,
      lastUpdated: now
    }
  })
  
  return {
    minuteCount: recentMinute,
    hourCount: recentHour,
    cached: false
  }
}

/**
 * Invalidate rate limit cache for a user
 * @param {string} userId - User ID
 */
export async function invalidateRateLimitCache(userId) {
  await prisma.rateLimitCache.deleteMany({
    where: { userId }
  }).catch(() => {
    // Ignore errors - cache invalidation is best effort
  })
}

/**
 * Increment rate limit cache counts (optimistic update)
 * @param {string} userId - User ID
 */
export async function incrementRateLimitCache(userId) {
  await prisma.rateLimitCache.updateMany({
    where: {
      userId,
      expiresAt: { gt: new Date() } // Only update if cache is still valid
    },
    data: {
      minuteCount: { increment: 1 },
      hourCount: { increment: 1 }
    }
  }).catch(() => {
    // Ignore errors - cache update is best effort
  })
}

