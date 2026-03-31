'use client';

import { useState, useEffect } from 'react';
import { getContactsForManualFire, executeManualFire } from '@/lib/actions/campaigns';
import { getTags } from '@/lib/actions/tags';
import { getContactSources } from '@/lib/actions/contacts';
import styles from './ManualFireCard.module.css';

export default function ManualFireCard({ initialCampaigns = [] }) {
  // OPTIMIZED: Use pre-fetched campaigns from server
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [contactCount, setContactCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [executing, setExecuting] = useState(false);
  
  // Targeting options
  const [targetAllSubscribed, setTargetAllSubscribed] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [selectedLists, setSelectedLists] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [availableSources, setAvailableSources] = useState([]);
  const [availableLists, setAvailableLists] = useState([]);

  // Only load tags and sources (campaigns already pre-fetched)
  useEffect(() => {
    loadTags();
    loadSources();
    loadLists();
  }, []);

  useEffect(() => {
    if (selectedCampaignId && (targetAllSubscribed || selectedTags.length > 0 || selectedSources.length > 0 || selectedLists.length > 0)) {
      loadContactCount();
    } else {
      setContactCount(null);
    }
  }, [selectedCampaignId, targetAllSubscribed, selectedTags, selectedSources, selectedLists]);

  const loadTags = async () => {
    try {
      const tags = await getTags();
      setAvailableTags(tags);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const loadSources = async () => {
    try {
      // OPTIMIZED: Use dedicated sources endpoint instead of fetching all contacts
      const sources = await getContactSources();
      setAvailableSources(sources);
    } catch (error) {
      console.error('Error loading sources:', error);
    }
  };

  const loadLists = async () => {
    try {
      const response = await fetch('/api/user/phone-numbers');
      if (!response.ok) return;
      const data = await response.json();
      setAvailableLists(data.phoneNumbers || []);
    } catch (error) {
      console.error('Error loading lists:', error);
    }
  };

  const loadContactCount = async () => {
    try {
      setLoading(true);
      const contacts = await getContactsForManualFire({
        selectedTags: selectedTags.map(tag => tag.name || tag),
        selectedSources,
        selectedLists,
        targetAllSubscribed
      });
      setContactCount(contacts.length);
    } catch (error) {
      console.error('Error loading contact count:', error);
      setContactCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = () => {
    if (selectedCampaignId && contactCount > 0) {
      setShowConfirmModal(true);
    }
  };

  const handleConfirm = async () => {
    if (!selectedCampaignId) return;

    setExecuting(true);
    try {
      await executeManualFire(selectedCampaignId, {
        selectedTags: selectedTags.map(tag => tag.name || tag),
        selectedSources,
        selectedLists,
        targetAllSubscribed
      });
      setShowConfirmModal(false);
      setSelectedCampaignId('');
      setContactCount(null);
      setTargetAllSubscribed(false);
      setSelectedTags([]);
      setSelectedSources([]);
      setSelectedLists([]);
      alert('Workflow executed successfully!');
    } catch (error) {
      console.error('Error executing workflow:', error);
      alert('Failed to execute workflow: ' + (error.message || 'Unknown error'));
    } finally {
      setExecuting(false);
    }
  };

  const selectedCampaign = campaigns.find(c => c.id === parseInt(selectedCampaignId));

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3>Manual Fire Sequence</h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.formGroup}>
            <label htmlFor="campaign-select">Select Sequence Campaign</label>
            <select
              id="campaign-select"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className={styles.select}
              disabled={loading}
            >
              <option value="">Choose a sequence campaign...</option>
              {campaigns.map(campaign => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>

          {selectedCampaignId && (
            <>
              <div className={styles.targetingSection}>
                <div className={styles.targetAllContainer}>
                  <input
                    type="checkbox"
                    id="targetAllSubscribed"
                    checked={targetAllSubscribed}
                    onChange={(e) => {
                      setTargetAllSubscribed(e.target.checked);
                      if (e.target.checked) {
                        setSelectedTags([]);
                        setSelectedSources([]);
                        setSelectedLists([]);
                      }
                    }}
                    className={styles.checkbox}
                  />
                  <label htmlFor="targetAllSubscribed" className={styles.targetAllLabel}>
                    TARGET ALL SUBSCRIBED CONTACTS
                  </label>
                </div>

                {!targetAllSubscribed && (
                  <div className={styles.targetingOptions}>
                    <div className={styles.formGroup}>
                      <label>Select Tags (Optional)</label>
                      <div className={styles.tagsGrid}>
                        {availableTags.map(tag => (
                          <label key={tag.id} className={styles.tagLabel}>
                            <input
                              type="checkbox"
                              checked={selectedTags.some(t => (t.id || t) === tag.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTags([...selectedTags, tag]);
                                } else {
                                  setSelectedTags(selectedTags.filter(t => (t.id || t) !== tag.id));
                                }
                              }}
                              className={styles.checkbox}
                            />
                            {tag.name}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label>Select Sources (Optional)</label>
                      <div className={styles.tagsGrid}>
                        {availableSources.map(source => (
                          <label key={source} className={styles.tagLabel}>
                            <input
                              type="checkbox"
                              checked={selectedSources.includes(source)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSources([...selectedSources, source]);
                                } else {
                                  setSelectedSources(selectedSources.filter(s => s !== source));
                                }
                              }}
                              className={styles.checkbox}
                            />
                            {source}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label>Select Lists (Optional)</label>
                      <div className={styles.tagsGrid}>
                        {availableLists.map(list => (
                          <label key={list.id} className={styles.tagLabel}>
                            <input
                              type="checkbox"
                              checked={selectedLists.includes(list.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLists([...selectedLists, list.id]);
                                } else {
                                  setSelectedLists(selectedLists.filter(id => id !== list.id));
                                }
                              }}
                              className={styles.checkbox}
                            />
                            {(list.friendlyName || 'Unnamed')} ({list.phoneNumber})
                          </label>
                        ))}
                      </div>
                    </div>

                    {selectedTags.length === 0 && selectedSources.length === 0 && selectedLists.length === 0 && (
                      <div className={styles.warning}>
                        Please select at least one tag, source, or list (or target all subscribed)
                      </div>
                    )}
                  </div>
                )}
              </div>

              {contactCount !== null && (
                <div className={styles.campaignInfo}>
                  {loading ? (
                    <div className={styles.loading}>Loading contact count...</div>
                  ) : (
                    <div className={styles.contactCount}>
                      <span className={styles.countLabel}>Contacts:</span>
                      <span className={styles.countValue}>{contactCount.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <button
            onClick={handleExecute}
            disabled={!selectedCampaignId || !contactCount || contactCount === 0 || loading || executing || (!targetAllSubscribed && selectedTags.length === 0 && selectedSources.length === 0 && selectedLists.length === 0)}
            className={styles.executeButton}
          >
            {executing ? 'Executing...' : 'Fire Sequence'}
          </button>
        </div>
      </div>

      {showConfirmModal && (
        <div className={styles.modalOverlay} onClick={() => setShowConfirmModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>⚠️ Confirm Manual Fire</h2>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.warningSection}>
                <p className={styles.warningText}>
                  You are about to fire a sequence workflow to
                </p>
                <div className={styles.contactCountHighlight}>
                  <span className={styles.highlightNumber}>{contactCount?.toLocaleString()}</span>
                  <span className={styles.highlightLabel}>contacts</span>
                </div>
                <p className={styles.warningText}>
                  using the sequence <strong>"{selectedCampaign?.name}"</strong>
                </p>
              </div>
              <div className={styles.targetingPreview}>
                <label>Targeting:</label>
                <div className={styles.targetingInfo}>
                  {targetAllSubscribed ? (
                    <span>All Subscribed Contacts</span>
                  ) : (
                    <>
                      {selectedTags.length > 0 && (
                        <div>
                          <strong>Tags:</strong> {selectedTags.map(t => t.name || t).join(', ')}
                        </div>
                      )}
                      {selectedSources.length > 0 && (
                        <div>
                          <strong>Sources:</strong> {selectedSources.join(', ')}
                        </div>
                      )}
                      {selectedLists.length > 0 && (
                        <div>
                          <strong>Lists:</strong> {selectedLists.map(id => {
                            const list = availableLists.find(item => item.id === id);
                            return list ? `${list.friendlyName || 'Unnamed'} (${list.phoneNumber})` : String(id);
                          }).join(', ')}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={() => setShowConfirmModal(false)}
                className={styles.cancelButton}
                disabled={executing}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className={styles.confirmButton}
                disabled={executing}
              >
                {executing ? 'Firing...' : 'Confirm & Fire'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

