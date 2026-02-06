'use server'

import prisma from '@/lib/prisma'

const CACHE_TTL_SECONDS = 10 // Cache for 10 seconds
const CACHE_EXPIRY_MS = CACHE_TTL_SECONDS * 1000

// In-memory cache layer to avoid DB hits during bulk sends
// Structure: Map<userId, { minuteCount, hourCount, expiresAt, pendingCount }>
const memoryCache = new Map()

/**
 * Get cached rate limit data with in-memory layer
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Rate limit data
 */
export async function getCachedRateLimit(userId) {
  const now = Date.now()
  
  // Check in-memory cache first (fastest path)
  const memCached = memoryCache.get(userId)
  if (memCached && memCached.expiresAt > now) {
    return {
      minuteCount: memCached.minuteCount + (memCached.pendingCount || 0),
      hourCount: memCached.hourCount + (memCached.pendingCount || 0),
      cached: true,
      memCached: true
    }
  }
  
  // Try DB cache next
  const cache = await prisma.rateLimitCache.findUnique({
    where: { userId }
  })
  
  // If DB cache exists and is still valid
  if (cache && cache.expiresAt > new Date()) {
    // Store in memory cache for subsequent fast lookups
    memoryCache.set(userId, {
      minuteCount: cache.minuteCount,
      hourCount: cache.hourCount,
      expiresAt: cache.expiresAt.getTime(),
      pendingCount: 0
    })
    
    return {
      minuteCount: cache.minuteCount,
      hourCount: cache.hourCount,
      cached: true,
      memCached: false
    }
  }
  
  // Cache miss or expired - calculate fresh
  const oneMinuteAgo = new Date(now - 60 * 1000)
  const oneHourAgo = new Date(now - 60 * 60 * 1000)
  
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
  
  const expiresAt = new Date(now + CACHE_EXPIRY_MS)
  
  // Update in-memory cache
  memoryCache.set(userId, {
    minuteCount: recentMinute,
    hourCount: recentHour,
    expiresAt: expiresAt.getTime(),
    pendingCount: 0
  })
  
  // Update DB cache asynchronously (don't wait)
  prisma.rateLimitCache.upsert({
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
      lastUpdated: new Date()
    }
  }).catch(() => {}) // Best effort, don't block
  
  return {
    minuteCount: recentMinute,
    hourCount: recentHour,
    cached: false,
    memCached: false
  }
}

/**
 * Invalidate rate limit cache for a user
 * @param {string} userId - User ID
 */
export async function invalidateRateLimitCache(userId) {
  // Clear in-memory cache immediately
  memoryCache.delete(userId)
  
  // Clear DB cache asynchronously
  await prisma.rateLimitCache.deleteMany({
    where: { userId }
  }).catch(() => {
    // Ignore errors - cache invalidation is best effort
  })
}

/**
 * Increment rate limit cache counts (optimistic update)
 * Uses in-memory cache for immediate updates, DB is async
 * @param {string} userId - User ID
 */
export async function incrementRateLimitCache(userId) {
  // Increment in-memory cache immediately (fastest path)
  const memCached = memoryCache.get(userId)
  if (memCached) {
    memCached.pendingCount = (memCached.pendingCount || 0) + 1
  }
  
  // Update DB cache asynchronously (don't wait)
  prisma.rateLimitCache.updateMany({
    where: {
      userId,
      expiresAt: { gt: new Date() }
    },
    data: {
      minuteCount: { increment: 1 },
      hourCount: { increment: 1 }
    }
  }).catch(() => {
    // Ignore errors - cache update is best effort
  })
}

/**
 * Clear all in-memory cache entries (useful for testing or memory management)
 */
export async function clearMemoryCache() {
  memoryCache.clear()
}

