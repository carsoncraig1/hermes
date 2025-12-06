'use client';

import { useState, useEffect } from 'react';
import { getDedicatedSendCampaigns, getCampaignContactCount, executeDedicatedSend } from '@/lib/actions/campaigns';
import styles from './DedicatedSendCard.module.css';

export default function DedicatedSendCard() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [contactCount, setContactCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaignId) {
      loadContactCount(selectedCampaignId);
    } else {
      setContactCount(null);
    }
  }, [selectedCampaignId]);

  const loadCampaigns = async () => {
    try {
      const data = await getDedicatedSendCampaigns();
      setCampaigns(data);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  };

  const loadContactCount = async (campaignId) => {
    try {
      setLoading(true);
      const count = await getCampaignContactCount(campaignId);
      setContactCount(count);
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
      await executeDedicatedSend(selectedCampaignId);
      setShowConfirmModal(false);
      setSelectedCampaignId('');
      setContactCount(null);
      alert('Campaign executed successfully!');
    } catch (error) {
      console.error('Error executing campaign:', error);
      alert('Failed to execute campaign: ' + (error.message || 'Unknown error'));
    } finally {
      setExecuting(false);
    }
  };

  const selectedCampaign = campaigns.find(c => c.id === parseInt(selectedCampaignId));

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3>Execute Dedicated Send</h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.formGroup}>
            <label htmlFor="campaign-select">Select Campaign</label>
            <select
              id="campaign-select"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className={styles.select}
              disabled={loading}
            >
              <option value="">Choose a campaign...</option>
              {campaigns.map(campaign => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>

          {selectedCampaignId && (
            <div className={styles.campaignInfo}>
              {loading ? (
                <div className={styles.loading}>Loading contact count...</div>
              ) : contactCount !== null ? (
                <div className={styles.contactCount}>
                  <span className={styles.countLabel}>Contacts:</span>
                  <span className={styles.countValue}>{contactCount.toLocaleString()}</span>
                </div>
              ) : null}
            </div>
          )}

          <button
            onClick={handleExecute}
            disabled={!selectedCampaignId || !contactCount || contactCount === 0 || loading || executing}
            className={styles.executeButton}
          >
            {executing ? 'Executing...' : 'Execute Send'}
          </button>
        </div>
      </div>

      {showConfirmModal && (
        <div className={styles.modalOverlay} onClick={() => setShowConfirmModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>⚠️ Confirm Dedicated Send</h2>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.warningSection}>
                <p className={styles.warningText}>
                  You are about to send a message to
                </p>
                <div className={styles.contactCountHighlight}>
                  <span className={styles.highlightNumber}>{contactCount?.toLocaleString()}</span>
                  <span className={styles.highlightLabel}>contacts</span>
                </div>
                <p className={styles.warningText}>
                  using the campaign <strong>"{selectedCampaign?.name}"</strong>
                </p>
              </div>
              <div className={styles.messagePreview}>
                <label>Message Preview:</label>
                <div className={styles.messageText}>
                  {selectedCampaign?.message || 'No message set'}
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
                {executing ? 'Sending...' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

