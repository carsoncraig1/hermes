'use client'

import { useState, useEffect } from 'react'
import { createCampaign, updateCampaign } from '@/lib/actions/campaigns'
import { getTags } from '@/lib/actions/tags'
import { getShortlinks } from '@/lib/actions/shortlinks'
import styles from './AddCampaignModal.module.css'

export default function AddCampaignModal({ campaign, onClose, onAdd, onUpdate }) {
  const isEditMode = !!campaign
  const [name, setName] = useState(campaign?.name || '')
  const [message, setMessage] = useState(campaign?.message || '')
  const [targetAllSubscribed, setTargetAllSubscribed] = useState(
    campaign?.targets?.some(target => target.targetType === 'ALL_SUBSCRIBED') || false
  )
  const [selectedTags, setSelectedTags] = useState(
    campaign?.targets?.filter(target => target.targetType === 'TAG').map(target => target.tagId) || []
  )
  const [selectedSources, setSelectedSources] = useState(
    campaign?.targets?.filter(target => target.targetType === 'SOURCE').map(target => target.sourceValue) || []
  )
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
      if (isEditMode) {
        const updatedCampaign = await updateCampaign({
          id: campaign.id,
          name,
          message,
          targetAllSubscribed,
          selectedTags: targetAllSubscribed ? [] : selectedTags,
          selectedSources: targetAllSubscribed ? [] : selectedSources
        })
        onUpdate?.(updatedCampaign)
      } else {
        const newCampaign = await createCampaign({
          name,
          message,
          targetAllSubscribed,
          selectedTags: targetAllSubscribed ? [] : selectedTags,
          selectedSources: targetAllSubscribed ? [] : selectedSources
        })
        onAdd?.(newCampaign)
      }
      onClose()
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} campaign:`, error)
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
        <h2>{isEditMode ? 'Edit Campaign' : 'Create New Campaign'}</h2>
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
                        // Insert marker format that will be replaced with code when sending
                        const shortlinkMarker = `{{SHORTLINK:${shortlink.id}}}`
                        setMessage(prev => prev + (prev ? ' ' : '') + shortlinkMarker)
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
                      {shortlink.nickname || `Shortlink #${shortlink.id}`}
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
              {loading ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Campaign')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 