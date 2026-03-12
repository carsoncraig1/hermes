'use client'

import { useState, useEffect } from 'react'
import { updateCampaign } from '@/lib/actions/campaigns'
import { getTags } from '@/lib/actions/tags'
import { validateMessage, getSuggestedReplacement } from '@/lib/messageUtils'
import styles from './AddCampaignModal.module.css'

export default function EditCampaignModal({ campaign, onClose, onUpdate }) {
  const [name, setName] = useState(campaign.name)
  const [message, setMessage] = useState(campaign.message)
  const [targetAllSubscribed, setTargetAllSubscribed] = useState(
    campaign.targets.some(target => target.targetType === 'ALL_SUBSCRIBED')
  )
  const [selectedTags, setSelectedTags] = useState(
    campaign.targets
      .filter(target => target.targetType === 'TAG')
      .map(target => target.tagId)
  )
  const [availableTags, setAvailableTags] = useState([])
  const [optOutText, setOptOutText] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [tags, optOutRes] = await Promise.all([
          getTags(),
          fetch('/api/user/opt-out-text')
        ])
        setAvailableTags(tags)
        if (optOutRes.ok) {
          const { optOutText: text } = await optOutRes.json()
          setOptOutText(text || '')
        }
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
      const updatedCampaign = await updateCampaign({
        id: campaign.id,
        name,
        message,
        targetAllSubscribed,
        selectedTags: targetAllSubscribed ? [] : selectedTags
      })
      onUpdate(updatedCampaign)
      onClose()
    } catch (error) {
      console.error('Error updating campaign:', error)
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
        <h2>Edit Campaign</h2>
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
            {(() => {
              const effectiveMessage = optOutText
                ? `${message}${message ? '\n\n' : ''}${optOutText}`
                : message
              const validation = validateMessage(effectiveMessage)
              const messageSuggestion = getSuggestedReplacement(message)
              return (
                <>
                  <div className={styles.charCount}>
                    {optOutText ? (
                      <>Characters: {validation.characterCount} (message: {message.length} + opt-out: {optOutText.length + (message ? 2 : 0)})</>
                    ) : (
                      <>Characters: {validation.characterCount}</>
                    )}
                    {validation.parts > 0 && (
                      <span> • Est. {validation.parts} part{validation.parts !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {validation.encodingWarning && (
                    <div className={styles.encodingWarning}>
                      <p><strong>Warning:</strong> {validation.encodingWarning}</p>
                      {validation.nonGsmChars?.length > 0 && (
                        <p>Non-GSM characters: {validation.nonGsmChars.map(c => `"${c}"`).join(', ')}</p>
                      )}
                      {messageSuggestion.hasReplacement && (
                        <button
                          type="button"
                          className={styles.replaceButton}
                          onClick={() => setMessage(messageSuggestion.fixedText)}
                        >
                          Replace with ASCII equivalents
                        </button>
                      )}
                    </div>
                  )}
                </>
              )
            })()}
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
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 