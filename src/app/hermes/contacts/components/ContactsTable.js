'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { createSelectColumn } from '@tanstack/react-table';
import { format } from 'date-fns';
import styles from './ContactsTable.module.css';
import AddContactModal from './AddContactModal';
import CsvUploadModal from './CsvUploadModal';
import { addContact, updateContact, deleteContact, getContacts } from '@/lib/actions/contacts';
import { ChevronDownIcon } from '@heroicons/react/24/solid';
import EditContactModal from './EditContactModal';
import BulkEditModal from './BulkEditModal';

const columnHelper = createColumnHelper();

// Draggable column header component
function DraggableColumnHeader({ header, column }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    const startX = e.clientX;
    const startOrder = column.getOrder();

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - startX;
      // Calculate column reordering logic here
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <th
      className={styles.draggableHeader}
      onMouseDown={handleMouseDown}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <div className={styles.headerContent}>
        <span className={styles.dragHandle}>⋮⋮</span>
        {header}
      </div>
    </th>
  );
}

const createColumns = (columnOrder = [], rowSelection, setRowSelection, filteredContacts) => {
  // Create select column for row selection
  const selectColumn = columnHelper.display({
    id: 'select',
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllRowsSelected()}
        onChange={table.getToggleAllRowsSelectedHandler()}
        className={styles.selectCheckbox}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        className={styles.selectCheckbox}
      />
    ),
  });

  return [
    selectColumn,
    columnHelper.accessor('id', {
    header: 'ID',
    id: 'id',
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 10 ? value.substring(0, 10) + '...' : value;
    }
  }),
  columnHelper.accessor('firstName', {
    header: 'First Name',
    id: 'firstName',
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 20 ? value.substring(0, 20) + '...' : value;
    }
  }),
  columnHelper.accessor('lastName', {
    header: 'Last Name',
    id: 'lastName',
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 20 ? value.substring(0, 20) + '...' : value;
    }
  }),
  columnHelper.accessor('phone', {
    header: 'Phone',
    id: 'phone',
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 15 ? value.substring(0, 15) + '...' : value;
    }
  }),
  columnHelper.accessor('email', {
    header: 'Email',
    id: 'email',
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 30 ? value.substring(0, 30) + '...' : value;
    }
  }),
  columnHelper.accessor('clickid', {
    header: 'Click IDs',
    id: 'clickid',
    cell: info => {
      const clickids = info.getValue() || [];
      const value = Array.isArray(clickids) ? clickids.join(', ') : String(clickids || 'null');
      return value.length > 30 ? value.substring(0, 30) + '...' : value;
    }
  }),
  columnHelper.accessor('source', {
    header: 'Source',
    id: 'source',
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 25 ? value.substring(0, 25) + '...' : value;
    }
  }),
  columnHelper.accessor('age', {
    header: 'Age',
    id: 'age',
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 10 ? value.substring(0, 10) + '...' : value;
    }
  }),
  columnHelper.accessor('ip', {
    header: 'IP',
    id: 'ip',
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 15 ? value.substring(0, 15) + '...' : value;
    }
  }),
  columnHelper.accessor('useragent', {
    header: 'User Agent',
    id: 'useragent',
    cell: info => {
      const ua = info.getValue();
      const value = ua ? String(ua) : 'null';
      return value.length > 40 ? value.substring(0, 40) + '...' : value;
    }
  }),
  columnHelper.accessor('referrer', {
    header: 'Referrer',
    id: 'referrer',
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 30 ? value.substring(0, 30) + '...' : value;
    }
  }),
  columnHelper.accessor('subscribed', {
    header: 'Subscribed',
    id: 'subscribed',
  }),
  columnHelper.accessor('lastMessageSent', {
    header: 'Last Message',
    id: 'lastMessageSent',
    cell: info => info.getValue() ? format(new Date(info.getValue()), 'yyyy-MM-dd HH:mm') : 'Never',
  }),
  columnHelper.accessor('tags', {
    header: 'Tags',
    id: 'tags',
    cell: info => {
      const tags = info.getValue() || [];
      if (tags.length === 0) return 'No tags';
      const tagNames = tags.map(tag => tag.name).join(', ');
      return tagNames.length > 30 ? tagNames.substring(0, 30) + '...' : tagNames;
    }
  }),
  columnHelper.accessor('createdAt', {
    header: 'Created At',
    id: 'createdAt',
    cell: info => format(new Date(info.getValue()), 'yyyy-MM-dd HH:mm'),
  }),
  columnHelper.accessor('updatedAt', {
    header: 'Updated At',
      id: 'updatedAt',
    cell: info => format(new Date(info.getValue()), 'yyyy-MM-dd HH:mm'),
  }),
  ];
};

// Available filter fields with their types
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
  { id: 'tags', label: 'Tags', type: 'tags' },
  { id: 'createdAt', label: 'Created At', type: 'date' },
  { id: 'updatedAt', label: 'Updated At', type: 'date' },
  { id: 'lastMessageSent', label: 'Last Message Sent', type: 'date' },
];

// Filter operators
const FILTER_OPERATORS = [
  { id: 'equals', label: 'Equals' },
  { id: 'contains', label: 'Contains' },
  { id: 'startsWith', label: 'Starts With' },
  { id: 'endsWith', label: 'Ends With' },
  { id: 'notEquals', label: 'Not Equals' },
];

// Date operators
const DATE_OPERATORS = [
  { id: 'equals', label: 'On' },
  { id: 'before', label: 'Before' },
  { id: 'after', label: 'After' },
  { id: 'between', label: 'Between' },
];

// Filter menu component with 3-level nested filters
function FilterMenu({ isOpen, onClose, filters, setFilters, contacts, setFilteredContacts }) {
  const [availableTags] = useMemo(() => {
    const tagSet = new Set();
    contacts.forEach(contact => {
      contact.tags?.forEach(tag => tagSet.add(tag.name));
    });
    return [Array.from(tagSet)];
  }, [contacts]);

  // Get unique values for a field (for autocomplete/suggestions)
  const getFieldValues = (fieldId) => {
    const values = new Set();
    contacts.forEach(contact => {
      const value = contact[fieldId];
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => values.add(String(v)));
        } else {
          values.add(String(value));
        }
      }
    });
    return Array.from(values).sort().slice(0, 20); // Limit to 20 for performance
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    applyFilters(newFilters);
  };

  const applyFilters = (filterConfig) => {
    const filtered = contacts.filter(contact => {
      // Apply subscribed filter
      if (filterConfig.subscribed === 'true' && !contact.subscribed) {
        return false;
      }
      if (filterConfig.subscribed === 'false' && contact.subscribed) {
        return false;
      }

      // Apply level 1 filter
      if (filterConfig.level1?.field && filterConfig.level1?.value) {
        if (!matchesFilter(contact, filterConfig.level1)) {
          return false;
        }
      }

      // Apply level 2 filter
      if (filterConfig.level2?.field && filterConfig.level2?.value) {
        if (!matchesFilter(contact, filterConfig.level2)) {
          return false;
        }
      }

      // Apply level 3 filter
      if (filterConfig.level3?.field && filterConfig.level3?.value) {
        if (!matchesFilter(contact, filterConfig.level3)) {
          return false;
        }
      }

      return true;
    });

    setFilteredContacts(filtered);
  };

  const matchesFilter = (contact, filter) => {
    const { field, operator, value, value2 } = filter;
    const contactValue = contact[field];

    // Handle array fields (clickid, tags)
    if (field === 'clickid' && Array.isArray(contactValue)) {
      const searchValue = value.toLowerCase();
      return contactValue.some(cid => {
        const cidStr = String(cid).toLowerCase();
        switch (operator) {
          case 'equals': return cidStr === searchValue;
          case 'contains': return cidStr.includes(searchValue);
          case 'startsWith': return cidStr.startsWith(searchValue);
          case 'endsWith': return cidStr.endsWith(searchValue);
          case 'notEquals': return cidStr !== searchValue;
          default: return false;
        }
      });
    }

    if (field === 'tags' && Array.isArray(contact.tags)) {
      const searchValue = value.toLowerCase();
      return contact.tags.some(tag => {
        const tagName = tag.name.toLowerCase();
        switch (operator) {
          case 'equals': return tagName === searchValue;
          case 'contains': return tagName.includes(searchValue);
          case 'startsWith': return tagName.startsWith(searchValue);
          case 'endsWith': return tagName.endsWith(searchValue);
          case 'notEquals': return tagName !== searchValue;
          default: return false;
        }
      });
    }

    // Handle date fields
    if (field === 'createdAt' || field === 'updatedAt' || field === 'lastMessageSent') {
      if (!contactValue) return false;
      const contactDate = new Date(contactValue);
      const filterDate = new Date(value);
      
      switch (operator) {
        case 'equals':
          return contactDate.toDateString() === filterDate.toDateString();
        case 'before':
          return contactDate < filterDate;
        case 'after':
          return contactDate > filterDate;
        case 'between':
          if (!value2) return false;
          const filterDate2 = new Date(value2);
          return contactDate >= filterDate && contactDate <= filterDate2;
        default:
          return false;
      }
    }

    // Handle text fields
    const contactStr = String(contactValue || '').toLowerCase();
    const searchStr = String(value || '').toLowerCase();

    switch (operator) {
      case 'equals':
        return contactStr === searchStr;
      case 'contains':
        return contactStr.includes(searchStr);
      case 'startsWith':
        return contactStr.startsWith(searchStr);
      case 'endsWith':
        return contactStr.endsWith(searchStr);
      case 'notEquals':
        return contactStr !== searchStr;
      default:
        return false;
    }
  };

  const updateLevelFilter = (level, updates) => {
    const newFilters = { ...filters };
    newFilters[level] = { ...newFilters[level], ...updates };
    
    // If clearing a filter, also clear all levels below it
    if (updates.field === '' || !updates.value) {
      if (level === 'level1') {
        delete newFilters.level2;
        delete newFilters.level3;
      } else if (level === 'level2') {
        delete newFilters.level3;
      }
    }
    
    handleFilterChange(newFilters);
  };

  const FilterLevel = ({ level, levelNumber }) => {
    const filter = filters[level] || { field: '', operator: 'contains', value: '' };
    const fieldConfig = FILTER_FIELDS.find(f => f.id === filter.field);
    const isDateField = fieldConfig?.type === 'date';
    const isTagsField = filter.field === 'tags';
    const operators = isDateField ? DATE_OPERATORS : FILTER_OPERATORS;
    const fieldValues = filter.field ? getFieldValues(filter.field) : [];

    return (
      <div className={styles.filterLevel}>
        <div className={styles.filterItem}>
          <label>Filter {levelNumber}</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <select
              value={filter.field || ''}
              onChange={(e) => updateLevelFilter(level, { 
                field: e.target.value, 
                operator: 'contains',
                value: '',
                value2: ''
              })}
              style={{ flex: 1 }}
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
                  style={{ width: '140px' }}
                >
                  {operators.map(op => (
                    <option key={op.id} value={op.id}>{op.label}</option>
                  ))}
                </select>

                {isDateField && filter.operator === 'between' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                    <input
                      type="date"
                      value={filter.value || ''}
                      onChange={(e) => updateLevelFilter(level, { value: e.target.value })}
                      placeholder="Start date"
                    />
                    <input
                      type="date"
                      value={filter.value2 || ''}
                      onChange={(e) => updateLevelFilter(level, { value2: e.target.value })}
                      placeholder="End date"
                    />
                  </div>
                ) : isDateField ? (
                  <input
                    type="date"
                    value={filter.value || ''}
                    onChange={(e) => updateLevelFilter(level, { value: e.target.value })}
                    style={{ flex: 1 }}
                  />
                ) : isTagsField ? (
                  <select
                    value={filter.value || ''}
                    onChange={(e) => updateLevelFilter(level, { value: e.target.value })}
                    style={{ flex: 1 }}
                  >
                    <option value="">Select tag...</option>
                    {availableTags.map(tag => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      type="text"
                      list={`${level}-values`}
                      value={filter.value || ''}
                      onChange={(e) => updateLevelFilter(level, { value: e.target.value })}
                      placeholder="Enter value..."
                      style={{ flex: 1 }}
                    />
                    {fieldValues.length > 0 && (
                      <datalist id={`${level}-values`}>
                        {fieldValues.map((val, idx) => (
                          <option key={idx} value={val} />
                        ))}
                      </datalist>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className={styles.filterMenu}>
      <div className={styles.filterMenuHeader}>
        <h3>Filters</h3>
        <div className={styles.filterMenuActions}>
          <button onClick={() => {
            const clearedFilters = { subscribed: 'true' };
            setFilters(clearedFilters);
            applyFilters(clearedFilters);
          }}>Clear All</button>
          <button onClick={onClose}>&times;</button>
        </div>
      </div>
      
      <div className={styles.filterList}>
        <div className={styles.filterItem}>
          <label>Subscription Status</label>
          <select
            value={filters.subscribed || 'true'}
            onChange={(e) => handleFilterChange({
              ...filters,
              subscribed: e.target.value
            })}
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
    </div>
  );
}

function FieldsMenu({ isOpen, onClose, visibleFields, setVisibleFields, columnOrder, setColumnOrder }) {
  const fieldOptions = [
    { field: 'id', label: 'ID' },
    { field: 'firstName', label: 'First Name' },
    { field: 'lastName', label: 'Last Name' },
    { field: 'phone', label: 'Phone' },
    { field: 'email', label: 'Email' },
    { field: 'clickid', label: 'Click IDs' },
    { field: 'source', label: 'Source' },
    { field: 'age', label: 'Age' },
    { field: 'ip', label: 'IP' },
    { field: 'useragent', label: 'User Agent' },
    { field: 'referrer', label: 'Referrer' },
    { field: 'subscribed', label: 'Subscribed' },
    { field: 'tags', label: 'Tags' },
    { field: 'lastMessageSent', label: 'Last Message' },
    { field: 'createdAt', label: 'Created At' },
    { field: 'updatedAt', label: 'Updated At' }
  ];

  if (!isOpen) return null;

  const handleSelectAll = () => {
    setVisibleFields(fieldOptions.map(f => f.field));
  };

  const handleSelectNone = () => {
    setVisibleFields(['id']);
  };

  const handleMoveUp = (field) => {
    const currentIndex = columnOrder.indexOf(field);
    if (currentIndex > 0) {
      const newOrder = [...columnOrder];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
      setColumnOrder(newOrder);
    }
  };

  const handleMoveDown = (field) => {
    const currentIndex = columnOrder.indexOf(field);
    if (currentIndex < columnOrder.length - 1) {
      const newOrder = [...columnOrder];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
      setColumnOrder(newOrder);
    }
  };

  return (
    <div className={styles.fieldsMenu}>
      <div className={styles.fieldsMenuHeader}>
        <h3>Visible Fields & Order</h3>
        <div className={styles.fieldsMenuActions}>
          <button onClick={handleSelectAll}>All</button>
          <button onClick={handleSelectNone}>None</button>
          <button onClick={onClose}>&times;</button>
        </div>
      </div>
      <div className={styles.fieldsList}>
        {columnOrder.map((field) => {
          const fieldOption = fieldOptions.find(f => f.field === field);
          if (!fieldOption) return null;
          const isVisible = visibleFields.includes(field);
          const currentIndex = columnOrder.indexOf(field);
          
          return (
            <div key={field} className={styles.fieldItemRow}>
              <label className={styles.fieldItem}>
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setVisibleFields([...visibleFields, field]);
                    } else {
                      if (visibleFields.length > 1) {
                        setVisibleFields(visibleFields.filter(f => f !== field));
                      }
                    }
                  }}
                />
                {fieldOption.label}
              </label>
              <div className={styles.fieldOrderControls}>
                <button 
                  onClick={() => handleMoveUp(field)}
                  disabled={currentIndex === 0}
                  className={styles.orderButton}
                >
                  ↑
                </button>
                <button 
                  onClick={() => handleMoveDown(field)}
                  disabled={currentIndex === columnOrder.length - 1}
                  className={styles.orderButton}
                >
                  ↓
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ContactsTable({ initialContacts }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [filteredContacts, setFilteredContacts] = useState(initialContacts);
  const [loading, setLoading] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showFiltersMenu, setShowFiltersMenu] = useState(false);
  const [showFieldsMenu, setShowFieldsMenu] = useState(false);
  const [activeFilters, setActiveFilters] = useState({ subscribed: 'true' });
  const defaultColumnOrder = [
    'id', 'firstName', 'lastName', 'phone', 'email', 'clickid', 
    'source', 'age', 'ip', 'useragent', 'referrer',
    'subscribed', 'tags', 'lastMessageSent', 'createdAt', 'updatedAt'
  ];
  const [columnOrder, setColumnOrder] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('contactsColumnOrder');
      return saved ? JSON.parse(saved) : defaultColumnOrder;
    }
    return defaultColumnOrder;
  });
  const [visibleFields, setVisibleFields] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('contactsVisibleFields');
      return saved ? JSON.parse(saved) : defaultColumnOrder;
    }
    return defaultColumnOrder;
  });
  const [editingContact, setEditingContact] = useState(null);
  const [rowSelection, setRowSelection] = useState({});
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const actionsMenuRef = useRef(null);

  // Save column order to localStorage
  useEffect(() => {
    localStorage.setItem('contactsColumnOrder', JSON.stringify(columnOrder));
  }, [columnOrder]);

  // Save visible fields to localStorage
  useEffect(() => {
    localStorage.setItem('contactsVisibleFields', JSON.stringify(visibleFields));
  }, [visibleFields]);

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
    };

    if (showActionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showActionsMenu]);

  useEffect(() => {
    if (!Array.isArray(contacts)) {
      setFilteredContacts([]);
      return;
    }

    // Apply filters first
    let filtered = contacts;
    
    // Apply subscribed filter
    if (activeFilters.subscribed === 'true') {
      filtered = filtered.filter(contact => contact.subscribed === true);
    } else if (activeFilters.subscribed === 'false') {
      filtered = filtered.filter(contact => contact.subscribed === false);
    }

    // Apply level filters (using the same logic as FilterMenu)
    if (activeFilters.level1?.field && activeFilters.level1?.value) {
      filtered = filtered.filter(contact => {
        return applyLevelFilter(contact, activeFilters.level1);
      });
    }
    if (activeFilters.level2?.field && activeFilters.level2?.value) {
      filtered = filtered.filter(contact => {
        return applyLevelFilter(contact, activeFilters.level2);
      });
    }
    if (activeFilters.level3?.field && activeFilters.level3?.value) {
      filtered = filtered.filter(contact => {
        return applyLevelFilter(contact, activeFilters.level3);
      });
    }

    // Then apply search query
    if (!searchQuery.trim()) {
      setFilteredContacts(filtered);
      return;
    }

    const query = searchQuery.toLowerCase();
    const searchFiltered = filtered.filter(contact => {
      return (
        contact.firstName?.toLowerCase().includes(query) ||
        contact.lastName?.toLowerCase().includes(query) ||
        contact.phone?.toLowerCase().includes(query) ||
        contact.email?.toLowerCase().includes(query) ||
        (Array.isArray(contact.clickid) ? contact.clickid.join(' ').toLowerCase() : String(contact.clickid || '')).includes(query) ||
        contact.source?.toLowerCase().includes(query) ||
        contact.age?.toLowerCase().includes(query) ||
        contact.ip?.toLowerCase().includes(query) ||
        contact.useragent?.toLowerCase().includes(query) ||
        contact.referrer?.toLowerCase().includes(query) ||
        String(contact.subscribed).toLowerCase().includes(query) ||
        contact.tags?.some(tag => tag.name.toLowerCase().includes(query))
      );
    });
    setFilteredContacts(searchFiltered);
  }, [searchQuery, contacts, activeFilters]);

  // Helper function to apply level filter (matches FilterMenu logic)
  const applyLevelFilter = (contact, filter) => {
    const { field, operator, value, value2 } = filter;
    const contactValue = contact[field];

    // Handle array fields (clickid, tags)
    if (field === 'clickid' && Array.isArray(contactValue)) {
      const searchValue = value.toLowerCase();
      return contactValue.some(cid => {
        const cidStr = String(cid).toLowerCase();
        switch (operator) {
          case 'equals': return cidStr === searchValue;
          case 'contains': return cidStr.includes(searchValue);
          case 'startsWith': return cidStr.startsWith(searchValue);
          case 'endsWith': return cidStr.endsWith(searchValue);
          case 'notEquals': return cidStr !== searchValue;
          default: return false;
        }
      });
    }

    if (field === 'tags' && Array.isArray(contact.tags)) {
      const searchValue = value.toLowerCase();
      return contact.tags.some(tag => {
        const tagName = tag.name.toLowerCase();
        switch (operator) {
          case 'equals': return tagName === searchValue;
          case 'contains': return tagName.includes(searchValue);
          case 'startsWith': return tagName.startsWith(searchValue);
          case 'endsWith': return tagName.endsWith(searchValue);
          case 'notEquals': return tagName !== searchValue;
          default: return false;
        }
      });
    }

    // Handle date fields
    if (field === 'createdAt' || field === 'updatedAt' || field === 'lastMessageSent') {
      if (!contactValue) return false;
      const contactDate = new Date(contactValue);
      const filterDate = new Date(value);
      
      switch (operator) {
        case 'equals':
          return contactDate.toDateString() === filterDate.toDateString();
        case 'before':
          return contactDate < filterDate;
        case 'after':
          return contactDate > filterDate;
        case 'between':
          if (!value2) return false;
          const filterDate2 = new Date(value2);
          return contactDate >= filterDate && contactDate <= filterDate2;
        default:
          return false;
      }
    }

    // Handle text fields
    const contactStr = String(contactValue || '').toLowerCase();
    const searchStr = String(value || '').toLowerCase();

    switch (operator) {
      case 'equals':
        return contactStr === searchStr;
      case 'contains':
        return contactStr.includes(searchStr);
      case 'startsWith':
        return contactStr.startsWith(searchStr);
      case 'endsWith':
        return contactStr.endsWith(searchStr);
      case 'notEquals':
        return contactStr !== searchStr;
      default:
        return false;
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Only refresh the visible contacts (20 most recent)
      const freshContacts = await getContacts(20);
      setContacts(freshContacts);
      setFilteredContacts(freshContacts);
      setLastSynced(new Date());
    } catch (error) {
      console.error('Error syncing contacts:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    
    try {
      setLoading(true);
      await deleteContact(id);
      setContacts(contacts.filter(contact => contact.id !== id));
      setFilteredContacts(filteredContacts.filter(contact => contact.id !== id));
    } catch (error) {
      console.error('Error deleting contact:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (contact) => {
    setEditingContact(contact);
  };

  const handleUpdate = async (updatedContact) => {
    try {
      setLoading(true);
      const result = await updateContact(updatedContact);
      setContacts(contacts.map(c => 
        c.id === result.id ? result : c
      ));
      setFilteredContacts(filteredContacts.map(c => 
        c.id === result.id ? result : c
      ));
      setEditingContact(null);
    } catch (error) {
      console.error('Error updating contact:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (newContact) => {
    try {
      setLoading(true);
      const contact = await addContact(newContact);
      setContacts([contact, ...contacts]);
      setFilteredContacts([contact, ...filteredContacts]);
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding contact:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedContacts.length} contact(s)? This action cannot be undone.`)) {
      return;
    }

    setActionLoading(true);
    try {
      for (const contact of selectedContacts) {
        await deleteContact(contact.id);
      }
      // Refresh contacts
      await handleSync();
      setRowSelection({});
      setShowActionsMenu(false);
    } catch (error) {
      console.error('Error deleting contacts:', error);
      alert('Failed to delete some contacts');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkSubscribe = async (subscribe) => {
    setActionLoading(true);
    try {
      for (const contact of selectedContacts) {
        await updateContact({
          id: contact.id,
          phone: contact.phone,
          subscribed: subscribe
        });
      }
      // Refresh contacts
      await handleSync();
      setRowSelection({});
      setShowActionsMenu(false);
    } catch (error) {
      console.error(`Error ${subscribe ? 'subscribing' : 'unsubscribing'} contacts:`, error);
      alert(`Failed to ${subscribe ? 'subscribe' : 'unsubscribe'} some contacts`);
    } finally {
      setActionLoading(false);
    }
  };

  const columns = useMemo(() => createColumns(columnOrder, rowSelection, setRowSelection, filteredContacts), [columnOrder, rowSelection, filteredContacts]);
  
  const visibleColumns = useMemo(() => {
    // Always include select column first, then filter other columns
    const selectCol = columns.find(col => col.id === 'select');
    const otherCols = columns.filter(col => col.id !== 'select' && visibleFields.includes(col.id));
    return selectCol ? [selectCol, ...otherCols] : otherCols;
  }, [columns, visibleFields]);

  const table = useReactTable({
    data: filteredContacts,
    columns: visibleColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => String(row.id),
    state: {
      globalFilter,
      columnFilters,
      rowSelection,
      columnOrder: ['select', ...columnOrder.filter(f => visibleFields.includes(f))],
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedContacts = selectedRows.map(row => row.original);

  const contactsList = Array.isArray(filteredContacts) ? filteredContacts : [];

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableHeader}>
        <div className={styles.tableControls}>
          {selectedContacts.length > 0 && (
            <div className={styles.actionsMenuContainer} ref={actionsMenuRef}>
              <button 
                className={styles.actionsButton}
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                disabled={actionLoading}
              >
                Actions ({selectedContacts.length})
                <span className={styles.chevron}>{showActionsMenu ? '▲' : '▼'}</span>
              </button>
              {showActionsMenu && (
                <div className={styles.actionsDropdown}>
                  <button
                    className={styles.actionItem}
                    onClick={() => {
                      setShowBulkEdit(true);
                      setShowActionsMenu(false);
                    }}
                    disabled={actionLoading}
                  >
                    ✏️ Bulk Edit
                  </button>
                  <button
                    className={styles.actionItem}
                    onClick={handleBulkDelete}
                    disabled={actionLoading}
                  >
                    🗑️ Delete Selected
                  </button>
                  <button
                    className={styles.actionItem}
                    onClick={() => handleBulkSubscribe(true)}
                    disabled={actionLoading}
                  >
                    ✓ Subscribe Selected
                  </button>
                  <button
                    className={styles.actionItem}
                    onClick={() => handleBulkSubscribe(false)}
                    disabled={actionLoading}
                  >
                    ✗ Unsubscribe Selected
                  </button>
                </div>
              )}
            </div>
          )}
          <div className={styles.filters}>
            <button 
              className={`${styles.syncButton} ${isSyncing ? styles.syncing : ''}`}
              onClick={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? 'Syncing...' : '↻ Refresh'}
            </button>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            <button 
              className={styles.filterButton}
              onClick={() => setShowFiltersMenu(!showFiltersMenu)}
            >
              Filters
              <span className={styles.badge}>
                {Object.keys(activeFilters).length || 'None'}
              </span>
              <span className={styles.chevron}>▼</span>
            </button>
            <button 
              className={styles.filterButton}
              onClick={() => setShowFieldsMenu(!showFieldsMenu)}
            >
              Fields
              <span className={styles.badge}>
                {visibleFields.length}
              </span>
              <ChevronDownIcon className={styles.chevron} />
            </button>
            <div className={styles.showing}>
              Showing {contactsList.length} of {contacts.length}
            </div>
            
            <FilterMenu
              isOpen={showFiltersMenu}
              onClose={() => setShowFiltersMenu(false)}
              filters={activeFilters}
              setFilters={setActiveFilters}
              contacts={contacts}
              setFilteredContacts={setFilteredContacts}
            />
            
            <FieldsMenu
              isOpen={showFieldsMenu}
              onClose={() => setShowFieldsMenu(false)}
              visibleFields={visibleFields}
              setVisibleFields={setVisibleFields}
              columnOrder={columnOrder}
              setColumnOrder={setColumnOrder}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button 
              className={styles.addRecord}
              onClick={() => setShowCsvModal(true)}
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}
            >
              📄 Upload CSV
            </button>
            <button 
              className={styles.addRecord}
              onClick={() => setShowAddModal(true)}
            >
              Add Contact
            </button>
          </div>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className={header.id === 'select' ? styles.checkboxCell : styles.draggableHeader}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const contact = row.original;
              return (
                <tr key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className={cell.column.id === 'select' ? styles.checkboxCell : ''} data-column={cell.column.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  <td className={styles.actions}>
                    <button 
                      onClick={() => handleEdit(contact)}
                      className={styles.actionButton}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(contact.id)}
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

      {editingContact && (
        <EditContactModal
          contact={editingContact}
          onClose={() => setEditingContact(null)}
          onUpdate={handleUpdate}
        />
      )}

      {showAddModal && (
        <AddContactModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}

      {showCsvModal && (
        <CsvUploadModal
          onClose={() => setShowCsvModal(false)}
          onUploadComplete={async () => {
            // Refresh contacts after CSV upload (only visible contacts)
            const freshContacts = await getContacts(20);
            setContacts(freshContacts);
            setFilteredContacts(freshContacts);
          }}
        />
      )}

      {showBulkEdit && selectedContacts.length > 0 && (
        <BulkEditModal
          selectedContacts={selectedContacts}
          onClose={() => {
            setShowBulkEdit(false);
            setRowSelection({});
          }}
          onUpdate={async () => {
            await handleSync();
            setRowSelection({});
          }}
        />
      )}
    </div>
  );
}
