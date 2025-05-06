'use client'

import { serverLog } from './serverLogger'

// Only log to server when enabled via environment variable
const isServerLoggingEnabled = process.env.NEXT_PUBLIC_ENABLE_SERVER_LOGGING === 'true'

/**
 * Creates a logger that mirrors console logs to the server
 * @param {Object} options - Configuration options
 * @param {boolean} options.localConsole - Whether to also log to local console
 * @param {boolean} options.serverConsole - Whether to send logs to server
 * @returns {Object} - Logger object with console-like methods
 */
export function createClientLogger(options = {}) {
  const {
    localConsole = true,
    serverConsole = isServerLoggingEnabled
  } = options
  
  return {
    log: async (message, ...args) => {
      if (localConsole) console.log(message, ...args)
      if (serverConsole) await serverLog(String(message), 'info', { args })
    },
    
    info: async (message, ...args) => {
      if (localConsole) console.info(message, ...args)
      if (serverConsole) await serverLog(String(message), 'info', { args })
    },
    
    warn: async (message, ...args) => {
      if (localConsole) console.warn(message, ...args)
      if (serverConsole) await serverLog(String(message), 'warn', { args })
    },
    
    error: async (message, ...args) => {
      if (localConsole) console.error(message, ...args)
      if (serverConsole) await serverLog(String(message), 'error', { args })
    },
    
    debug: async (message, ...args) => {
      if (localConsole) console.debug(message, ...args)
      if (serverConsole) await serverLog(String(message), 'debug', { args })
    }
  }
}

// Export a default instance for quick usage
export const logger = createClientLogger() 