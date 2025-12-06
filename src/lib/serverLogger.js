'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'

/**
 * Logs messages to the database for the authenticated user
 * @param {string} message - The message to log
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {Object} meta - Additional metadata to include in the log
 * @param {string} userId - Optional userId (if not provided, will get from session)
 * @returns {Promise<{success: boolean, timestamp: string}>}
 */

const MAX_LOGS_PER_USER = 1000 // Limit the number of stored logs per user

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }
  return session.user.id
}

export async function serverLog(message, level = 'info', meta = {}, userId = null) {
  try {
    // Get userId if not provided
    if (!userId) {
      userId = await getUserId()
    }
    
    // If no userId, we can't log (this is a user-specific system)
    if (!userId) {
      console.warn('Cannot log: No user ID available')
      return { success: false, error: 'No user ID available' }
    }
    
    const timestamp = new Date()
    
    // Create log entry in database
    await prisma.consoleLog.create({
      data: {
        userId,
        level,
        message,
        meta: meta && Object.keys(meta).length > 0 ? meta : null,
        createdAt: timestamp
      }
    })
    
    // Clean up old logs (keep only the most recent MAX_LOGS_PER_USER)
    const logCount = await prisma.consoleLog.count({
      where: { userId }
    })
    
    if (logCount > MAX_LOGS_PER_USER) {
      // Get the oldest logs to delete
      const logsToDelete = await prisma.consoleLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: logCount - MAX_LOGS_PER_USER,
        select: { id: true }
      })
      
      if (logsToDelete.length > 0) {
        await prisma.consoleLog.deleteMany({
          where: {
            id: { in: logsToDelete.map(log => log.id) }
          }
        })
      }
    }
    
    // Also log to server console for debugging
    const metaStr = meta && Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''
    console.log(`[${level.toUpperCase()}] [${timestamp.toISOString()}] [User: ${userId}]: ${message} ${metaStr}`)
    
    return { success: true, timestamp: timestamp.toISOString() }
  } catch (error) {
    console.error('Error logging to database:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get logs for the authenticated user
 * @param {number} limit - Maximum number of logs to return (default: 100)
 * @param {string} userId - Optional userId (if not provided, will get from session)
 * @returns {Promise<Array>} Array of log entries
 */
export async function getLogs(limit = 100, userId = null) {
  try {
    // Get userId if not provided
    if (!userId) {
      userId = await getUserId()
    }
    
    // If no userId, return empty array
    if (!userId) {
      return []
    }
    
    const logs = await prisma.consoleLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    })
    
    // Format logs for the frontend
    return logs.map(log => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      level: log.level,
      message: log.message,
      meta: log.meta
    }))
  } catch (error) {
    console.error('Error fetching logs:', error)
    return []
  }
}

/**
 * Clear logs for the authenticated user
 * @param {string} userId - Optional userId (if not provided, will get from session)
 * @returns {Promise<{success: boolean}>}
 */
export async function clearLogs(userId = null) {
  try {
    // Get userId if not provided
    if (!userId) {
      userId = await getUserId()
    }
    
    // If no userId, return error
    if (!userId) {
      return { success: false, error: 'No user ID available' }
    }
    
    await prisma.consoleLog.deleteMany({
      where: { userId }
    })
    
    return { success: true }
  } catch (error) {
    console.error('Error clearing logs:', error)
    return { success: false, error: error.message }
  }
}
