'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
import { addContact, updateContact, deleteContact, getContacts } from '@/lib/actions/contacts';
import { ChevronDownIcon } from '@heroicons/react/24/solid';

const columnHelper = createColumnHelper();

// Filter component for the Subscribed column
function SubscribedFilter({ column }) {
  return (
    <select
      className="filter-dropdown"
      value={column.getFilterValue() ?? ''}
      onChange={e => column.setFilterValue(e.target.value)}
    >
      <option value="">All</option>
      <option value="Yes">Subscribed</option>
      <option value="No">Unsubscribed</option>
    </select>
  );
}

const columns = [
  columnHelper.accessor('firstName', {
    header: 'First Name',
  }),
  columnHelper.accessor('lastName', {
    header: 'Last Name',
  }),
  columnHelper.accessor('phone', {
    header: 'Phone',
  }),
  columnHelper.accessor('email', {
    header: 'Email',
  }),
  columnHelper.accessor('clickId', {
    header: 'Click ID',
  }),
  columnHelper.accessor('subscribed', {
    header: 'Subscribed',
    filterFn: 'equals',
    header: ({ column }) => (
      <div className="filter-header">
        <span>Subscribed</span>
        <SubscribedFilter column={column} />
      </div>
    ),
  }),
  columnHelper.accessor('lastMessageSent', {
    header: 'Last Message',
    cell: info => info.getValue() ? format(new Date(info.getValue()), 'yyyy-MM-dd HH:mm') : 'Never',
  }),
  columnHelper.accessor('tags', {
    header: 'Tags',
    cell: info => {
      const tags = info.getValue() || [];
      return tags.length > 0 ? (
        <div className={styles.tagContainer}>
          {tags.map((tag) => (
            <span key={tag.id} className={styles.tag}>
              {tag.name}
            </span>
          ))}
        </div>
      ) : 'No tags';
    }
  }),
];

// Add these new components at the top of the file
function FilterMenu({ isOpen, onClose, filters, setFilters, contacts, setFilteredContacts }) {
  const [tagInput, setTagInput] = useState('');
  const [isTagInputFocused, setIsTagInputFocused] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);

  // Get unique tags from all contacts
  const availableTags = useMemo(() => {
    const tagSet = new Set();
    contacts.forEach(contact => {
      contact.tags?.forEach(tag => tagSet.add(tag.name));
    });
    return Array.from(tagSet);
  }, [contacts]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    
    // Apply filters to contacts
    const filtered = contacts.filter(contact => {
      // Subscription status filter
      if (newFilters.subscribed && 
          String(contact.subscribed) !== newFilters.subscribed) {
        return false;
      }

      // Tags filter
      if (newFilters.tags?.length > 0) {
        const contactTagNames = contact.tags.map(t => t.name);
        if (!newFilters.tags.every(tag => contactTagNames.includes(tag))) {
          return false;
        }
      }

      // Last message filter
      if (newFilters.lastMessageRange) {
        const { start, end } = newFilters.lastMessageRange;
        const messageDate = contact.lastMessageSent ? new Date(contact.lastMessageSent) : null;
        
        if (start && (!messageDate || messageDate < new Date(start))) {
          return false;
        }
        if (end && (!messageDate || messageDate > new Date(end))) {
          return false;
        }
      }

      return true;
    });

    setFilteredContacts(filtered);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.filterMenu}>
      <div className={styles.filterMenuHeader}>
        <h3>Filters</h3>
        <div className={styles.filterMenuActions}>
          <button onClick={() => {
            setFilters({});
            setFilteredContacts(contacts);
          }}>Clear</button>
          <button onClick={onClose}>&times;</button>
        </div>
      </div>
      
      <div className={styles.filterList}>
        <div className={styles.filterItem}>
          <label>Subscription Status</label>
          <select
            value={filters.subscribed || ''}
            onChange={(e) => handleFilterChange({
              ...filters,
              subscribed: e.target.value || undefined
            })}
          >
            <option value="">Any</option>
            <option value="true">Subscribed</option>
            <option value="false">Unsubscribed</option>
          </select>
        </div>

        <div className={styles.filterItem}>
          <label>Tags</label>
          <div className={styles.tagFilterInput}>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onFocus={() => setIsTagInputFocused(true)}
              onBlur={() => {
                setTimeout(() => setIsTagInputFocused(false), 200);
              }}
              placeholder="Type to search tags..."
            />
            {isTagInputFocused && (
              <div className={styles.tagSuggestions}>
                {availableTags
                  .filter(tag => 
                    (!tagInput.trim() || tag.toLowerCase().includes(tagInput.toLowerCase())) &&
                    !filters.tags?.includes(tag)
                  )
                  .map(tag => (
                    <div
                      key={tag}
                      className={styles.tagSuggestion}
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={() => {
                        const newTags = [...(filters.tags || []), tag];
                        handleFilterChange({
                          ...filters,
                          tags: newTags
                        });
                        setTagInput('');
                      }}
                    >
                      {tag}
                    </div>
                  ))}
              </div>
            )}
          </div>
          <div className={styles.selectedTags}>
            {filters.tags?.map(tag => (
              <div key={tag} className={styles.selectedTag}>
                {tag}
                <button
                  onClick={() => handleFilterChange({
                    ...filters,
                    tags: filters.tags.filter(t => t !== tag)
                  })}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.filterItem}>
          <label>Last Message</label>
          <div className={styles.dateRangeInputs}>
            <input
              type="date"
              value={filters.lastMessageRange?.start || ''}
              onChange={(e) => handleFilterChange({
                ...filters,
                lastMessageRange: {
                  ...filters.lastMessageRange,
                  start: e.target.value
                }
              })}
              placeholder="Start date"
            />
            <input
              type="date"
              value={filters.lastMessageRange?.end || ''}
              onChange={(e) => handleFilterChange({
                ...filters,
                lastMessageRange: {
                  ...filters.lastMessageRange,
                  end: e.target.value
                }
              })}
              placeholder="End date"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldsMenu({ isOpen, onClose, visibleFields, setVisibleFields }) {
  const fieldOptions = [
    { field: 'id', label: 'ID' },
    { field: 'firstName', label: 'First Name' },
    { field: 'lastName', label: 'Last Name' },
    { field: 'email', label: 'Email' },
    { field: 'phone', label: 'Phone' },
    { field: 'clickId', label: 'Click ID' },
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
    setVisibleFields(['id']); // Keep at least ID column
  };

  return (
    <div className={styles.fieldsMenu}>
      <div className={styles.fieldsMenuHeader}>
        <h3>Visible Fields</h3>
        <div className={styles.fieldsMenuActions}>
          <button onClick={handleSelectAll}>All</button>
          <button onClick={handleSelectNone}>None</button>
          <button onClick={onClose}>&times;</button>
        </div>
      </div>
      <div className={styles.fieldsList}>
        {fieldOptions.map((field) => (
          <label key={field.field} className={styles.fieldItem}>
            <input
              type="checkbox"
              checked={visibleFields.includes(field.field)}
              onChange={(e) => {
                if (e.target.checked) {
                  setVisibleFields([...visibleFields, field.field]);
                } else {
                  // Prevent unchecking if it's the last visible field
                  if (visibleFields.length > 1) {
                    setVisibleFields(visibleFields.filter(f => f !== field.field));
                  }
                }
              }}
            />
            {field.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function ContactsTable({ initialContacts }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [filteredContacts, setFilteredContacts] = useState(initialContacts);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFiltersMenu, setShowFiltersMenu] = useState(false);
  const [showFieldsMenu, setShowFieldsMenu] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [visibleFields, setVisibleFields] = useState([
    'id', 'firstName', 'lastName', 'email', 'phone', 'clickId', 
    'subscribed', 'tags', 'lastMessageSent', 'createdAt', 'updatedAt'
  ]);

  // Add search effect
  useEffect(() => {
    if (!Array.isArray(contacts)) {
      setFilteredContacts([]);
      return;
    }

    if (!searchQuery.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = contacts.filter(contact => {
      return (
        contact.firstName?.toLowerCase().includes(query) ||
        contact.lastName?.toLowerCase().includes(query) ||
        contact.phone.toLowerCase().includes(query) ||
        contact.email?.toLowerCase().includes(query) ||
        contact.clickid?.toLowerCase().includes(query) ||
        String(contact.subscribed).toLowerCase().includes(query) ||
        contact.tags?.some(tag => tag.name.toLowerCase().includes(query))
      );
    });
    setFilteredContacts(filtered);
  }, [searchQuery, contacts]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const freshContacts = await getContacts();
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

  const handleEdit = async (contact) => {
    try {
      setLoading(true);
      const updatedContact = await updateContact(contact);
      const updatedContacts = contacts.map(c => 
        c.id === updatedContact.id ? updatedContact : c
      );
      setContacts(updatedContacts);
      setFilteredContacts(updatedContacts);
    } catch (error) {
      console.error('Error updating contact:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (newContact) => {
    try {
      setLoading(true);
      console.log('Adding contact with data:', newContact); // Debug log
      const contact = await addContact(newContact);
      console.log('Received contact from server:', contact); // Debug log
      setContacts([contact, ...contacts]);
      setFilteredContacts([contact, ...filteredContacts]);
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding contact:', error);
    } finally {
      setLoading(false);
    }
  };

  const table = useReactTable({
    data: contacts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter,
      columnFilters,
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
  });

  // Add safety check in render
  const contactsList = Array.isArray(filteredContacts) ? filteredContacts : [];

  // Update the header rendering
  const renderHeader = (fieldId, label) => (
    <th key={fieldId} data-column={fieldId}>
      {label}
    </th>
  );

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableHeader}>
        <div className={styles.tableControls}>
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
                {visibleFields.length === 11 ? 'All' : visibleFields.length}
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
            />
          </div>
          <button 
            className={styles.addRecord}
            onClick={() => setShowAddModal(true)}
          >
            Add record
          </button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkboxCell}>
                <input type="checkbox" />
              </th>
              {visibleFields.includes('id') && renderHeader('id', 'ID #')}
              {visibleFields.includes('firstName') && renderHeader('firstName', 'First Name ▲')}
              {visibleFields.includes('lastName') && renderHeader('lastName', 'Last Name ▲')}
              {visibleFields.includes('phone') && renderHeader('phone', 'Phone ▲')}
              {visibleFields.includes('email') && renderHeader('email', 'Email ▲?')}
              {visibleFields.includes('clickId') && renderHeader('clickId', 'Click ID ▲?')}
              {visibleFields.includes('subscribed') && renderHeader('subscribed', 'Subscribed ?')}
              {visibleFields.includes('tags') && renderHeader('tags', 'Tags')}
              {visibleFields.includes('lastMessageSent') && renderHeader('lastMessageSent', 'Last Message ?')}
              {visibleFields.includes('createdAt') && renderHeader('createdAt', 'Created At ▼')}
              {visibleFields.includes('updatedAt') && renderHeader('updatedAt', 'Updated At ▼')}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contactsList.map((contact) => (
              <tr key={contact.id}>
                <td className={styles.checkboxCell}>
                  <input type="checkbox" />
                </td>
                {visibleFields.includes('id') && <td>{contact.id}</td>}
                {visibleFields.includes('firstName') && <td>{contact.firstName}</td>}
                {visibleFields.includes('lastName') && <td>{contact.lastName}</td>}
                {visibleFields.includes('phone') && <td data-column="phone">{contact.phone}</td>}
                {visibleFields.includes('email') && <td>{contact.email || 'null'}</td>}
                {visibleFields.includes('clickId') && <td>{contact.clickid || 'null'}</td>}
                {visibleFields.includes('subscribed') && <td>{contact.subscribed?.toString() || 'null'}</td>}
                {visibleFields.includes('tags') && (
                  <td>
                    <div className={styles.tagContainer}>
                      {(contact.tags && contact.tags.length > 0) ? 
                        contact.tags.map((tag) => (
                          <span key={tag.id} className={styles.tag}>
                            {tag.name}
                          </span>
                        )) 
                        : 'No tags'
                      }
                    </div>
                  </td>
                )}
                {visibleFields.includes('lastMessageSent') && (
                  <td>{contact.lastMessageSent ? new Date(contact.lastMessageSent).toISOString() : 'Never'}</td>
                )}
                {visibleFields.includes('createdAt') && (
                  <td>{new Date(contact.createdAt).toISOString()}</td>
                )}
                {visibleFields.includes('updatedAt') && (
                  <td>{new Date(contact.updatedAt).toISOString()}</td>
                )}
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
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <AddContactModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
} 