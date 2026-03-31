'use client'

import { useState, useEffect } from 'react'
import styles from './CampaignsTable.module.css'
import { getCampaigns, deleteCampaign, getCampaignDeliveryStats } from '@/lib/actions/campaigns'
import AddCampaignModal from './AddCampaignModal'
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
  const [loadingStats, setLoadingStats] = useState(new Set()) // Track which campaigns are loading stats
  const [loadedStats, setLoadedStats] = useState(new Set()) // Track which campaigns have loaded full stats
  const [phoneNumberMap, setPhoneNumberMap] = useState(new Map())

  useEffect(() => {
    const loadPhoneNumbers = async () => {
      try {
        const response = await fetch('/api/user/phone-numbers')
        if (!response.ok) return
        const data = await response.json()
        const map = new Map()
        ;(data.phoneNumbers || []).forEach(number => {
          map.set(number.id, `${number.friendlyName || 'Unnamed'} (${number.phoneNumber})`)
        })
        setPhoneNumberMap(map)
      } catch (error) {
        console.error('Error loading phone numbers for campaign target labels:', error)
      }
    }
    loadPhoneNumbers()
  }, [])

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
      // Only load recent campaigns (last 72 hours)
      const fresh = await getCampaigns(true)
      setCampaigns(fresh)
      setFilteredCampaigns(fresh)
      // Reset loaded stats when syncing
      setLoadedStats(new Set())
    } catch (error) {
      console.error('Error syncing campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadOlderStats = async (campaignId) => {
    // Don't load if already loading or already loaded
    if (loadingStats.has(campaignId) || loadedStats.has(campaignId)) {
      return
    }

    setLoadingStats(prev => new Set(prev).add(campaignId))
    try {
      const stats = await getCampaignDeliveryStats(campaignId)
      
      // Update the campaign with full stats
      setCampaigns(prevCampaigns => 
        prevCampaigns.map(campaign => 
          campaign.id === campaignId 
            ? { ...campaign, deliveryStats: stats.deliveryStats }
            : campaign
        )
      )
      setFilteredCampaigns(prevFiltered => 
        prevFiltered.map(campaign => 
          campaign.id === campaignId 
            ? { ...campaign, deliveryStats: stats.deliveryStats }
            : campaign
        )
      )
      
      setLoadedStats(prev => new Set(prev).add(campaignId))
    } catch (error) {
      console.error('Error loading campaign stats:', error)
    } finally {
      setLoadingStats(prev => {
        const next = new Set(prev)
        next.delete(campaignId)
        return next
      })
    }
  }

  // Check if a campaign is older than 72 hours (needs stats loading)
  const isOlderCampaign = (campaign) => {
    if (!campaign.lastMessageSent && !campaign.createdAt) return false
    const seventyTwoHoursAgo = new Date()
    seventyTwoHoursAgo.setHours(seventyTwoHoursAgo.getHours() - 72)
    const checkDate = campaign.lastMessageSent || campaign.createdAt
    return new Date(checkDate) < seventyTwoHoursAgo
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

  const renderTargetLabel = (target) => {
    if (target.targetType === 'ALL_SUBSCRIBED') return 'All Subscribed'
    if (target.targetType === 'TAG') return `Tag: ${target.tag?.name || 'Unknown'}`
    if (target.targetType === 'SOURCE') return `Source: ${target.sourceValue}`
    if (target.targetType === 'LIST') {
      const listId = parseInt(target.sourceValue, 10)
      const listLabel = phoneNumberMap.get(listId)
      return `List: ${listLabel || `#${target.sourceValue}`}`
    }
    return target.targetType
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
              <th>Delivery Status</th>
              <th>Cost</th>
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
                          {renderTargetLabel(target)}
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
                  {campaign.deliveryStats && campaign.deliveryStats.total > 0 ? (
                    <div 
                      className={styles.deliveryStats}
                      onMouseEnter={() => {
                        // Auto-load stats on hover for older campaigns
                        if (isOlderCampaign(campaign) && !loadedStats.has(campaign.id) && !loadingStats.has(campaign.id)) {
                          handleLoadOlderStats(campaign.id)
                        }
                      }}
                    >
                      <span className={styles.deliveryRate}>
                        {campaign.deliveryStats.deliveryRate.toFixed(1)}% delivered
                      </span>
                      <div className={styles.deliveryBreakdown}>
                        <span className={styles.delivered}>✓ {campaign.deliveryStats.delivered}</span>
                        <span className={styles.failed}>✗ {campaign.deliveryStats.failed}</span>
                        {campaign.deliveryStats.queued > 0 && (
                          <span className={styles.queued}>⏳ {campaign.deliveryStats.queued}</span>
                        )}
                      </div>
                      {isOlderCampaign(campaign) && !loadedStats.has(campaign.id) && (
                        <button
                          className={styles.loadStatsButton}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleLoadOlderStats(campaign.id)
                          }}
                          disabled={loadingStats.has(campaign.id)}
                        >
                          {loadingStats.has(campaign.id) ? 'Loading...' : '📊 Load Full Stats'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className={styles.deliveryStats}>
                      <span className={styles.noCampaign}>No messages</span>
                      {isOlderCampaign(campaign) && !loadedStats.has(campaign.id) && (
                        <button
                          className={styles.loadStatsButton}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleLoadOlderStats(campaign.id)
                          }}
                          disabled={loadingStats.has(campaign.id)}
                        >
                          {loadingStats.has(campaign.id) ? 'Loading...' : '📊 Load Stats'}
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  {campaign.deliveryStats && campaign.deliveryStats.totalCost > 0 ? (
                    <span className={styles.cost}>
                      ${campaign.deliveryStats.totalCost.toFixed(2)}
                    </span>
                  ) : (
                    <span className={styles.noCampaign}>$0.00</span>
                  )}
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
        <AddCampaignModal
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