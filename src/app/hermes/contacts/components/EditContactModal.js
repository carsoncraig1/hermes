'use client'

import { useState } from 'react'
import styles from './AddContactModal.module.css'

export default function EditContactModal({ contact, onClose, onUpdate }) {
  // Handle clickid as array - convert to comma-separated string for display
  const clickidDisplay = Array.isArray(contact.clickid) 
    ? contact.clickid.join(', ') 
    : (contact.clickid || '')

  const [formState, setFormState] = useState({
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    email: contact.email || '',
    phone: contact.phone || '',
    clickid: clickidDisplay,
    source: contact.source || '',
    age: contact.age || '',
    ip: contact.ip || '',
    useragent: contact.useragent || '',
    referrer: contact.referrer || '',
    subscribed: contact.subscribed || false,
    tags: contact.tags?.map(tag => tag.name) || []
  })

  const [tagInput, setTagInput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Convert clickid to array
      let clickidArray = []
      if (formState.clickid) {
        clickidArray = formState.clickid.split(',').map(c => c.trim()).filter(c => c)
      }
      
      const submitData = {
        id: contact.id,
        firstName: formState.firstName || null,
        lastName: formState.lastName || null,
        email: formState.email || null,
        phone: formState.phone,
        clickId: clickidArray.length > 0 ? clickidArray : [],
        source: formState.source || null,
        age: formState.age || null,
        ip: formState.ip || null,
        useragent: formState.useragent || null,
        referrer: formState.referrer || null,
        subscribed: formState.subscribed,
        tags: formState.tags
      }
      await onUpdate(submitData)
      onClose()
    } catch (error) {
      console.error('Error updating contact:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormState(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim()
      if (!formState.tags.includes(newTag)) {
        setFormState(prev => ({
          ...prev,
          tags: [...prev.tags, newTag]
        }))
      }
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove) => {
    setFormState(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Edit Contact</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="phone">Phone *</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formState.phone}
              onChange={handleChange}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formState.firstName}
              onChange={handleChange}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formState.lastName}
              onChange={handleChange}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formState.email}
              onChange={handleChange}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="clickid">Click IDs (comma-separated)</label>
            <input
              type="text"
              id="clickid"
              name="clickid"
              value={formState.clickid}
              onChange={handleChange}
              placeholder="click1, click2, click3"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="source">Source</label>
            <input
              type="text"
              id="source"
              name="source"
              value={formState.source}
              onChange={handleChange}
              placeholder="e.g., facebook, google, direct"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="age">Age</label>
            <input
              type="text"
              id="age"
              name="age"
              value={formState.age}
              onChange={handleChange}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="ip">IP Address</label>
            <input
              type="text"
              id="ip"
              name="ip"
              value={formState.ip}
              onChange={handleChange}
              placeholder="192.168.1.1"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="useragent">User Agent</label>
            <textarea
              id="useragent"
              name="useragent"
              value={formState.useragent}
              onChange={handleChange}
              rows={2}
              placeholder="Mozilla/5.0..."
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="referrer">Referrer</label>
            <input
              type="text"
              id="referrer"
              name="referrer"
              value={formState.referrer}
              onChange={handleChange}
              placeholder="https://example.com"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="subscribed"
                checked={formState.subscribed}
                onChange={handleChange}
              />
              Subscribed
            </label>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="tags">Tags</label>
            <div className={styles.tagInput}>
              <div className={styles.tagContainer}>
                {formState.tags.map((tag, index) => (
                  <span key={index} className={styles.tag}>
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className={styles.removeTag}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Type and press Enter to add tags"
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button 
              type="button" 
              onClick={onClose} 
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
