'use client'

import { useEffect, useState } from 'react'
import { getLogs, clearLogs } from '@/lib/serverLogger'
import styles from './ConsoleWindow.module.css'

export default function ConsoleWindow({ compact = false, initialLogs = [] }) {
  // OPTIMIZED: Use pre-fetched logs from server
  const [logs, setLogs] = useState(initialLogs)

  useEffect(() => {
    // Only poll for updates, don't fetch immediately (data already loaded)
    const fetchLogs = async () => {
      const serverLogs = await getLogs()
      setLogs(serverLogs)
    }

    // Start polling after 5 seconds (initial data already present)
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleClear = async () => {
    try {
      await clearLogs()
      setLogs([])
    } catch (error) {
      console.error('Error clearing logs:', error)
    }
  }

  return (
    <div className={`${styles.consoleWindow} ${compact ? styles.compact : ''}`}>
      <div className={styles.consoleHeader}>
        <span>Console</span>
        <button 
          className={styles.clearButton}
          onClick={handleClear}
        >
          Clear
        </button>
      </div>
      <div className={styles.consoleBody}>
        {logs.length === 0 ? (
          <div className={styles.emptyState}>
            No logs to display
          </div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id || log.timestamp} 
              className={`${styles.logEntry} ${styles[log.level]}`}
            >
              <span className={styles.timestamp}>{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span className={styles.level}>[{log.level.toUpperCase()}]</span>
              <span className={styles.message}>{log.message}</span>
              {log.meta && (
                <span className={styles.meta}>{JSON.stringify(log.meta, null, 2)}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
} 