'use client';

import { useEffect, useState } from 'react';
import styles from './NumbersTable.module.css';
import AddNumberModal from './AddNumberModal';
import { addNumber, updateNumber, deleteNumber, getNumbers } from '@/lib/actions/numbers';
import { ChevronDownIcon } from '@heroicons/react/24/solid';

export default function NumbersTable({ initialNumbers }) {
  const [numbers, setNumbers] = useState(initialNumbers);
  const [filteredNumbers, setFilteredNumbers] = useState(initialNumbers);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNumber, setEditingNumber] = useState(null);

  // Add search effect
  useEffect(() => {
    if (!Array.isArray(numbers)) {
      setFilteredNumbers([]);
      return;
    }

    if (!searchQuery.trim()) {
      setFilteredNumbers(numbers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = numbers.filter(number => {
      return (
        number.phoneNumber.toLowerCase().includes(query) ||
        number.status.toLowerCase().includes(query) ||
        String(number.contacts?.length || 0).includes(query) ||
        String(number.campaigns?.length || 0).includes(query)
      );
    });
    setFilteredNumbers(filtered);
  }, [searchQuery, numbers]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const freshNumbers = await getNumbers();
      setNumbers(freshNumbers);
      setFilteredNumbers(freshNumbers);
      setLastSynced(new Date());
    } catch (error) {
      console.error('Error syncing numbers:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this number?')) return;
    
    try {
      setLoading(true);
      await deleteNumber(id);
      setNumbers(numbers.filter(number => number.id !== id));
      setFilteredNumbers(filteredNumbers.filter(number => number.id !== id));
    } catch (error) {
      console.error('Error deleting number:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (number) => {
    setEditingNumber(number);
  };

  const handleUpdate = async (updatedNumber) => {
    try {
      setLoading(true);
      const result = await updateNumber(updatedNumber);
      setNumbers(numbers.map(n => 
        n.id === result.id ? result : n
      ));
      setFilteredNumbers(filteredNumbers.map(n => 
        n.id === result.id ? result : n
      ));
      setEditingNumber(null);
    } catch (error) {
      console.error('Error updating number:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (newNumber) => {
    try {
      setLoading(true);
      const number = await addNumber(newNumber);
      setNumbers([number, ...numbers]);
      setFilteredNumbers([number, ...filteredNumbers]);
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding number:', error);
    } finally {
      setLoading(false);
    }
  };

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
            <div className={styles.showing}>
              Showing {filteredNumbers.length} of {numbers.length}
            </div>
          </div>
          <button 
            className={styles.addRecord}
            onClick={() => setShowAddModal(true)}
          >
            Add Number
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
              <th>ID #</th>
              <th>Phone Number</th>
              <th>Status</th>
              <th>Contacts</th>
              <th>Campaigns</th>
              <th>Created At</th>
              <th>Updated At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredNumbers.map((number) => (
              <tr key={number.id}>
                <td className={styles.checkboxCell}>
                  <input type="checkbox" />
                </td>
                <td>{number.id}</td>
                <td>{number.phoneNumber}</td>
                <td>
                  <span className={`${styles.status} ${styles[number.status.toLowerCase()]}`}>
                    {number.status}
                  </span>
                </td>
                <td>{number.contacts?.length || 0}</td>
                <td>{number.campaigns?.length || 0}</td>
                <td>{new Date(number.createdAt).toLocaleString()}</td>
                <td>{new Date(number.updatedAt).toLocaleString()}</td>
                <td className={styles.actions}>
                  <button 
                    onClick={() => handleEdit(number)}
                    className={styles.actionButton}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(number.id)}
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

      {editingNumber && (
        <AddNumberModal
          number={editingNumber}
          onClose={() => setEditingNumber(null)}
          onAdd={handleUpdate}
          isEditing={true}
        />
      )}

      {showAddModal && (
        <AddNumberModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
} 