'use client'

import { useState, useEffect } from 'react'
import { updateShortlink } from '@/lib/actions/shortlinks'
import { getCampaigns } from '@/lib/actions/campaigns'
import styles from './AddShortlinkModal.module.css' // Reuse existing styles

export default function EditShortlinkModal({ shortlink, onClose, onUpdate }) {
  const [slug, setSlug] = useState(shortlink.slug)
  const [destination, setDestination] = useState(shortlink.destination)
  const [campaignId, setCampaignId] = useState(shortlink.campaignId || '')
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(false)
  
  // OG Preview fields
  const [ogEnabled, setOgEnabled] = useState(shortlink.ogEnabled || false)
  const [ogImage, setOgImage] = useState(shortlink.ogImage || '')
  const [ogTitle, setOgTitle] = useState(shortlink.ogTitle || '')
  const [ogDescription, setOgDescription] = useState(shortlink.ogDescription || '')
  const [uploading, setUploading] = useState(false)

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const updatedShortlink = await updateShortlink({
        id: shortlink.id,
        slug,
        destination,
        campaignId: campaignId || null,
        ogEnabled,
        ogImage: ogImage || null,
        ogTitle: ogTitle || null,
        ogDescription: ogDescription || null
      })
      onUpdate(updatedShortlink)
      onClose()
    } catch (error) {
      console.error('Error updating shortlink:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2>Edit Shortlink</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              placeholder="Enter shortlink slug"
              className={styles.input}
            />
          </div>
          
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
                        <div className={styles.previewUrl}>txt.cx/{slug}</div>
                      </div>
                    </div>
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