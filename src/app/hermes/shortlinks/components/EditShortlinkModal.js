'use client'

import { useState, useEffect } from 'react'
import { updateShortlink } from '@/lib/actions/shortlinks'
import { getCampaigns } from '@/lib/actions/campaigns'
import { createScheduledRedirect, getScheduledRedirects, cancelScheduledRedirect } from '@/lib/actions/scheduledRedirects'
import styles from './AddShortlinkModal.module.css' // Reuse existing styles

export default function EditShortlinkModal({ shortlink, onClose, onUpdate }) {
  const isLegacy = shortlink.type === 'legacy'
  const [nickname, setNickname] = useState(shortlink.nickname || '')
  const [slug, setSlug] = useState(shortlink.slug || '')
  const [destination, setDestination] = useState(shortlink.destination)
  const [campaignId, setCampaignId] = useState(shortlink.campaignId || '')
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [enabled, setEnabled] = useState(shortlink.enabled !== undefined ? shortlink.enabled : true)
  
  // OG Preview fields
  const [ogEnabled, setOgEnabled] = useState(shortlink.ogEnabled || false)
  const [ogImage, setOgImage] = useState(shortlink.ogImage || '')
  const [ogTitle, setOgTitle] = useState(shortlink.ogTitle || '')
  const [ogDescription, setOgDescription] = useState(shortlink.ogDescription || '')
  const [uploading, setUploading] = useState(false)
  
  // Scheduled redirect fields
  const [scheduleRedirect, setScheduleRedirect] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduledDestination, setScheduledDestination] = useState('')
  const [existingScheduledRedirects, setExistingScheduledRedirects] = useState([])

  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const data = await getCampaigns()
        setCampaigns(data)
      } catch (error) {
        console.error('Error loading campaigns:', error)
      }
    }
    const loadScheduledRedirects = async () => {
      try {
        const data = await getScheduledRedirects(shortlink.id)
        setExistingScheduledRedirects(data)
      } catch (error) {
        console.error('Error loading scheduled redirects:', error)
      }
    }
    loadCampaigns()
    loadScheduledRedirects()
  }, [shortlink.id])

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
        const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`)
        if (scheduledDateTime <= new Date()) {
          alert('Scheduled time must be in the future')
          setLoading(false)
          return
        }
      }
      
      const updatedShortlink = await updateShortlink({
        id: shortlink.id,
        nickname: nickname || null,
        slug: isLegacy ? (slug.toLowerCase() || null) : null,
        destination,
        enabled: isLegacy ? enabled : undefined,
        campaignId: isLegacy ? null : (campaignId || null),
        ogEnabled,
        ogImage: ogImage || null,
        ogTitle: ogTitle || null,
        ogDescription: ogDescription || null
      })
      
      // Create scheduled redirect if enabled
      if (scheduleRedirect) {
        const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`)
        await createScheduledRedirect({
          shortlinkId: shortlink.id,
          newDestination: scheduledDestination,
          scheduledAt: scheduledDateTime.toISOString()
        })
      }
      
      onUpdate(updatedShortlink)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update shortlink')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelScheduled = async (id) => {
    if (!confirm('Are you sure you want to cancel this scheduled redirect?')) return
    
    try {
      await cancelScheduledRedirect(id)
      setExistingScheduledRedirects(existingScheduledRedirects.filter(r => r.id !== id))
    } catch (error) {
      console.error('Error cancelling scheduled redirect:', error)
      alert(error.message || 'Failed to cancel scheduled redirect')
    }
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Edit {isLegacy ? 'Legacy' : 'Dynamic'} Shortlink</h2>
          <button onClick={onClose} className={styles.closeButton}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className={styles.errorMessage} role="alert">
              {error}
            </div>
          )}
          {isLegacy ? (
            <>
              <div className={styles.formGroup}>
                <label>Slug (3 characters)</label>
                <input
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
                  disabled
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Slug cannot be changed after creation. Your shortlink: txt.cx/{slug || 'abc'}
                </small>
              </div>

              <div className={styles.formGroup}>
                <label>Nickname (Optional)</label>
                <input
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
              </div>
            </>
          ) : (
            <>
              <div className={styles.formGroup}>
                <label>Nickname (Optional)</label>
                <input
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
          )}
          
          <div className={styles.formGroup}>
            <label>Destination URL</label>
            <input
              type="url"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
              placeholder="Enter destination URL"
              className={styles.input}
            />
          </div>

          {isLegacy && (
            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className={styles.checkbox}
                />
                <span>Enabled</span>
              </label>
            </div>
          )}

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
                          {isLegacy ? `txt.cx/${slug || 'abc'}` : 'txt.cx/CODE (generated per message)'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

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
                Times are interpreted in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone})
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
                      min={new Date().toISOString().split('T')[0]}
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
                      Redirect will change on {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                    </small>
                  </div>
                )}
              </div>
            )}

            {/* Existing Scheduled Redirects */}
            {existingScheduledRedirects.length > 0 && (
              <div className={styles.existingScheduled}>
                <label style={{ marginTop: '1rem', marginBottom: '0.5rem', display: 'block', color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Existing Scheduled Redirects
                </label>
                {existingScheduledRedirects.map((redirect) => (
                  <div key={redirect.id} className={styles.scheduledItem}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text-primary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                        {redirect.newDestination}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        Scheduled: {new Date(redirect.scheduledAt).toLocaleString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone}) • Status: {redirect.status}
                      </div>
                    </div>
                    {redirect.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleCancelScheduled(redirect.id)}
                        className={styles.cancelScheduledButton}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
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
              disabled={loading}
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