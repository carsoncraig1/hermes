'use client';

import styles from './PreviewPanel.module.css';

export default function PreviewPanel({
  filters,
  splits,
  splitMethod,
  contactCount,
  remainingCount,
  remainingTag,
  selectionMethod,
  preventOverlap,
  tagOperation,
  onExecute,
  executing,
  executionProgress,
  lastExecution
}) {
  const getFilterSummary = () => {
    const parts = [];
    if (filters.subscribed === 'true') parts.push('Subscribed');
    if (filters.subscribed === 'false') parts.push('Unsubscribed');
    
    [filters.level1, filters.level2, filters.level3].forEach((level, idx) => {
      if (level?.field && level?.value) {
        const fieldLabel = level.field.charAt(0).toUpperCase() + level.field.slice(1);
        parts.push(`${fieldLabel} ${level.operator} "${level.value}"`);
      }
    });
    
    return parts.length > 0 ? parts.join(', ') : 'All contacts';
  };

  const calculateSplitCount = (split) => {
    if (!split.value || !contactCount) return 0;
    if (splitMethod === 'percentage') {
      return Math.floor((contactCount * parseFloat(split.value)) / 100);
    } else {
      return parseInt(split.value) || 0;
    }
  };

  const totalSplitCount = splits.reduce((sum, split) => sum + calculateSplitCount(split), 0);
  const totalPercent = splitMethod === 'percentage' 
    ? splits.reduce((sum, split) => sum + (parseFloat(split.value) || 0), 0)
    : null;

  return (
    <div className={styles.previewPanel}>
      <div className={styles.previewSection}>
        <h3>Filter Summary</h3>
        <div className={styles.filterSummary}>
          {getFilterSummary()}
        </div>
        <div className={styles.contactCount}>
          <strong>{contactCount.toLocaleString()}</strong> contacts match
        </div>
      </div>

      {splits.length > 0 && (
        <div className={styles.previewSection}>
          <h3>Split Summary</h3>
          <div className={styles.splitsSummary}>
            {splits.map((split, idx) => {
              const count = calculateSplitCount(split);
              return (
                <div key={split.id || idx} className={styles.splitSummaryRow}>
                  <span className={styles.splitTag}>{split.tagName || '(no tag)'}</span>
                  <span className={styles.splitArrow}>→</span>
                  <span className={styles.splitCount}>
                    {count.toLocaleString()} contacts
                    {splitMethod === 'percentage' && ` (${parseFloat(split.value || 0).toFixed(1)}%)`}
                  </span>
                </div>
              );
            })}
            {remainingCount > 0 && (
              <div className={styles.splitSummaryRow}>
                <span className={styles.splitTag}>
                  {remainingTag || '(untagged)'}
                </span>
                <span className={styles.splitArrow}>→</span>
                <span className={styles.splitCount}>
                  {remainingCount.toLocaleString()} contacts
                  {splitMethod === 'percentage' && ` (${((remainingCount / contactCount) * 100).toFixed(1)}%)`}
                </span>
              </div>
            )}
          </div>
          <div className={styles.totalSummary}>
            <div className={styles.totalRow}>
              <span>Total to be tagged:</span>
              <strong>{totalSplitCount.toLocaleString()} contacts</strong>
            </div>
            {splitMethod === 'percentage' && totalPercent !== null && (
              <div className={styles.totalRow}>
                <span>Total percentage:</span>
                <strong>{totalPercent.toFixed(1)}%</strong>
                {totalPercent > 100 && (
                  <span className={styles.warning}>⚠ Exceeds 100%</span>
                )}
              </div>
            )}
            {splitMethod === 'count' && totalSplitCount > contactCount && (
              <div className={styles.warning}>
                ⚠ Total count exceeds available contacts
              </div>
            )}
          </div>
        </div>
      )}

      <div className={styles.previewSection}>
        <h3>Operation Details</h3>
        <div className={styles.operationDetails}>
          <div className={styles.detailRow}>
            <span>Operation:</span>
            <strong>{tagOperation === 'add' ? 'Add Tags' : tagOperation === 'remove' ? 'Remove Tags' : 'Replace Tags'}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>Selection:</span>
            <strong>{selectionMethod === 'random' ? 'Random' : 'Sequential'}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>Overlap Prevention:</span>
            <strong>{preventOverlap ? 'Enabled' : 'Disabled'}</strong>
          </div>
        </div>
      </div>

      {executionProgress && (
        <div className={styles.progressSection}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ width: `${(executionProgress.current / executionProgress.total) * 100}%` }}
            />
          </div>
          <div className={styles.progressText}>
            {executionProgress.message} ({executionProgress.current}/{executionProgress.total})
          </div>
        </div>
      )}

      {lastExecution && (
        <div className={styles.lastExecution}>
          <h4>Last Execution</h4>
          <div className={styles.executionDetails}>
            <div>Time: {new Date(lastExecution.timestamp).toLocaleString()}</div>
            <div>Tagged: {lastExecution.result.totalTagged.toLocaleString()} contacts</div>
            <div>Splits: {lastExecution.result.splitsProcessed}</div>
          </div>
        </div>
      )}

      <div className={styles.executeSection}>
        <button
          onClick={onExecute}
          disabled={executing || splits.length === 0 || contactCount === 0}
          className={styles.executeButton}
        >
          {executing ? 'Executing...' : 'Execute Tagging'}
        </button>
        {splits.length === 0 && (
          <div className={styles.helperText}>
            Add at least one split to execute
          </div>
        )}
      </div>
    </div>
  );
}

