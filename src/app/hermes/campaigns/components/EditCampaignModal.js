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
  const [selectedSources, setSelectedSources] = useState(
    campaign.targets
      .filter(target => target.targetType === 'SOURCE')
      .map(target => target.sourceValue)
  )
  const [selectedLists, setSelectedLists] = useState(
    campaign.targets
      .filter(target => target.targetType === 'LIST')
      .map(target => parseInt(target.sourceValue, 10))
      .filter(Number.isInteger)
  )
  const [availableTags, setAvailableTags] = useState([])
  const [availableSources, setAvailableSources] = useState([])
  const [availableLists, setAvailableLists] = useState([])
  const [optOutText, setOptOutText] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [tags, optOutRes, phoneNumbersRes] = await Promise.all([
          getTags(),
          fetch('/api/user/opt-out-text'),
          fetch('/api/user/phone-numbers')
        ])
        setAvailableTags(tags)
        if (optOutRes.ok) {
          const { optOutText: text } = await optOutRes.json()
          setOptOutText(text || '')
        }
        if (phoneNumbersRes.ok) {
          const data = await phoneNumbersRes.json()
          setAvailableLists(data.phoneNumbers || [])
        }
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
      const updatedCampaign = await updateCampaign({
        id: campaign.id,
        name,
        message,
        targetAllSubscribed,
        selectedTags: targetAllSubscribed ? [] : selectedTags,
        selectedSources: targetAllSubscribed ? [] : selectedSources,
        selectedLists: targetAllSubscribed ? [] : selectedLists
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
                    setSelectedSources([])
                    setSelectedLists([])
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
                <label style={{ marginTop: '1rem', display: 'block' }}>Select Sources</label>
                <div className={styles.tagsGrid}>
                  {availableSources.map(source => (
                    <label key={source} className={styles.tagLabel}>
                      <input
                        type="checkbox"
                        checked={selectedSources.includes(source)}
                        onChange={() => {
                          setSelectedSources(prev =>
                            prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
                          )
                        }}
                        className={styles.checkbox}
                      />
                      {source}
                    </label>
                  ))}
                </div>

                <label style={{ marginTop: '1rem', display: 'block' }}>Select Lists</label>
                <div className={styles.tagsGrid}>
                  {availableLists.map(list => (
                    <label key={list.id} className={styles.tagLabel}>
                      <input
                        type="checkbox"
                        checked={selectedLists.includes(list.id)}
                        onChange={() => {
                          setSelectedLists(prev =>
                            prev.includes(list.id) ? prev.filter(id => id !== list.id) : [...prev, list.id]
                          )
                        }}
                        className={styles.checkbox}
                      />
                      {(list.friendlyName || 'Unnamed')} ({list.phoneNumber})
                    </label>
                  ))}
                </div>

                {selectedTags.length === 0 && selectedSources.length === 0 && selectedLists.length === 0 && (
                  <div className={styles.warning}>
                    Please select at least one tag, source, or list
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
              disabled={loading || (!targetAllSubscribed && selectedTags.length === 0 && selectedSources.length === 0 && selectedLists.length === 0)}
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