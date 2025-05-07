'use client'

import { useState, useEffect } from 'react'
import styles from './ShortlinksTable.module.css'
import { getShortlinks, deleteShortlink, updateShortlink } from '@/lib/actions/shortlinks'
import AddShortlinkModal from './AddShortlinkModal'
import EditShortlinkModal from './EditShortlinkModal'

export default function ShortlinksTable({ initialShortlinks }) {
  const [shortlinks, setShortlinks] = useState(initialShortlinks)
  const [filteredShortlinks, setFilteredShortlinks] = useState(initialShortlinks)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingShortlink, setEditingShortlink] = useState(null)

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredShortlinks(shortlinks)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = shortlinks.filter(link => 
      link.slug.toLowerCase().includes(query) ||
      link.destination.toLowerCase().includes(query)
    )
    setFilteredShortlinks(filtered)
  }, [searchQuery, shortlinks])

  const handleSync = async () => {
    setLoading(true)
    try {
      const fresh = await getShortlinks()
      setShortlinks(fresh)
      setFilteredShortlinks(fresh)
    } catch (error) {
      console.error('Error syncing shortlinks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this shortlink?')) return
    
    try {
      setLoading(true)
      await deleteShortlink(id)
      setShortlinks(shortlinks.filter(link => link.id !== id))
      setFilteredShortlinks(filteredShortlinks.filter(link => link.id !== id))
    } catch (error) {
      console.error('Error deleting shortlink:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (newShortlink) => {
    setShortlinks([newShortlink, ...shortlinks])
    setFilteredShortlinks([newShortlink, ...filteredShortlinks])
  }

  const handleEdit = (shortlink) => {
    setEditingShortlink(shortlink)
  }

  const handleUpdate = (updatedShortlink) => {
    setShortlinks(shortlinks.map(s => 
      s.id === updatedShortlink.id ? updatedShortlink : s
    ))
    setFilteredShortlinks(filteredShortlinks.map(s => 
      s.id === updatedShortlink.id ? updatedShortlink : s
    ))
    setEditingShortlink(null)
  }

  if (loading) {
    return <div className={styles.loading}>Loading...</div>
  }

  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableHeader}>
        <div className={styles.tableControls}>
          <div className={styles.filters}>
            <button 
              className={styles.syncButton}
              onClick={handleSync}
              disabled={loading}
            >
              ↻ Refresh
            </button>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            <div className={styles.showing}>
              Showing {filteredShortlinks.length} of {shortlinks.length}
            </div>
          </div>
          <button 
            className={styles.addRecord}
            onClick={() => setShowAddModal(true)}
          >
            Add Shortlink
          </button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Slug</th>
              <th>Destination</th>
              <th>Campaign</th>
              <th>Clicks</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredShortlinks.map((link) => (
              <tr key={link.id}>
                <td>{link.slug}</td>
                <td>{link.destination}</td>
                <td>
                  {link.campaign?.name ? (
                    <span className={styles.campaign}>{link.campaign.name}</span>
                  ) : (
                    <span className={styles.noCampaign}>-</span>
                  )}
                </td>
                <td>{link.clicks}</td>
                <td>{new Date(link.createdAt).toLocaleDateString()}</td>
                <td className={styles.actions}>
                  <button 
                    onClick={() => handleEdit(link)}
                    className={styles.actionButton}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(link.id)}
                    className={styles.actionButton}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingShortlink && (
        <EditShortlinkModal
          shortlink={editingShortlink}
          onClose={() => setEditingShortlink(null)}
          onUpdate={handleUpdate}
        />
      )}

      {showAddModal && (
        <AddShortlinkModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  )
} 