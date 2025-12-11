'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createCampaign, updateCampaign } from '@/lib/actions/campaigns'
import { getTags } from '@/lib/actions/tags'
import { getShortlinks } from '@/lib/actions/shortlinks'
import styles from './AddCampaignModal.module.css'

// Searchable Multi-Select Component
function SearchableMultiSelect({ 
  options, 
  selected, 
  onSelectionChange, 
  placeholder = "Search and select...",
  getOptionLabel = (opt) => opt,
  getOptionValue = (opt) => opt
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options
    const query = searchQuery.toLowerCase()
    return options.filter(opt => {
      const label = getOptionLabel(opt).toLowerCase()
      return label.includes(query)
    })
  }, [options, searchQuery, getOptionLabel])

  const handleToggle = (option) => {
    const value = getOptionValue(option)
    if (selected.includes(value)) {
      onSelectionChange(selected.filter(v => v !== value))
    } else {
      onSelectionChange([...selected, value])
    }
  }

  const handleRemove = (value, e) => {
    e.stopPropagation()
    onSelectionChange(selected.filter(v => v !== value))
  }

  const selectedLabels = useMemo(() => {
    return selected.map(val => {
      const option = options.find(opt => getOptionValue(opt) === val)
      return option ? getOptionLabel(option) : val
    })
  }, [selected, options, getOptionValue, getOptionLabel])

  return (
    <div className={styles.searchableSelect} ref={containerRef}>
      <div 
        className={styles.selectTrigger}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={styles.selectedItems}>
          {selectedLabels.length > 0 ? (
            selectedLabels.map((label, idx) => {
              const value = selected[idx]
              return (
                <span key={value} className={styles.selectedChip}>
                  {label}
                  <button
                    type="button"
                    onClick={(e) => handleRemove(value, e)}
                    className={styles.chipRemove}
                  >
                    ×
                  </button>
                </span>
              )
            })
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </div>
        <span className={styles.dropdownArrow}>{isOpen ? '▲' : '▼'}</span>
      </div>
      
      {isOpen && (
        <div className={styles.selectDropdown}>
          <div className={styles.searchInputWrapper}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className={styles.optionsList}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => {
                const value = getOptionValue(option)
                const label = getOptionLabel(option)
                const isSelected = selected.includes(value)
                return (
                  <div
                    key={value}
                    className={`${styles.optionItem} ${isSelected ? styles.optionSelected : ''}`}
                    onClick={() => handleToggle(option)}
                  >
                    <span className={styles.optionCheckbox}>
                      {isSelected ? '✓' : ''}
                    </span>
                    <span>{label}</span>
                  </div>
                )
              })
            ) : (
              <div className={styles.noResults}>No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AddCampaignModal({ campaign, onClose, onAdd, onUpdate }) {
  const isEditMode = !!campaign
  const [name, setName] = useState(campaign?.name || '')
  // Store actual URL text in state (not markers) - convert from markers on load
  const [messageText, setMessageText] = useState('')
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

  // Convert markers to URLs when loading campaign or when shortlinks are loaded
  useEffect(() => {
    if (campaign?.message) {
      if (availableShortlinks.length > 0) {
        // Convert markers to URLs
        const urlText = campaign.message.replace(/\{\{SHORTLINK:(\d+)\}\}/g, (match, id) => {
          const shortlink = availableShortlinks.find(s => s.id === parseInt(id, 10));
          const displayName = shortlink?.nickname || `link-${id}`;
          return `https://txt.cx/${displayName}`;
        });
        // Only update if different (avoid infinite loops)
        if (urlText !== messageText) {
          setMessageText(urlText);
        }
      } else if (!messageText) {
        // If no shortlinks loaded yet and messageText is empty, keep markers temporarily
        setMessageText(campaign.message);
      }
    } else if (!campaign && messageText) {
      setMessageText('');
    }
  }, [campaign?.message, availableShortlinks]);

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

  // Convert URLs back to markers before saving
  const convertUrlsToMarkers = (text) => {
    let converted = text;
    availableShortlinks.forEach(shortlink => {
      const url = `https://txt.cx/${shortlink.nickname || `link-${shortlink.id}`}`;
      const regex = new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      converted = converted.replace(regex, `{{SHORTLINK:${shortlink.id}}}`);
    });
    return converted;
  };

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    // Convert URLs to markers before saving
    const messageWithMarkers = convertUrlsToMarkers(messageText);
    
    try {
      if (isEditMode) {
        const updatedCampaign = await updateCampaign({
          id: campaign.id,
          name,
          message: messageWithMarkers,
          targetAllSubscribed,
          selectedTags: targetAllSubscribed ? [] : selectedTags,
          selectedSources: targetAllSubscribed ? [] : selectedSources
        })
        onUpdate?.(updatedCampaign)
      } else {
        const newCampaign = await createCampaign({
          name,
          message: messageWithMarkers,
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
                        // Insert actual URL text (not marker)
                        const url = `https://txt.cx/${shortlink.nickname || `link-${shortlink.id}`}`
                        setMessageText(prev => prev + (prev ? ' ' : '') + url)
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
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                required
                placeholder="Enter your SMS message"
                className={styles.textarea}
                rows={4}
              />
              <div 
                className={styles.messageDisplay}
                dangerouslySetInnerHTML={{ 
                  __html: (() => {
                    let formatted = messageText;
                    // Escape HTML first
                    formatted = formatted
                      .replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;');
                    
                    // Replace URLs with styled spans
                    formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, (url) => {
                      return `<span class="${styles.shortlinkUrl}">${url}</span>`;
                    });
                    return formatted;
                  })()
                }}
              />
            </div>
            <div className={styles.charCount}>
              Characters: {messageText.length}
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
                  <SearchableMultiSelect
                    options={availableTags}
                    selected={selectedTags}
                    onSelectionChange={setSelectedTags}
                    placeholder="Search and select tags..."
                    getOptionLabel={(tag) => tag.name}
                    getOptionValue={(tag) => tag.id}
                  />
                </div>

                <div className={styles.targetingGroup}>
                  <label className={styles.targetingLabel}>Select Sources (Optional)</label>
                  <SearchableMultiSelect
                    options={availableSources}
                    selected={selectedSources}
                    onSelectionChange={setSelectedSources}
                    placeholder="Search and select sources..."
                    getOptionLabel={(source) => source}
                    getOptionValue={(source) => source}
                  />
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