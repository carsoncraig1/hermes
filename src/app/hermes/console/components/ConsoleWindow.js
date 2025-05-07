'use client'

import { useEffect, useState } from 'react'
import { getLogs } from '@/lib/serverLogger'
import styles from './ConsoleWindow.module.css'

export default function ConsoleWindow({ compact = false }) {
  const [logs, setLogs] = useState([])

  useEffect(() => {
    const fetchLogs = async () => {
      const serverLogs = await getLogs()
      setLogs(serverLogs)
    }

    fetchLogs()
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={`${styles.consoleWindow} ${compact ? styles.compact : ''}`}>
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
  )
} 