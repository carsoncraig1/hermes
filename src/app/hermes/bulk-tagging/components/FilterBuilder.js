'use client';

import { useState, useEffect } from 'react';
import { getTags } from '@/lib/actions/tags';
import styles from './FilterBuilder.module.css';

const FILTER_FIELDS = [
  { id: 'firstName', label: 'First Name', type: 'text' },
  { id: 'lastName', label: 'Last Name', type: 'text' },
  { id: 'phone', label: 'Phone', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'source', label: 'Source', type: 'text' },
  { id: 'age', label: 'Age', type: 'text' },
  { id: 'ip', label: 'IP Address', type: 'text' },
  { id: 'useragent', label: 'User Agent', type: 'text' },
  { id: 'referrer', label: 'Referrer', type: 'text' },
  { id: 'clickid', label: 'Click ID', type: 'text' },
  { id: 'hasClicked', label: 'Clicked?', type: 'boolean' },
  { id: 'tags', label: 'Tags', type: 'tags' },
  { id: 'createdAt', label: 'Created At', type: 'date' },
  { id: 'updatedAt', label: 'Updated At', type: 'date' },
  { id: 'lastMessageSent', label: 'Last Message Sent', type: 'date' },
];

const FILTER_OPERATORS = [
  { id: 'equals', label: 'Equals' },
  { id: 'contains', label: 'Contains' },
  { id: 'startsWith', label: 'Starts With' },
  { id: 'endsWith', label: 'Ends With' },
  { id: 'notEquals', label: 'Not Equals' },
  { id: 'doesNotContain', label: 'Does Not Contain' },
];

const DATE_OPERATORS = [
  { id: 'equals', label: 'On' },
  { id: 'before', label: 'Before' },
  { id: 'after', label: 'After' },
  { id: 'between', label: 'Between' },
];

export default function FilterBuilder({ filters, onFiltersChange }) {
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

  const updateLevelFilter = (level, updates) => {
    const newFilters = { ...filters };
    newFilters[level] = { ...newFilters[level], ...updates };
    
    if (updates.field === '' || !updates.value) {
      if (level === 'level1') {
        delete newFilters.level2;
        delete newFilters.level3;
      } else if (level === 'level2') {
        delete newFilters.level3;
      }
    }
    
    onFiltersChange(newFilters);
  };

  const FilterLevel = ({ level, levelNumber }) => {
    const filter = filters[level] || { field: '', operator: 'contains', value: '' };
    const fieldConfig = FILTER_FIELDS.find(f => f.id === filter.field);
    const isDateField = fieldConfig?.type === 'date';
    const isTagsField = filter.field === 'tags';
    const isBooleanField = fieldConfig?.type === 'boolean';
    const operators = isDateField ? DATE_OPERATORS : (isBooleanField ? [{ id: 'equals', label: 'Is' }, { id: 'notEquals', label: 'Is Not' }] : FILTER_OPERATORS);

    return (
      <div className={styles.filterLevel}>
        <div className={styles.filterRow}>
          <select
            value={filter.field || ''}
            onChange={(e) => updateLevelFilter(level, { 
              field: e.target.value, 
              operator: 'contains',
              value: '',
              value2: ''
            })}
            className={styles.fieldSelect}
          >
            <option value="">Select field...</option>
            {FILTER_FIELDS.map(field => (
              <option key={field.id} value={field.id}>{field.label}</option>
            ))}
          </select>
          
          {filter.field && (
            <>
              <select
                value={filter.operator || 'contains'}
                onChange={(e) => updateLevelFilter(level, { operator: e.target.value })}
                className={styles.operatorSelect}
              >
                {operators.map(op => (
                  <option key={op.id} value={op.id}>{op.label}</option>
                ))}
              </select>

              {isDateField && filter.operator === 'between' ? (
                <div className={styles.dateRangeInputs}>
                  <input
                    type="date"
                    value={filter.value || ''}
                    onChange={(e) => updateLevelFilter(level, { value: e.target.value })}
                    className={styles.dateInput}
                    placeholder="Start date"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={filter.value2 || ''}
                    onChange={(e) => updateLevelFilter(level, { value2: e.target.value })}
                    className={styles.dateInput}
                    placeholder="End date"
                  />
                </div>
              ) : isDateField ? (
                <input
                  type="date"
                  value={filter.value || ''}
                  onChange={(e) => updateLevelFilter(level, { value: e.target.value })}
                  className={styles.valueInput}
                />
              ) : isTagsField ? (
                <select
                  value={filter.value || ''}
                  onChange={(e) => updateLevelFilter(level, { value: e.target.value })}
                  className={styles.valueInput}
                >
                  <option value="">Select tag...</option>
                  {availableTags.map(tag => (
                    <option key={tag.id} value={tag.name}>{tag.name}</option>
                  ))}
                </select>
              ) : isBooleanField ? (
                <select
                  value={filter.value || ''}
                  onChange={(e) => updateLevelFilter(level, { value: e.target.value })}
                  className={styles.valueInput}
                >
                  <option value="">Select...</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={filter.value || ''}
                  onChange={(e) => updateLevelFilter(level, { value: e.target.value })}
                  placeholder="Enter value..."
                  className={styles.valueInput}
                />
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.filterBuilder}>
      <div className={styles.filterSection}>
        <div className={styles.filterItem}>
          <label>Subscription Status</label>
          <select
            value={filters.subscribed || 'true'}
            onChange={(e) => onFiltersChange({
              ...filters,
              subscribed: e.target.value
            })}
            className={styles.subscribedSelect}
          >
            <option value="true">Subscribed</option>
            <option value="false">Unsubscribed</option>
            <option value="">Any</option>
          </select>
        </div>

        <FilterLevel level="level1" levelNumber={1} />
        
        {(filters.level1?.field && filters.level1?.value) && (
          <FilterLevel level="level2" levelNumber={2} />
        )}
        
        {(filters.level2?.field && filters.level2?.value) && (
          <FilterLevel level="level3" levelNumber={3} />
        )}
      </div>

      <button
        onClick={() => {
          const clearedFilters = { subscribed: 'true' };
          onFiltersChange(clearedFilters);
        }}
        className={styles.clearButton}
      >
        Clear All Filters
      </button>
    </div>
  );
}

