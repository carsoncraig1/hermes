'use client';

import { useState, useEffect } from 'react';
import { getTags } from '@/lib/actions/tags';
import styles from './SplitConfiguration.module.css';

export default function SplitConfiguration({
  splits,
  splitMethod,
  onSplitMethodChange,
  onAddSplit,
  onRemoveSplit,
  onUpdateSplit,
  contactCount,
  remainingCount,
  remainingTag,
  onRemainingTagChange,
  selectionMethod,
  onSelectionMethodChange,
  preventOverlap,
  onPreventOverlapChange,
  tagOperation,
  onTagOperationChange
}) {
  const [availableTags, setAvailableTags] = useState([]);

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

  const calculateSplitCount = (split) => {
    if (!split.value || !contactCount) return 0;
    if (splitMethod === 'percentage') {
      return Math.floor((contactCount * parseFloat(split.value)) / 100);
    } else {
      return parseInt(split.value) || 0;
    }
  };

  return (
    <div className={styles.splitConfiguration}>
      {/* Tag Operation Selector */}
      <div className={styles.tagOperationSelector}>
        <label>
          <input
            type="radio"
            value="add"
            checked={tagOperation === 'add'}
            onChange={(e) => onTagOperationChange(e.target.value)}
          />
          Add Tags
        </label>
        <label>
          <input
            type="radio"
            value="remove"
            checked={tagOperation === 'remove'}
            onChange={(e) => onTagOperationChange(e.target.value)}
          />
          Remove Tags
        </label>
        <label>
          <input
            type="radio"
            value="replace"
            checked={tagOperation === 'replace'}
            onChange={(e) => onTagOperationChange(e.target.value)}
          />
          Replace Tags
        </label>
      </div>

      {/* Split Method Selector */}
      <div className={styles.splitMethodSelector}>
        <label>Split Method:</label>
        <select
          value={splitMethod}
          onChange={(e) => onSplitMethodChange(e.target.value)}
          className={styles.methodSelect}
        >
          <option value="count">Count</option>
          <option value="percentage">Percentage</option>
        </select>
      </div>

      {/* Splits List */}
      <div className={styles.splitsList}>
        {splits.map((split) => {
          const splitCount = calculateSplitCount(split);
          return (
            <div key={split.id} className={styles.splitRow}>
              <div className={styles.splitInputs}>
                <input
                  type="text"
                  list={`tags-${split.id}`}
                  value={split.tagName || ''}
                  onChange={(e) => onUpdateSplit(split.id, { tagName: e.target.value })}
                  placeholder="Select or type tag name..."
                  className={styles.tagInput}
                />
                <datalist id={`tags-${split.id}`}>
                  {availableTags.map(tag => (
                    <option key={tag.id} value={tag.name} />
                  ))}
                </datalist>
                <div className={styles.valueInputGroup}>
                  <input
                    type="number"
                    value={split.value || ''}
                    onChange={(e) => onUpdateSplit(split.id, { value: e.target.value })}
                    placeholder={splitMethod === 'percentage' ? '10' : '1000'}
                    className={styles.valueInput}
                    min="0"
                    step={splitMethod === 'percentage' ? '0.1' : '1'}
                  />
                  <span className={styles.valueUnit}>
                    {splitMethod === 'percentage' ? '%' : 'contacts'}
                  </span>
                </div>
                <div className={styles.splitCount}>
                  = {splitCount.toLocaleString()} contacts
                </div>
                <button
                  onClick={() => onRemoveSplit(split.id)}
                  className={styles.removeButton}
                  type="button"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onAddSplit}
        className={styles.addSplitButton}
        type="button"
      >
        + Add Split
      </button>

      {/* Remaining Contacts */}
      {splits.length > 0 && (
        <div className={styles.remainingSection}>
          <div className={styles.remainingInfo}>
            <span className={styles.remainingLabel}>Remaining:</span>
            <span className={styles.remainingCount}>
              {remainingCount.toLocaleString()} contacts
              {splitMethod === 'percentage' && ` (${((remainingCount / contactCount) * 100).toFixed(1)}%)`}
            </span>
          </div>
          <div className={styles.remainingTagInput}>
            <input
              type="text"
              value={remainingTag}
              onChange={(e) => onRemainingTagChange(e.target.value)}
              placeholder="Tag remaining contacts (optional)"
              className={styles.remainingInput}
              list="remaining-tags"
            />
            <datalist id="remaining-tags">
              {availableTags.map(tag => (
                <option key={tag.id} value={tag.name} />
              ))}
            </datalist>
          </div>
        </div>
      )}

      {/* Options */}
      <div className={styles.optionsSection}>
        <div className={styles.optionGroup}>
          <label>Selection Method:</label>
          <select
            value={selectionMethod}
            onChange={(e) => onSelectionMethodChange(e.target.value)}
            className={styles.optionSelect}
          >
            <option value="random">Random</option>
            <option value="sequential">Sequential</option>
          </select>
        </div>
        <div className={styles.optionGroup}>
          <label>
            <input
              type="checkbox"
              checked={preventOverlap}
              onChange={(e) => onPreventOverlapChange(e.target.checked)}
            />
            Prevent Overlap (each contact gets max one tag from this operation)
          </label>
        </div>
      </div>
    </div>
  );
}

