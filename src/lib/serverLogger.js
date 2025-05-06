'use server'

/**
 * Logs messages from client components to the server console
 * @param {string} message - The message to log
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {Object} meta - Additional metadata to include in the log
 * @returns {Promise<{success: boolean, timestamp: string}>}
 */

// Store logs in memory (you might want to use a proper database in production)
const logs = []
const MAX_LOGS = 1000 // Limit the number of stored logs

export async function serverLog(message, level = 'info', meta = {}) {
  const timestamp = new Date().toISOString()
  
  // Format the message based on metadata
  let formattedMeta = ''
  if (meta && Object.keys(meta).length > 0) {
    try {
      formattedMeta = JSON.stringify(meta)
    } catch (e) {
      formattedMeta = '[Unable to stringify metadata]'
    }
  }
  
  // Create log entry
  const logEntry = {
    timestamp,
    level,
    message,
    meta: formattedMeta
  }
  
  // Add to memory store
  logs.unshift(logEntry)
  if (logs.length > MAX_LOGS) {
    logs.pop()
  }
  
  // Log to server console
  console.log(`[${level.toUpperCase()}] [${timestamp}]: ${message} ${formattedMeta}`)
  
  return { success: true, timestamp }
}

export async function getLogs() {
  return logs
} 