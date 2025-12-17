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
import { format } from 'date-fns';
import styles from './ContactsTable.module.css';
import AddContactModal from './AddContactModal';
import CsvUploadModal from './CsvUploadModal';
import { addContact, updateContact, deleteContact, getContacts, getContactsPaginated } from '@/lib/actions/contacts';
import { ChevronDownIcon } from '@heroicons/react/24/solid';
import EditContactModal from './EditContactModal';
import BulkEditModal from './BulkEditModal';

const columnHelper = createColumnHelper();

const createColumns = (columnOrder = [], rowSelection, setRowSelection, filteredContacts, columnSizing = {}) => {
  // Create select column for row selection
  const selectColumn = columnHelper.display({
    id: 'select',
    size: 50,
    minSize: 40,
    maxSize: 60,
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
    size: columnSizing.id || 120, // Default wider width for ID
    minSize: 80,
    maxSize: 300,
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 10 ? value.substring(0, 10) + '...' : value;
    }
  }),
  columnHelper.accessor('firstName', {
    header: 'First Name',
    id: 'firstName',
    size: columnSizing.firstName || 120,
    minSize: 80,
    maxSize: 300,
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 20 ? value.substring(0, 20) + '...' : value;
    }
  }),
  columnHelper.accessor('lastName', {
    header: 'Last Name',
    id: 'lastName',
    size: columnSizing.lastName || 120,
    minSize: 80,
    maxSize: 300,
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 20 ? value.substring(0, 20) + '...' : value;
    }
  }),
  columnHelper.accessor('phone', {
    header: 'Phone',
    id: 'phone',
    size: columnSizing.phone || 150,
    minSize: 100,
    maxSize: 300,
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 15 ? value.substring(0, 15) + '...' : value;
    }
  }),
  columnHelper.accessor('email', {
    header: 'Email',
    id: 'email',
    size: columnSizing.email || 200,
    minSize: 120,
    maxSize: 400,
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 30 ? value.substring(0, 30) + '...' : value;
    }
  }),
  columnHelper.accessor('clickid', {
    header: 'Click IDs',
    id: 'clickid',
    size: columnSizing.clickid || 150,
    minSize: 100,
    maxSize: 300,
    cell: info => {
      const clickids = info.getValue() || [];
      const value = Array.isArray(clickids) ? clickids.join(', ') : String(clickids || 'null');
      return value.length > 30 ? value.substring(0, 30) + '...' : value;
    }
  }),
  columnHelper.accessor('source', {
    header: 'Source',
    id: 'source',
    size: columnSizing.source || 120,
    minSize: 80,
    maxSize: 300,
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 25 ? value.substring(0, 25) + '...' : value;
    }
  }),
  columnHelper.accessor('age', {
    header: 'Age',
    id: 'age',
    size: columnSizing.age || 80,
    minSize: 60,
    maxSize: 150,
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 10 ? value.substring(0, 10) + '...' : value;
    }
  }),
  columnHelper.accessor('ip', {
    header: 'IP',
    id: 'ip',
    size: columnSizing.ip || 120,
    minSize: 80,
    maxSize: 200,
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 15 ? value.substring(0, 15) + '...' : value;
    }
  }),
  columnHelper.accessor('useragent', {
    header: 'User Agent',
    id: 'useragent',
    size: columnSizing.useragent || 250,
    minSize: 150,
    maxSize: 500,
    cell: info => {
      const ua = info.getValue();
      const value = ua ? String(ua) : 'null';
      return value.length > 40 ? value.substring(0, 40) + '...' : value;
    }
  }),
  columnHelper.accessor('referrer', {
    header: 'Referrer',
    id: 'referrer',
    size: columnSizing.referrer || 200,
    minSize: 120,
    maxSize: 400,
    cell: info => {
      const value = String(info.getValue() || '');
      return value.length > 30 ? value.substring(0, 30) + '...' : value;
    }
  }),
  columnHelper.accessor('subscribed', {
    header: 'Subscribed',
    id: 'subscribed',
    size: columnSizing.subscribed || 100,
    minSize: 80,
    maxSize: 150,
  }),
  columnHelper.accessor('lastMessageSent', {
    header: 'Last Message',
    id: 'lastMessageSent',
    size: columnSizing.lastMessageSent || 160,
    minSize: 120,
    maxSize: 250,
    cell: info => info.getValue() ? format(new Date(info.getValue()), 'yyyy-MM-dd HH:mm') : 'Never',
  }),
  columnHelper.accessor('tags', {
    header: 'Tags',
    id: 'tags',
    size: columnSizing.tags || 150,
    minSize: 100,
    maxSize: 300,
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
    size: columnSizing.createdAt || 160,
    minSize: 120,
    maxSize: 250,
    cell: info => format(new Date(info.getValue()), 'yyyy-MM-dd HH:mm'),
  }),
  columnHelper.accessor('updatedAt', {
    header: 'Updated At',
    id: 'updatedAt',
    size: columnSizing.updatedAt || 160,
    minSize: 120,
    maxSize: 250,
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
  { id: 'doesNotContain', label: 'Does Not Contain' },
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
      // For "doesNotContain", check that NO tags contain the value
      if (operator === 'doesNotContain') {
        return !contact.tags.some(tag => {
          const tagName = tag.name.toLowerCase();
          return tagName.includes(searchValue);
        });
      }
      // For other operators, check if at least one tag matches
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
      const filterDate = new Date(value);
      
      // For "before" operator on lastMessageSent, include null values (never messaged)
      if (field === 'lastMessageSent' && operator === 'before') {
        return !contactValue || new Date(contactValue) < filterDate;
      }
      
      // For other operators or fields, null values don't match
      if (!contactValue) return false;
      
      const contactDate = new Date(contactValue);
      
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
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('contactsPageSize');
      return saved ? parseInt(saved, 10) : 20;
    }
    return 20;
  });
  const [totalContacts, setTotalContacts] = useState(initialContacts?.length || 0);
  const [totalPages, setTotalPages] = useState(1);
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
  const [columnSizing, setColumnSizing] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('contactsColumnSizing');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
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

  // Save column sizing to localStorage
  useEffect(() => {
    localStorage.setItem('contactsColumnSizing', JSON.stringify(columnSizing));
  }, [columnSizing]);

  // Save page size to localStorage
  useEffect(() => {
    localStorage.setItem('contactsPageSize', String(pageSize));
  }, [pageSize]);

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

  // Fetch paginated contacts when page, pageSize, filters, or search changes
  useEffect(() => {
    const fetchContacts = async () => {
      setLoading(true);
      try {
        const filters = {
          subscribed: activeFilters.subscribed,
          search: searchQuery.trim() || undefined,
          level1: activeFilters.level1,
          level2: activeFilters.level2,
          level3: activeFilters.level3,
        };
        
        const result = await getContactsPaginated(page, pageSize, filters);
        setContacts(result.contacts);
        setFilteredContacts(result.contacts); // Server already filtered, so use directly
        setTotalContacts(result.total);
        setTotalPages(result.totalPages);
      } catch (error) {
        console.error('Error fetching contacts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [page, pageSize, activeFilters.subscribed, searchQuery, activeFilters.level1, activeFilters.level2, activeFilters.level3]);

  // Reset to page 0 when filters or search change
  useEffect(() => {
    setPage(0);
  }, [activeFilters.subscribed, searchQuery, activeFilters.level1, activeFilters.level2, activeFilters.level3]);

  // Apply level filters client-side to current page (for non-tag filters that aren't server-side yet)
  useEffect(() => {
    if (!Array.isArray(contacts)) {
      setFilteredContacts([]);
      return;
    }

    let filtered = [...contacts];

    // Only apply client-side filtering for non-tag fields (tag filtering is now server-side)
    // This is a fallback for other field types that aren't yet server-side
    const hasNonTagFilters = 
      (activeFilters.level1?.field && activeFilters.level1?.value && activeFilters.level1?.field !== 'tags') ||
      (activeFilters.level2?.field && activeFilters.level2?.value && activeFilters.level2?.field !== 'tags') ||
      (activeFilters.level3?.field && activeFilters.level3?.value && activeFilters.level3?.field !== 'tags');

    if (hasNonTagFilters) {
      if (activeFilters.level1?.field && activeFilters.level1?.value && activeFilters.level1?.field !== 'tags') {
        filtered = filtered.filter(contact => {
          return applyLevelFilter(contact, activeFilters.level1);
        });
      }
      if (activeFilters.level2?.field && activeFilters.level2?.value && activeFilters.level2?.field !== 'tags') {
        filtered = filtered.filter(contact => {
          return applyLevelFilter(contact, activeFilters.level2);
        });
      }
      if (activeFilters.level3?.field && activeFilters.level3?.value && activeFilters.level3?.field !== 'tags') {
        filtered = filtered.filter(contact => {
          return applyLevelFilter(contact, activeFilters.level3);
        });
      }
      setFilteredContacts(filtered);
    } else {
      // No client-side filtering needed, use server-filtered results directly
      setFilteredContacts(contacts);
    }
  }, [contacts, activeFilters.level1, activeFilters.level2, activeFilters.level3]);

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
      // For "doesNotContain", check that NO tags contain the value
      if (operator === 'doesNotContain') {
        return !contact.tags.some(tag => {
          const tagName = tag.name.toLowerCase();
          return tagName.includes(searchValue);
        });
      }
      // For other operators, check if at least one tag matches
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
      const filterDate = new Date(value);
      
      // For "before" operator on lastMessageSent, include null values (never messaged)
      if (field === 'lastMessageSent' && operator === 'before') {
        return !contactValue || new Date(contactValue) < filterDate;
      }
      
      // For other operators or fields, null values don't match
      if (!contactValue) return false;
      
      const contactDate = new Date(contactValue);
      
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
      const filters = {
        subscribed: activeFilters.subscribed,
        search: searchQuery.trim() || undefined,
      };
      const result = await getContactsPaginated(page, pageSize, filters);
      setContacts(result.contacts);
      setFilteredContacts(result.contacts);
      setTotalContacts(result.total);
      setTotalPages(result.totalPages);
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
      // Refresh current page
      const filters = {
        subscribed: activeFilters.subscribed,
        search: searchQuery.trim() || undefined,
      };
      const result = await getContactsPaginated(page, pageSize, filters);
      setContacts(result.contacts);
      setTotalContacts(result.total);
      setTotalPages(result.totalPages);
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
      await updateContact(updatedContact);
      // Refresh current page
      const filters = {
        subscribed: activeFilters.subscribed,
        search: searchQuery.trim() || undefined,
      };
      const result = await getContactsPaginated(page, pageSize, filters);
      setContacts(result.contacts);
      setTotalContacts(result.total);
      setTotalPages(result.totalPages);
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
      await addContact(newContact);
      // Refresh and go to first page to see the new contact
      setPage(0);
      const filters = {
        subscribed: activeFilters.subscribed,
        search: searchQuery.trim() || undefined,
      };
      const result = await getContactsPaginated(0, pageSize, filters);
      setContacts(result.contacts);
      setTotalContacts(result.total);
      setTotalPages(result.totalPages);
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

  const columns = useMemo(() => createColumns(columnOrder, rowSelection, setRowSelection, filteredContacts, columnSizing), [columnOrder, rowSelection, filteredContacts, columnSizing]);
  
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
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => String(row.id),
    state: {
      globalFilter,
      columnFilters,
      rowSelection,
      columnOrder: ['select', ...columnOrder.filter(f => visibleFields.includes(f))],
      columnSizing,
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
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
              Showing {contactsList.length} of {totalContacts}
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
                  <th 
                    key={header.id} 
                    className={header.id === 'select' ? styles.checkboxCell : styles.resizableHeader}
                    style={{ 
                      width: header.getSize(),
                      position: 'relative'
                    }}
                  >
                    <div className={styles.headerContent}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </div>
                    {header.id !== 'select' && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={styles.resizeHandle}
                        style={{
                          cursor: 'col-resize',
                          userSelect: 'none',
                          touchAction: 'none',
                        }}
                      />
                    )}
                  </th>
                ))}
                <th className={styles.actionsHeader}>Actions</th>
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const contact = row.original;
              return (
                <tr key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <td 
                      key={cell.id} 
                      className={cell.column.id === 'select' ? styles.checkboxCell : ''} 
                      data-column={cell.column.id}
                      style={{ width: cell.column.getSize() }}
                    >
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

      {/* Pagination Controls */}
      <div className={styles.pagination}>
        <div className={styles.paginationInfo}>
          <span>
            Page {page + 1} of {totalPages} ({totalContacts} total)
          </span>
        </div>
        <div className={styles.paginationControls}>
          <button
            className={styles.paginationButton}
            onClick={() => setPage(0)}
            disabled={page === 0 || loading}
          >
            «« First
          </button>
          <button
            className={styles.paginationButton}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
          >
            ‹ Prev
          </button>
          <span className={styles.pageInput}>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={page + 1}
              onChange={(e) => {
                const newPage = parseInt(e.target.value, 10) - 1;
                if (newPage >= 0 && newPage < totalPages) {
                  setPage(newPage);
                }
              }}
              className={styles.pageNumberInput}
            />
            / {totalPages}
          </span>
          <button
            className={styles.paginationButton}
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || loading}
          >
            Next ›
          </button>
          <button
            className={styles.paginationButton}
            onClick={() => setPage(totalPages - 1)}
            disabled={page >= totalPages - 1 || loading}
          >
            Last »»
          </button>
        </div>
        <div className={styles.pageSizeSelector}>
          <label>Per page:</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(0);
            }}
            className={styles.pageSizeSelect}
            disabled={loading}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
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
            // Refresh current page after CSV upload
            const filters = {
              subscribed: activeFilters.subscribed,
              search: searchQuery.trim() || undefined,
            };
            const result = await getContactsPaginated(page, pageSize, filters);
            setContacts(result.contacts);
            setFilteredContacts(result.contacts);
            setTotalContacts(result.total);
            setTotalPages(result.totalPages);
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
