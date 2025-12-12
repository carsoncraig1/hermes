'use server'

import { auth } from '@/lib/auth'

/**
 * In-memory log storage
 * Map<userId, Array<logEntry>>
 */
const logStore = new Map()

const MAX_LOGS_PER_USER = 1000 // Limit the number of stored logs per user

/**
 * Log entry structure
 * @typedef {Object} LogEntry
 * @property {string} id - Unique log ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} level - Log level (info, warn, error, debug)
 * @property {string} message - Log message
 * @property {Object|null} meta - Additional metadata
 */

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }
  return session.user.id
}

/**
 * Clean up old logs for a user (keep only the most recent MAX_LOGS_PER_USER)
 * @param {string} userId - User ID
 */
function cleanupOldLogs(userId) {
  const logs = logStore.get(userId)
  if (!logs || logs.length <= MAX_LOGS_PER_USER) {
    return
  }
  
  // Sort by timestamp (newest first) and keep only the most recent
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  const logsToKeep = logs.slice(0, MAX_LOGS_PER_USER)
  logStore.set(userId, logsToKeep)
}

/**
 * Logs messages to in-memory storage for the authenticated user
 * @param {string} message - The message to log
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {Object} meta - Additional metadata to include in the log
 * @param {string} userId - Optional userId (if not provided, will get from session)
 * @returns {Promise<{success: boolean, timestamp: string}>}
 */
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
    const logId = `${userId}-${timestamp.getTime()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Create log entry
    const logEntry = {
      id: logId,
      timestamp: timestamp.toISOString(),
      level,
      message,
      meta: meta && Object.keys(meta).length > 0 ? meta : null
    }
    
    // Get or create log array for this user
    if (!logStore.has(userId)) {
      logStore.set(userId, [])
    }
    
    const userLogs = logStore.get(userId)
    userLogs.push(logEntry)
    
    // Clean up old logs if needed
    cleanupOldLogs(userId)
    
    // Also log to server console for debugging
    const metaStr = meta && Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''
    console.log(`[${level.toUpperCase()}] [${timestamp.toISOString()}] [User: ${userId}]: ${message} ${metaStr}`)
    
    return { success: true, timestamp: timestamp.toISOString() }
  } catch (error) {
    console.error('Error logging to memory:', error)
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
    
    // Get logs for this user
    const userLogs = logStore.get(userId) || []
    
    // Sort by timestamp (newest first) and limit
    const sortedLogs = [...userLogs].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    )
    
    return sortedLogs.slice(0, limit)
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
    
    // Clear logs for this user
    logStore.set(userId, [])
    
    return { success: true }
  } catch (error) {
    console.error('Error clearing logs:', error)
    return { success: false, error: error.message }
  }
}
