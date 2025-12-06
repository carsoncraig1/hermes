'use client'

import { useEffect, useState } from 'react'
import styles from './page.module.css'
import { getLogs, clearLogs } from '@/lib/serverLogger'

export default function Console() {
  const [logs, setLogs] = useState([])

  useEffect(() => {
    const fetchLogs = async () => {
      const serverLogs = await getLogs()
      setLogs(serverLogs)
    }

    fetchLogs()
    
    // Poll for new logs every 5 seconds
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
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Console</h1>
      </header>
      <div className="dashboard-content">
        <div className={styles.consoleWindow}>
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
      </div>
    </div>
  )
} 