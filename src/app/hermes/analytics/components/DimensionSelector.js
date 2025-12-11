'use client';

import { DIMENSIONS, getDimensionLabel } from '@/lib/analyticsBreakdown';
import styles from './DimensionSelector.module.css';

const AVAILABLE_DIMENSIONS = [
  { value: DIMENSIONS.NONE, label: 'None' },
  { value: DIMENSIONS.CAMPAIGN, label: 'Campaign' },
  { value: DIMENSIONS.SHORTLINK, label: 'Shortlink' },
  { value: DIMENSIONS.SOURCE, label: 'Source' },
  { value: DIMENSIONS.TAG, label: 'Tag' },
  { value: DIMENSIONS.DATE, label: 'Date' },
  { value: DIMENSIONS.DATE_WEEK, label: 'Week' },
  { value: DIMENSIONS.DATE_MONTH, label: 'Month' },
  { value: DIMENSIONS.MESSAGE_STATUS, label: 'Message Status' },
  { value: DIMENSIONS.MESSAGE_DIRECTION, label: 'Direction' }
];

export default function DimensionSelector({ dimensions, onChange, level }) {
  const currentDimension = dimensions[level - 1] || DIMENSIONS.NONE;
  const previousDimensions = dimensions.slice(0, level - 1);

  // Filter out already selected dimensions
  const availableOptions = AVAILABLE_DIMENSIONS.filter(
    dim => dim.value === DIMENSIONS.NONE || !previousDimensions.includes(dim.value)
  );

  const handleChange = (e) => {
    const newValue = e.target.value;
    const newDimensions = [...dimensions];
    newDimensions[level - 1] = newValue;
    
    // Clear deeper levels if this level is set to NONE
    if (newValue === DIMENSIONS.NONE) {
      for (let i = level; i < 3; i++) {
        newDimensions[i] = DIMENSIONS.NONE;
      }
    }
    
    onChange(newDimensions);
  };

  return (
    <div className={styles.selectorGroup}>
      <label className={styles.label}>
        {level === 1 ? 'Primary Dimension' : level === 2 ? 'Breakdown By' : 'Further Breakdown'}
      </label>
      <select
        value={currentDimension}
        onChange={handleChange}
        className={styles.select}
      >
        {availableOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

