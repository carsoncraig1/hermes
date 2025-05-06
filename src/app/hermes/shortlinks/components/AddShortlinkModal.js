'use client'

import { useState } from 'react'
import styles from './AddShortlinkModal.module.css'
import { addShortlink } from '@/lib/actions/shortlinks'

function generateRandomSlug(length = 3) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('')
}

export default function AddShortlinkModal({ onClose, onAdd }) {
  const [formData, setFormData] = useState({
    slug: '',
    destination: '',
  })

  const handleRandomize = () => {
    setFormData(prev => ({
      ...prev,
      slug: generateRandomSlug()
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const shortlink = await addShortlink(formData)
      onAdd(shortlink)
      onClose()
    } catch (error) {
      console.error('Error adding shortlink:', error)
    }
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Add Shortlink</h2>
          <button onClick={onClose} className={styles.closeButton}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="slug">Slug</label>
            <div className={styles.inputWithButton}>
              <input
                id="slug"
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="Enter slug or randomize"
                required
              />
              <button 
                type="button" 
                onClick={handleRandomize}
                className={styles.randomizeButton}
              >
                🎲
              </button>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="destination">Destination URL</label>
            <input
              id="destination"
              type="url"
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              placeholder="Enter destination URL"
              required
            />
          </div>
          <div className={styles.modalActions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancel
            </button>
            <button type="submit" className={styles.submitButton}>
              Create Shortlink
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 