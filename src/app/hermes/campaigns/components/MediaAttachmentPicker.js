'use client'

import { useState } from 'react'
import styles from './MediaAttachmentPicker.module.css'

export default function MediaAttachmentPicker({ value, onChange, sectionLabel = 'Contact card (.vcf)' }) {
  const [mode, setMode] = useState(null) // null | 'saved' | 'create' | 'upload'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Saved assets list
  const [savedAssets, setSavedAssets] = useState([])
  const [savedLoaded, setSavedLoaded] = useState(false)

  // Create card form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [org, setOrg] = useState('')
  const [title, setTitle] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')

  const resetCreateForm = () => {
    setFirstName('')
    setLastName('')
    setOrg('')
    setTitle('')
    setPhone('')
    setEmail('')
    setUrl('')
    setNote('')
  }

  const closeMode = () => {
    setMode(null)
    setError(null)
  }

  const openSaved = async () => {
    setError(null)
    setMode('saved')
    if (savedLoaded) return
    setLoading(true)
    try {
      const res = await fetch('/api/media?kind=vcard')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load saved cards')
      }
      setSavedAssets(Array.isArray(data?.assets) ? data.assets : [])
      setSavedLoaded(true)
    } catch (err) {
      setError(err.message || 'Failed to load saved cards')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectSaved = (asset) => {
    onChange?.(asset)
    closeMode()
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const body = {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        org: org || undefined,
        title: title || undefined,
        url: url || undefined,
        note: note || undefined,
      }
      if (phone) body.phones = [phone]
      if (email) body.emails = [email]

      const res = await fetch('/api/media/vcard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create card')
      }
      onChange?.(data.asset)
      resetCreateForm()
      closeMode()
    } catch (err) {
      setError(err.message || 'Failed to create card')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('label', file.name)

      const res = await fetch('/api/media/vcard', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to upload card')
      }
      onChange?.(data.asset)
      closeMode()
    } catch (err) {
      setError(err.message || 'Failed to upload card')
    } finally {
      setLoading(false)
      // Allow re-selecting the same file later
      e.target.value = ''
    }
  }

  // Attached state
  if (value) {
    return (
      <div className={styles.picker}>
        <span className={styles.label}>{sectionLabel}</span>
        <div className={styles.attached}>
          <span className={styles.attachedIcon} aria-hidden>📎</span>
          <span className={styles.attachedLabel}>{value.label || value.filename || 'Contact card'}</span>
          <button
            type="button"
            className={styles.removeButton}
            onClick={() => onChange?.(null)}
          >
            Remove
          </button>
        </div>
        <p className={styles.mmsNote}>
          Attaching a card sends this as MMS (US &amp; Canada only, higher per-message cost).
        </p>
      </div>
    )
  }

  return (
    <div className={styles.picker}>
      <span className={styles.label}>{sectionLabel}</span>

      {!mode && (
        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={openSaved}
            disabled={loading}
          >
            Choose saved
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => { setError(null); setMode('create') }}
            disabled={loading}
          >
            Create card
          </button>
          <label className={styles.uploadButton}>
            Upload .vcf
            <input
              type="file"
              accept=".vcf,text/vcard"
              onChange={handleUpload}
              disabled={loading}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      )}

      {mode === 'saved' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Saved cards</span>
            <button type="button" className={styles.closeButton} onClick={closeMode}>
              Cancel
            </button>
          </div>
          {loading ? (
            <div className={styles.muted}>Loading…</div>
          ) : savedAssets.length > 0 ? (
            <div className={styles.savedList}>
              {savedAssets.map((asset) => (
                <button
                  type="button"
                  key={asset.id}
                  className={styles.savedItem}
                  onClick={() => handleSelectSaved(asset)}
                >
                  <span className={styles.attachedIcon} aria-hidden>📇</span>
                  <span className={styles.savedItemLabel}>{asset.label || asset.filename || 'Contact card'}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.muted}>No saved cards yet.</div>
          )}
        </div>
      )}

      {mode === 'create' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Create card</span>
            <button type="button" className={styles.closeButton} onClick={closeMode}>
              Cancel
            </button>
          </div>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>First name</label>
              <input
                type="text"
                className={styles.input}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Last name</label>
              <input
                type="text"
                className={styles.input}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Organization</label>
              <input
                type="text"
                className={styles.input}
                value={org}
                onChange={(e) => setOrg(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Title</label>
              <input
                type="text"
                className={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Phone</label>
              <input
                type="text"
                className={styles.input}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Email</label>
              <input
                type="text"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Website</label>
              <input
                type="text"
                className={styles.input}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.fieldLabel}>Note</label>
              <input
                type="text"
                className={styles.input}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.panelActions}>
            <button
              type="button"
              className={styles.saveButton}
              onClick={handleCreate}
              disabled={loading}
            >
              {loading ? 'Saving…' : 'Save card'}
            </button>
          </div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}
