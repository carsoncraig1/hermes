'use client';

import { useState, useEffect } from 'react';
import { updateContact } from '@/lib/actions/contacts';
import { getTags } from '@/lib/actions/tags';
import styles from './BulkEditModal.module.css';

export default function BulkEditModal({ selectedContacts, onClose, onUpdate }) {
  const [source, setSource] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await getTags();
        setAvailableTags(tags);
      } catch (error) {
        console.error('Error loading tags:', error);
      }
    };
    loadTags();
  }, []);

  const handleTagToggle = (tagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update each selected contact
      for (const contact of selectedContacts) {
        const updateData = {
          id: contact.id,
          source: source || undefined,
          tags: selectedTags.map(tagId => {
            const tag = availableTags.find(t => t.id === tagId);
            return tag ? tag.name : null;
          }).filter(Boolean),
        };

        // Only update if there's something to update
        if (updateData.source || updateData.tags.length > 0) {
          await updateContact(updateData);
        }
      }

      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating contacts:', error);
      alert('Failed to update contacts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Bulk Edit ({selectedContacts.length} contacts)</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="source">Source</label>
            <input
              id="source"
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Enter source (leave empty to keep current)"
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Tags</label>
            <div className={styles.tagsGrid}>
              {availableTags.map(tag => (
                <label key={tag.id} className={styles.tagLabel}>
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag.id)}
                    onChange={() => handleTagToggle(tag.id)}
                    className={styles.checkbox}
                  />
                  {tag.name}
                </label>
              ))}
            </div>
            {availableTags.length === 0 && (
              <div className={styles.emptyState}>No tags available</div>
            )}
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className={styles.submitButton}>
              {loading ? 'Updating...' : 'Update Contacts'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

