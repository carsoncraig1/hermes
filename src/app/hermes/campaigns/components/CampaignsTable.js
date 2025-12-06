'use client'

import { useState, useEffect } from 'react'
import styles from './CampaignsTable.module.css'
import { getCampaigns, deleteCampaign } from '@/lib/actions/campaigns'
import AddCampaignModal from './AddCampaignModal'
import EditCampaignModal from './EditCampaignModal'
import CreateWorkflowCampaign from './CreateWorkflowCampaign'
import EditWorkflowCampaign from './EditWorkflowCampaign'

export default function CampaignsTable({ initialCampaigns }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [filteredCampaigns, setFilteredCampaigns] = useState(initialCampaigns)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showWorkflowModal, setShowWorkflowModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState(null)
  const [editingWorkflowCampaign, setEditingWorkflowCampaign] = useState(null)

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCampaigns(campaigns)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = campaigns.filter(campaign => 
      campaign.name.toLowerCase().includes(query)
    )
    setFilteredCampaigns(filtered)
  }, [searchQuery, campaigns])

  const handleSync = async () => {
    setLoading(true)
    try {
      const fresh = await getCampaigns()
      setCampaigns(fresh)
      setFilteredCampaigns(fresh)
    } catch (error) {
      console.error('Error syncing campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return
    
    try {
      setLoading(true)
      await deleteCampaign(id)
      setCampaigns(campaigns.filter(campaign => campaign.id !== id))
      setFilteredCampaigns(filteredCampaigns.filter(campaign => campaign.id !== id))
    } catch (error) {
      console.error('Error deleting campaign:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (newCampaign) => {
    if (newCampaign.targets && newCampaign.shortlinks) {
      setCampaigns([newCampaign, ...campaigns])
      setFilteredCampaigns([newCampaign, ...filteredCampaigns])
    } else {
      // If the campaign doesn't have the required relations, refresh the list
      handleSync()
    }
  }

  const handleEdit = (campaign) => {
    setEditingCampaign(campaign)
  }

  const handleUpdate = (updatedCampaign) => {
    setCampaigns(campaigns.map(c => 
      c.id === updatedCampaign.id ? updatedCampaign : c
    ))
    setFilteredCampaigns(filteredCampaigns.map(c => 
      c.id === updatedCampaign.id ? updatedCampaign : c
    ))
    setEditingCampaign(null)
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
              Showing {filteredCampaigns.length} of {campaigns.length}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className={styles.addRecord}
              onClick={() => setShowWorkflowModal(true)}
              style={{ background: 'var(--accent-orange)' }}
            >
              🚀 Create Sequence
            </button>
            <button 
              className={styles.addRecord}
              onClick={() => setShowAddModal(true)}
            >
              Dedicated Send
            </button>
          </div>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Message/Workflow</th>
              <th>Target Type</th>
              <th>Shortlinks</th>
              <th>Messages Sent</th>
              <th>Last Message Sent</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCampaigns.map((campaign) => {
              const isWorkflow = !!campaign.workflow;
              return (
              <tr key={campaign.id}>
                <td>{campaign.name}</td>
                <td>
                  {isWorkflow ? (
                    <span className={styles.workflowBadge}>🔀 Workflow</span>
                  ) : (
                    <span className={styles.legacyBadge}>📝 Legacy</span>
                  )}
                </td>
                <td>
                  <span className={`${styles.status} ${campaign.enabled ? styles.enabled : styles.disabled}`}>
                    {campaign.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td>
                  {isWorkflow ? (
                    <span className={styles.workflowInfo}>
                      {campaign.workflow?.nodes?.length || 0} nodes
                    </span>
                  ) : (
                    <div className={styles.messageCell}>
                      {campaign.message || <span className={styles.noCampaign}>No message</span>}
                    </div>
                  )}
                </td>
                <td>
                  {isWorkflow ? (
                    <span className={styles.noCampaign}>N/A</span>
                  ) : (
                    <>
                      {campaign.targets?.map(target => (
                        <span key={target.id} className={styles.campaign}>
                          {target.targetType === 'ALL_SUBSCRIBED' ? 'All Subscribed' : target.tag?.name}
                        </span>
                      )) || <span className={styles.noCampaign}>No targets</span>}
                    </>
                  )}
                </td>
                <td>{campaign.shortlinks.length}</td>
                <td>
                  <span className={styles.messagesSent}>
                    {campaign.messagesSent || 0}
                  </span>
                </td>
                <td>
                  {campaign.lastMessageSent 
                    ? new Date(campaign.lastMessageSent).toLocaleDateString()
                    : <span className={styles.noCampaign}>Never</span>
                  }
                </td>
                <td>{new Date(campaign.createdAt).toLocaleDateString()}</td>
                <td className={styles.actions}>
                  {isWorkflow ? (
                    <button 
                      onClick={() => setEditingWorkflowCampaign(campaign)}
                      className={styles.actionButton}
                    >
                      Edit Workflow
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleEdit(campaign)}
                      className={styles.actionButton}
                    >
                      Edit
                    </button>
                  )}
                  <button 
                    onClick={() => handleDelete(campaign.id)}
                    className={styles.actionButton}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      {editingCampaign && (
        <EditCampaignModal
          campaign={editingCampaign}
          onClose={() => setEditingCampaign(null)}
          onUpdate={handleUpdate}
        />
      )}
      
      {showAddModal && (
        <AddCampaignModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}

      {showWorkflowModal && (
        <CreateWorkflowCampaign
          onClose={() => {
            setShowWorkflowModal(false);
            handleSync();
          }}
        />
      )}

      {editingWorkflowCampaign && (
        <EditWorkflowCampaign
          campaign={editingWorkflowCampaign}
          onClose={() => {
            setEditingWorkflowCampaign(null);
            handleSync();
          }}
        />
      )}
    </div>
  )
} 