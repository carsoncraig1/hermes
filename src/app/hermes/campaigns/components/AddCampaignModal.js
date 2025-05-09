'use client'

import { useState, useEffect } from 'react'
import { createCampaign } from '@/lib/actions/campaigns'
import { getTags } from '@/lib/actions/tags'
import styles from './AddCampaignModal.module.css'

export default function AddCampaignModal({ onClose, onAdd, numbers = [] }) {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [targetAllSubscribed, setTargetAllSubscribed] = useState(false)
  const [selectedTags, setSelectedTags] = useState([])
  const [availableTags, setAvailableTags] = useState([])
  const [selectedNumbers, setSelectedNumbers] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await getTags()
        setAvailableTags(tags)
      } catch (error) {
        console.error('Error loading tags:', error)
      }
    }
    loadTags()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const campaign = await createCampaign({
        name,
        message,
        targetAllSubscribed,
        selectedTags: targetAllSubscribed ? [] : selectedTags,
        numbers: selectedNumbers
      })
      onAdd(campaign)
      onClose()
    } catch (error) {
      console.error('Error creating campaign:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTagToggle = (tagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2>Create New Campaign</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Campaign Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Enter campaign name"
              className={styles.input}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Message Content</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              placeholder="Enter your SMS message"
              className={styles.textarea}
              rows={4}
            />
            <div className={styles.charCount}>
              Characters: {message.length}
            </div>
          </div>

          <div className={styles.formGroup}>
            <h3>Target Audience</h3>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={targetAllSubscribed}
                onChange={(e) => {
                  setTargetAllSubscribed(e.target.checked)
                  if (e.target.checked) {
                    setSelectedTags([])
                  }
                }}
                className={styles.checkbox}
              />
              Target All Subscribed Contacts
            </label>

            {!targetAllSubscribed && (
              <div className={styles.tagsSection}>
                <label>Select Tags</label>
                <div className={styles.tagsGrid}>
                  {availableTags.map(tag => (
                    <label key={tag.id} className={styles.tagLabel}>
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag.id)}
                        onChange={() => handleTagToggle(tag.id)}
                        className={styles.checkbox}
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
                {selectedTags.length === 0 && (
                  <div className={styles.warning}>
                    Please select at least one tag
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label>Attach Numbers</label>
            <div className={styles.tagsGrid}>
              {numbers.map(num => (
                <label key={num.id} className={styles.tagLabel}>
                  <input
                    type="checkbox"
                    checked={selectedNumbers.includes(num.id)}
                    onChange={() => setSelectedNumbers(prev =>
                      prev.includes(num.id)
                        ? prev.filter(id => id !== num.id)
                        : [...prev, num.id]
                    )}
                    className={styles.checkbox}
                  />
                  {num.phoneNumber}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.actions}>
            <button 
              type="button" 
              onClick={onClose}
              className={styles.cancelButton}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading || (!targetAllSubscribed && selectedTags.length === 0)}
              className={styles.submitButton}
            >
              {loading ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 