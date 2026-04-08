'use client'

import { useState, useEffect } from 'react'
import styles from './AddShortlinkModal.module.css'
import { addShortlink } from '@/lib/actions/shortlinks'
import { getCampaigns } from '@/lib/actions/campaigns'
import { createScheduledRedirect } from '@/lib/actions/scheduledRedirects'
import {
  formatDateTimeInTimeZone,
  getCurrentDateInputValueInTimeZone,
  getEffectiveTimeZone,
  zonedDateTimeToUtcDate
} from '@/lib/timezone'
import { generateOCOLink, normalizeWebinarId } from '@/lib/ocoLink'

export default function AddShortlinkModal({ onClose, onAdd, userTimezone = null }) {
  const [type, setType] = useState('dynamic') // 'dynamic' or 'legacy'
  const [nickname, setNickname] = useState('')
  const [slug, setSlug] = useState('')
  const [destination, setDestination] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [enabled, setEnabled] = useState(true) // For legacy shortlinks
  
  // OG Preview fields
  const [ogEnabled, setOgEnabled] = useState(false)
  const [ogImage, setOgImage] = useState('')
  const [ogTitle, setOgTitle] = useState('')
  const [ogDescription, setOgDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  
  // Scheduled redirect fields
  const [scheduleRedirect, setScheduleRedirect] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduledDestination, setScheduledDestination] = useState('')
  const [ocoWebinarId, setOcoWebinarId] = useState('')
  const effectiveTimezone = getEffectiveTimeZone(userTimezone)
  const minScheduleDate = getCurrentDateInputValueInTimeZone(effectiveTimezone)

  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const data = await getCampaigns()
        setCampaigns(data)
      } catch (error) {
        console.error('Error loading campaigns:', error)
      }
    }
    loadCampaigns()
  }, [])

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload/og-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      setOgImage(data.url)
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Failed to upload image')
    } finally {
      setUploading(false)
    }
  }

  // Generate random 3-character slug
  const generateRandomSlug = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 3; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setSlug(result)
  }

  const handleGenerateOCO = () => {
    const url = generateOCOLink(ocoWebinarId)
    if (!url) return
    setDestination(url)
    if (error) setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      // Validate scheduled redirect if enabled
      if (scheduleRedirect) {
        if (!scheduleDate || !scheduleTime || !scheduledDestination) {
          alert('Please fill in all scheduled redirect fields (date, time, and new destination)')
          setLoading(false)
          return
        }
        
        // Validate scheduled time is in the future
        const scheduledDateTime = zonedDateTimeToUtcDate(`${scheduleDate}T${scheduleTime}`, effectiveTimezone)
        if (!scheduledDateTime || Number.isNaN(scheduledDateTime.getTime())) {
          alert('Please provide a valid scheduled date and time')
          setLoading(false)
          return
        }

        if (scheduledDateTime <= new Date()) {
          alert('Scheduled time must be in the future')
          setLoading(false)
          return
        }
      }
      
      const shortlink = await addShortlink({
        type,
        nickname: nickname || null,
        slug: type === 'legacy' ? slug.toLowerCase() : null,
        destination,
        enabled: type === 'legacy' ? enabled : true,
        campaignId: type === 'dynamic' ? (campaignId || null) : null,
        ogEnabled,
        ogImage: ogImage || null,
        ogTitle: ogTitle || null,
        ogDescription: ogDescription || null
      })
      
      // Create scheduled redirect if enabled
      if (scheduleRedirect && shortlink.id) {
        const scheduledDateTime = zonedDateTimeToUtcDate(`${scheduleDate}T${scheduleTime}`, effectiveTimezone)
        await createScheduledRedirect({
          shortlinkId: shortlink.id,
          newDestination: scheduledDestination,
          scheduledAt: scheduledDateTime.toISOString()
        })
      }
      
      onAdd(shortlink)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create shortlink')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Add Shortlink</h2>
          <button onClick={onClose} className={styles.closeButton}>&times;</button>
        </div>

        {/* Type Tabs */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${type === 'dynamic' ? styles.activeTab : ''}`}
            onClick={() => { setType('dynamic'); setError(null); }}
          >
            Dynamic
          </button>
          <button
            type="button"
            className={`${styles.tab} ${type === 'legacy' ? styles.activeTab : ''}`}
            onClick={() => { setType('legacy'); setError(null); }}
          >
            Legacy
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className={styles.errorMessage} role="alert">
              {error}
            </div>
          )}
          {type === 'dynamic' ? (
            <>
              <div className={styles.formGroup}>
                <label htmlFor="nickname">Nickname (Optional)</label>
                <input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    const valueWithoutSpaces = e.target.value.replace(/\s/g, '');
                    setNickname(valueWithoutSpaces);
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pastedText = e.clipboardData.getData('text').replace(/\s/g, '');
                    setNickname(pastedText);
                  }}
                  placeholder="Enter a friendly name (no spaces allowed)"
                  className={styles.input}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Spaces are not allowed in nicknames
                </small>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="oco-webinar-id">Zoom Webinar ID</label>
                <div className={styles.ocoRow}>
                  <input
                    id="oco-webinar-id"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={ocoWebinarId}
                    onChange={(e) => {
                      setOcoWebinarId(normalizeWebinarId(e.target.value))
                    }}
                    onPaste={(e) => {
                      e.preventDefault()
                      setOcoWebinarId(normalizeWebinarId(e.clipboardData.getData('text')))
                    }}
                    placeholder="e.g. 87824207928"
                    className={styles.input}
                  />
                  <button
                    type="button"
                    className={styles.ocoGenerateButton}
                    onClick={handleGenerateOCO}
                    disabled={!normalizeWebinarId(ocoWebinarId)}
                  >
                    <svg
                      className={styles.ocoZoomIcon}
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden
                    >
                      <path
                        fill="currentColor"
                        d="M4 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1.535l2.562-1.281A1 1 0 0 1 21 9.168V14.832a1 1 0 0 1-1.438.914L17 14.465V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8zm2 0v8h8V8H6zm9 1.465l3 1.5v2.07l-3 1.5v-5.07z"
                      />
                    </svg>
                    Generate One-Click Link
                  </button>
                </div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Fills destination with a One-Click Open URL using {'{{firstName}}'}, {'{{lastName}}'}, {'{{email}}'}, and {'{{phone}}'} — expanded when the contact opens the link.
                </small>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="destination">Destination URL</label>
                <input
                  id="destination"
                  type="url"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Enter destination URL"
                  className={styles.input}
                  required
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Optional per-recipient placeholders (dynamic shortlinks only): {'{{firstName}}'}, {'{{lastName}}'}, {'{{fullName}}'}, {'{{email}}'}, {'{{phone}}'}, {'{{source}}'}, {'{{age}}'}, {'{{id}}'}. Values are filled when the contact opens the link; they are not expanded for link-preview bots.
                </small>
              </div>

              <div className={styles.formGroup}>
                <label>Campaign (Optional)</label>
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  className={styles.input}
                >
                  <option value="">No Campaign</option>
                  {campaigns.map(campaign => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className={styles.formGroup}>
                <label htmlFor="slug">Slug (3 characters)</label>
                <div className={styles.inputWithButton}>
                  <input
                    id="slug"
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toLowerCase();
                      setSlug(value);
                      if (error) setError(null);
                    }}
                    placeholder="abc"
                    className={styles.input}
                    required
                    maxLength={3}
                    minLength={3}
                  />
                  <button
                    type="button"
                    onClick={generateRandomSlug}
                    className={styles.randomizeButton}
                    title="Generate random slug"
                  >
                    🎲
                  </button>
                </div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Your shortlink will be: txt.cx/{slug || 'abc'}
                </small>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="nickname">Nickname (Optional)</label>
                <input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    const valueWithoutSpaces = e.target.value.replace(/\s/g, '');
                    setNickname(valueWithoutSpaces);
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pastedText = e.clipboardData.getData('text').replace(/\s/g, '');
                    setNickname(pastedText);
                  }}
                  placeholder="Enter a friendly name (no spaces allowed)"
                  className={styles.input}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Spaces are not allowed in nicknames
                </small>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="destination">Destination URL</label>
                <input
                  id="destination"
                  type="url"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Enter destination URL"
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel} style={{ marginBottom: 0, textTransform: 'none', letterSpacing: 'normal', fontWeight: 'normal' }}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className={styles.checkbox}
                  />
                  <span>Enabled</span>
                </label>
              </div>
            </>
          )}

          {/* Scheduled Redirect Section */}
          <div className={styles.ogSection}>
            <div className={styles.ogToggle}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={scheduleRedirect}
                  onChange={(e) => setScheduleRedirect(e.target.checked)}
                  className={styles.checkbox}
                />
                <span>Schedule Redirect Change</span>
              </label>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem', display: 'block' }}>
                Times are interpreted in your configured timezone ({effectiveTimezone})
              </small>
            </div>

            {scheduleRedirect && (
              <div className={styles.ogFields}>
                <div className={styles.formGroup}>
                  <label>New Destination URL (after scheduled time)</label>
                  <input
                    type="url"
                    value={scheduledDestination}
                    onChange={(e) => setScheduledDestination(e.target.value)}
                    placeholder="https://example.com/new-destination"
                    className={styles.input}
                    required={scheduleRedirect}
                  />
                </div>

                <div className={styles.scheduleRow}>
                  <div className={styles.formGroup} style={{ flex: 1 }}>
                    <label>Date</label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      min={minScheduleDate}
                      className={styles.input}
                      required={scheduleRedirect}
                    />
                  </div>

                  <div className={styles.formGroup} style={{ flex: 1 }}>
                    <label>Time</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className={styles.input}
                      required={scheduleRedirect}
                    />
                  </div>
                </div>

                {scheduleDate && scheduleTime && (
                  <div className={styles.schedulePreview}>
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      Redirect will change on {formatDateTimeInTimeZone(
                        zonedDateTimeToUtcDate(`${scheduleDate}T${scheduleTime}`, effectiveTimezone),
                        effectiveTimezone
                      )} ({effectiveTimezone})
                    </small>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.ogSection}>
            <div className={styles.ogToggle}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={ogEnabled}
                  onChange={(e) => setOgEnabled(e.target.checked)}
                  className={styles.checkbox}
                />
                <span>Enable OG Preview (Link Preview Image)</span>
              </label>
            </div>

            {ogEnabled && (
              <div className={styles.ogFields}>
                <div className={styles.formGroup}>
                  <label>OG Image</label>
                  <div className={styles.uploadGroup}>
                    <input
                      type="url"
                      value={ogImage}
                      onChange={(e) => setOgImage(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className={styles.input}
                    />
                    <label className={styles.uploadButton}>
                      {uploading ? '...' : '📁'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                </div>
                
                <div className={styles.formGroup}>
                  <label>OG Title</label>
                  <input
                    type="text"
                    value={ogTitle}
                    onChange={(e) => setOgTitle(e.target.value)}
                    placeholder="Preview title"
                    className={styles.input}
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>OG Description</label>
                  <textarea
                    value={ogDescription}
                    onChange={(e) => setOgDescription(e.target.value)}
                    placeholder="Preview description"
                    className={styles.input}
                    rows={2}
                  />
                </div>

                {ogImage && (
                  <div className={styles.ogPreview}>
                    <label>Preview</label>
                    <div className={styles.previewCard}>
                      <img 
                        src={ogImage} 
                        alt="OG Preview" 
                        className={styles.previewImage}
                        onError={(e) => e.target.style.display = 'none'}
                      />
                      <div className={styles.previewText}>
                        <div className={styles.previewTitle}>{ogTitle || 'No title'}</div>
                        <div className={styles.previewDescription}>{ogDescription || 'No description'}</div>
                        <div className={styles.previewUrl}>
                          {type === 'legacy' ? `txt.cx/${slug || 'abc'}` : 'txt.cx/CODE (generated per message)'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.modalActions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className={styles.submitButton}>
              {loading ? 'Creating...' : 'Create Shortlink'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
