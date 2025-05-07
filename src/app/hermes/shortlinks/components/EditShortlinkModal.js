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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const updatedShortlink = await updateShortlink({
        id: shortlink.id,
        slug,
        destination,
        campaignId: campaignId || null
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