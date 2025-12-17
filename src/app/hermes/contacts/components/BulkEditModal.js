'use client';

import { useState, useEffect, useMemo } from 'react';
import { updateContact } from '@/lib/actions/contacts';
import { getTags } from '@/lib/actions/tags';
import styles from './BulkEditModal.module.css';

export default function BulkEditModal({ selectedContacts, onClose, onUpdate }) {
  const [source, setSource] = useState('');
  const [selectedTagNames, setSelectedTagNames] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tagOperation, setTagOperation] = useState('add'); // 'add' or 'remove'

  // Get all existing tags from selected contacts
  const existingTags = useMemo(() => {
    const tagSet = new Set();
    selectedContacts.forEach(contact => {
      if (contact.tags && Array.isArray(contact.tags)) {
        contact.tags.forEach(tag => {
          const tagName = typeof tag === 'string' ? tag : tag.name;
          tagSet.add(tagName);
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [selectedContacts]);

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

  const handleTagToggle = (tagName) => {
    setSelectedTagNames(prev => 
      prev.includes(tagName)
        ? prev.filter(name => name !== tagName)
        : [...prev, tagName]
    );
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!selectedTagNames.includes(newTag)) {
        setSelectedTagNames(prev => [...prev, newTag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setSelectedTagNames(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update each selected contact
      for (const contact of selectedContacts) {
        const updateData = {
          id: contact.id,
          phone: contact.phone,
          source: source || undefined,
        };

        // Only include tags if there are tags to add/remove
        if (selectedTagNames.length > 0) {
          updateData.tags = selectedTagNames;
          updateData.tagOperation = tagOperation;
        }

        // Only update if there's something to update
        if (updateData.source || updateData.tags) {
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
            <label htmlFor="tags">Tags</label>
            <div className={styles.tagOperationSelector}>
              <label>
                <input
                  type="radio"
                  value="add"
                  checked={tagOperation === 'add'}
                  onChange={(e) => setTagOperation(e.target.value)}
                />
                Add Tags
              </label>
              <label>
                <input
                  type="radio"
                  value="remove"
                  checked={tagOperation === 'remove'}
                  onChange={(e) => setTagOperation(e.target.value)}
                />
                Remove Tags
              </label>
            </div>
            {existingTags.length > 0 && (
              <div className={styles.existingTagsSection}>
                <div className={styles.existingTagsLabel}>
                  Existing tags on selected contacts:
                </div>
                <div className={styles.existingTagsList}>
                  {existingTags.map(tag => (
                    <span key={tag} className={styles.existingTag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className={styles.tagInput}>
              <div className={styles.tagContainer}>
                {selectedTagNames.map((tag, index) => (
                  <span key={index} className={styles.tag}>
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className={styles.removeTag}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder={tagOperation === 'add' ? "Type and press Enter to add tags" : "Type and press Enter to select tags to remove"}
                className={styles.tagInputField}
              />
            </div>
            {availableTags.length > 0 && (
              <div className={styles.availableTagsSection}>
                <div className={styles.availableTagsLabel}>
                  {tagOperation === 'add' ? 'Quick add existing tags:' : 'Quick select tags to remove:'}
                </div>
                <div className={styles.tagsButtonGrid}>
                  {availableTags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleTagToggle(tag.name)}
                      className={`${styles.tagButton} ${selectedTagNames.includes(tag.name) ? styles.tagButtonSelected : ''}`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
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

