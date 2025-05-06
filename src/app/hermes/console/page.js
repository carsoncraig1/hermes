'use client'

import { useEffect, useState } from 'react'
import { logger } from '@/lib/clientLogger'
import styles from './page.module.css'
import { getLogs } from '@/lib/serverLogger'

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
              onClick={() => setLogs([])}
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
              logs.map((log, index) => (
                <div 
                  key={index} 
                  className={`${styles.logEntry} ${styles[log.level]}`}
                >
                  <span className={styles.timestamp}>{log.timestamp}</span>
                  <span className={styles.level}>[{log.level.toUpperCase()}]</span>
                  <span className={styles.message}>{log.message}</span>
                  {log.meta && (
                    <span className={styles.meta}>{JSON.stringify(log.meta)}</span>
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