'use client';

import { useState, useMemo } from 'react';
import { getContactsCount, bulkTagContacts } from '@/lib/actions/bulkTagging';
import FilterBuilder from './FilterBuilder';
import SplitConfiguration from './SplitConfiguration';
import PreviewPanel from './PreviewPanel';
import styles from './BulkTagging.module.css';

export default function BulkTagging() {
  const [filters, setFilters] = useState({ subscribed: 'true' });
  const [contactCount, setContactCount] = useState(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [splits, setSplits] = useState([]);
  const [splitMethod, setSplitMethod] = useState('count'); // 'count' or 'percentage'
  const [selectionMethod, setSelectionMethod] = useState('random'); // 'random' or 'sequential'
  const [preventOverlap, setPreventOverlap] = useState(true);
  const [remainingTag, setRemainingTag] = useState('');
  const [tagOperation, setTagOperation] = useState('add'); // 'add', 'remove', 'replace'
  const [executing, setExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(null);
  const [lastExecution, setLastExecution] = useState(null);

  // Calculate remaining contacts
  const remainingCount = useMemo(() => {
    if (!contactCount || splits.length === 0) return contactCount || 0;
    
    if (splitMethod === 'percentage') {
      const totalPercent = splits.reduce((sum, split) => sum + (parseFloat(split.value) || 0), 0);
      const remainingPercent = Math.max(0, 100 - totalPercent);
      return Math.floor((contactCount * remainingPercent) / 100);
    } else {
      const totalCount = splits.reduce((sum, split) => sum + (parseInt(split.value) || 0), 0);
      return Math.max(0, contactCount - totalCount);
    }
  }, [contactCount, splits, splitMethod]);

  const handleUpdateFilters = async (newFilters) => {
    setFilters(newFilters);
    await updateContactCount(newFilters);
  };

  const updateContactCount = async (filterSet = filters) => {
    setLoadingCount(true);
    try {
      const count = await getContactsCount(filterSet);
      setContactCount(count);
    } catch (error) {
      console.error('Error getting contact count:', error);
      alert('Failed to get contact count');
    } finally {
      setLoadingCount(false);
    }
  };

  const handleAddSplit = () => {
    setSplits([...splits, { id: Date.now(), tagName: '', value: '' }]);
  };

  const handleRemoveSplit = (id) => {
    setSplits(splits.filter(split => split.id !== id));
  };

  const handleUpdateSplit = (id, updates) => {
    setSplits(splits.map(split => 
      split.id === id ? { ...split, ...updates } : split
    ));
  };

  const handleExecute = async () => {
    // Validation
    if (!contactCount || contactCount === 0) {
      alert('No contacts match the filters');
      return;
    }

    if (splits.length === 0) {
      alert('Please add at least one split');
      return;
    }

    // Validate splits
    for (const split of splits) {
      if (!split.tagName || !split.tagName.trim()) {
        alert('Please select a tag for all splits');
        return;
      }
      if (!split.value || parseFloat(split.value) <= 0) {
        alert('Please enter a valid value for all splits');
        return;
      }
    }

    // Validate totals
    if (splitMethod === 'percentage') {
      const totalPercent = splits.reduce((sum, split) => sum + (parseFloat(split.value) || 0), 0);
      if (totalPercent > 100) {
        alert(`Total percentage cannot exceed 100%. Current: ${totalPercent.toFixed(1)}%`);
        return;
      }
    } else {
      const totalCount = splits.reduce((sum, split) => sum + (parseInt(split.value) || 0), 0);
      if (totalCount > contactCount) {
        alert(`Total count (${totalCount}) cannot exceed available contacts (${contactCount})`);
        return;
      }
    }

    if (!confirm(`Are you sure you want to apply tags to ${contactCount} contacts?`)) {
      return;
    }

    setExecuting(true);
    setExecutionProgress({ current: 0, total: splits.length, message: 'Starting...' });

    try {
      const result = await bulkTagContacts({
        filters,
        splits: splits.map(split => ({
          tagName: split.tagName.trim(),
          value: splitMethod === 'percentage' ? parseFloat(split.value) : parseInt(split.value),
          isPercentage: splitMethod === 'percentage'
        })),
        splitMethod,
        selectionMethod,
        preventOverlap,
        remainingTag: remainingTag.trim() || null,
        tagOperation
      });

      setLastExecution({
        timestamp: new Date(),
        result,
        filters: { ...filters },
        splits: [...splits]
      });
      
      alert(`Successfully tagged ${result.totalTagged} contacts across ${result.splitsProcessed} splits`);
      
      // Reset form
      setSplits([]);
      setRemainingTag('');
      await updateContactCount();
    } catch (error) {
      console.error('Error executing bulk tag:', error);
      alert('Failed to execute tagging: ' + (error.message || 'Unknown error'));
    } finally {
      setExecuting(false);
      setExecutionProgress(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainContent}>
        {/* Filter Builder Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>1. Filter Contacts</h2>
            <button 
              onClick={() => updateContactCount()} 
              disabled={loadingCount}
              className={styles.refreshButton}
            >
              {loadingCount ? 'Counting...' : '↻ Refresh Count'}
            </button>
          </div>
          <FilterBuilder 
            filters={filters}
            onFiltersChange={handleUpdateFilters}
          />
          <div className={styles.countDisplay}>
            {loadingCount ? (
              <span>Counting contacts...</span>
            ) : contactCount !== null ? (
              <span className={styles.countNumber}>{contactCount.toLocaleString()}</span>
            ) : (
              <span>Click "Refresh Count" to see how many contacts match</span>
            )}
            {contactCount !== null && <span> contacts match these filters</span>}
          </div>
        </div>

        {/* Split Configuration Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>2. Configure Splits</h2>
          </div>
          <SplitConfiguration
            splits={splits}
            splitMethod={splitMethod}
            onSplitMethodChange={setSplitMethod}
            onAddSplit={handleAddSplit}
            onRemoveSplit={handleRemoveSplit}
            onUpdateSplit={handleUpdateSplit}
            contactCount={contactCount || 0}
            remainingCount={remainingCount}
            remainingTag={remainingTag}
            onRemainingTagChange={setRemainingTag}
            selectionMethod={selectionMethod}
            onSelectionMethodChange={setSelectionMethod}
            preventOverlap={preventOverlap}
            onPreventOverlapChange={setPreventOverlap}
            tagOperation={tagOperation}
            onTagOperationChange={setTagOperation}
          />
        </div>

        {/* Preview & Execute Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>3. Preview & Execute</h2>
          </div>
          <PreviewPanel
            filters={filters}
            splits={splits}
            splitMethod={splitMethod}
            contactCount={contactCount || 0}
            remainingCount={remainingCount}
            remainingTag={remainingTag}
            selectionMethod={selectionMethod}
            preventOverlap={preventOverlap}
            tagOperation={tagOperation}
            onExecute={handleExecute}
            executing={executing}
            executionProgress={executionProgress}
            lastExecution={lastExecution}
          />
        </div>
      </div>
    </div>
  );
}

