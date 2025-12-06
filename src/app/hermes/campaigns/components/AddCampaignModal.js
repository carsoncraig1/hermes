'use client'

import { useState, useEffect } from 'react'
import { createCampaign } from '@/lib/actions/campaigns'
import { getTags } from '@/lib/actions/tags'
import { getShortlinks } from '@/lib/actions/shortlinks'
import styles from './AddCampaignModal.module.css'

export default function AddCampaignModal({ onClose, onAdd }) {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [targetAllSubscribed, setTargetAllSubscribed] = useState(false)
  const [selectedTags, setSelectedTags] = useState([])
  const [selectedSources, setSelectedSources] = useState([])
  const [availableTags, setAvailableTags] = useState([])
  const [availableSources, setAvailableSources] = useState([])
  const [availableShortlinks, setAvailableShortlinks] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const tags = await getTags()
        setAvailableTags(tags)
        
        const shortlinks = await getShortlinks()
        setAvailableShortlinks(shortlinks)
        
        // Get unique sources from contacts
        const { getContacts } = await import('@/lib/actions/contacts')
        const contacts = await getContacts()
        const uniqueSources = [...new Set(contacts.map(c => c.source).filter(Boolean))].sort()
        setAvailableSources(uniqueSources)
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }
    loadData()
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
        selectedSources: targetAllSubscribed ? [] : selectedSources
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

  const handleSourceToggle = (source) => {
    setSelectedSources(prev => 
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
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
            <div className={styles.messageHeader}>
              <label>Message Content</label>
              {availableShortlinks.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      const shortlink = availableShortlinks.find(s => s.id === parseInt(e.target.value))
                      if (shortlink) {
                        const shortlinkUrl = `https://txt.cx/${shortlink.slug}`
                        setMessage(prev => prev + (prev ? ' ' : '') + shortlinkUrl)
                        e.target.value = ''
                      }
                    }
                  }}
                  className={styles.shortlinkSelect}
                  defaultValue=""
                >
                  <option value="">Insert Shortlink...</option>
                  {availableShortlinks.map(shortlink => (
                    <option key={shortlink.id} value={shortlink.id}>
                      {shortlink.nickname || shortlink.slug}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className={styles.messagePreview}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                placeholder="Enter your SMS message"
                className={styles.textarea}
                rows={4}
              />
              <div 
                className={styles.messageDisplay}
                dangerouslySetInnerHTML={{ 
                  __html: message.replace(/(https?:\/\/[^\s]+)/g, (url) => {
                    return `<span class="${styles.shortlinkUrl}">${url}</span>`
                  })
                }}
              />
            </div>
            <div className={styles.charCount}>
              Characters: {message.length}
            </div>
          </div>

          <div className={styles.formGroup}>
            <h3>Target Audience</h3>
            <div className={styles.targetAllContainer}>
              <input
                type="checkbox"
                id="targetAllSubscribed"
                checked={targetAllSubscribed}
                onChange={(e) => {
                  setTargetAllSubscribed(e.target.checked)
                  if (e.target.checked) {
                    setSelectedTags([])
                    setSelectedSources([])
                  }
                }}
                className={styles.checkbox}
              />
              <label htmlFor="targetAllSubscribed" className={styles.targetAllLabel}>
                TARGET ALL SUBSCRIBED CONTACTS
              </label>
            </div>

            {!targetAllSubscribed && (
              <div className={styles.targetingSection}>
                <div className={styles.targetingGroup}>
                  <label className={styles.targetingLabel}>Select Tags (Optional)</label>
                  <div className={styles.tagsGrid}>
                    {availableTags.length > 0 ? (
                      availableTags.map(tag => (
                        <label key={tag.id} className={styles.tagLabel}>
                          <input
                            type="checkbox"
                            checked={selectedTags.includes(tag.id)}
                            onChange={() => handleTagToggle(tag.id)}
                            className={styles.checkbox}
                          />
                          {tag.name}
                        </label>
                      ))
                    ) : (
                      <div className={styles.emptyState}>No tags available</div>
                    )}
                  </div>
                </div>

                <div className={styles.targetingGroup}>
                  <label className={styles.targetingLabel}>Select Sources (Optional)</label>
                  <div className={styles.tagsGrid}>
                    {availableSources.length > 0 ? (
                      availableSources.map(source => (
                        <label key={source} className={styles.tagLabel}>
                          <input
                            type="checkbox"
                            checked={selectedSources.includes(source)}
                            onChange={() => handleSourceToggle(source)}
                            className={styles.checkbox}
                          />
                          {source}
                        </label>
                      ))
                    ) : (
                      <div className={styles.emptyState}>No sources available</div>
                    )}
                  </div>
                </div>

                {selectedTags.length === 0 && selectedSources.length === 0 && (
                  <div className={styles.warning}>
                    Please select at least one tag or source (or target all subscribed)
                  </div>
                )}
              </div>
            )}
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
              disabled={loading || (!targetAllSubscribed && selectedTags.length === 0 && selectedSources.length === 0)}
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