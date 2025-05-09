'use client';

import { useState } from 'react';
import styles from './AddNumberModal.module.css';

// Only allow US numbers: +1-XXX-XXX-XXXX
const PHONE_REGEX = /^\+1-\d{3}-\d{3}-\d{4}$/;

export default function AddNumberModal({ number, onClose, onAdd, isEditing = false }) {
  const [formState, setFormState] = useState({
    phoneNumber: number?.phoneNumber || '',
    status: number?.status || 'ACTIVE',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Format phone number as +1-XXX-XXX-XXXX as user types
  function formatPhoneNumber(value) {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    // Always start with +1-
    let formatted = '+1';
    if (digits.length > 1) {
      formatted += '-';
      // Area code
      formatted += digits.slice(1, 4);
    }
    if (digits.length > 4) {
      formatted += '-' + digits.slice(4, 7);
    }
    if (digits.length > 7) {
      formatted += '-' + digits.slice(7, 11);
    }
    return formatted;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!PHONE_REGEX.test(formState.phoneNumber)) {
      setError('Please enter a valid US phone number in the format: +1-XXX-XXX-XXXX');
      return;
    }
    setLoading(true);
    try {
      const submitData = {
        ...(isEditing && { id: number.id }),
        phoneNumber: formState.phoneNumber,
        status: formState.status,
      };
      await onAdd(submitData);
      onClose();
    } catch (error) {
      console.error('Error submitting number:', error);
      setError('Failed to save number. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phoneNumber') {
      // Only allow up to 11 digits (+1 + 10 digits)
      const digits = value.replace(/\D/g, '').slice(0, 11);
      const formattedNumber = formatPhoneNumber('+'.concat(digits));
      setFormState(prev => ({
        ...prev,
        [name]: formattedNumber
      }));
    } else {
      setFormState(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>{isEditing ? 'Edit Number' : 'Add New Number'}</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="phoneNumber">Phone Number *</label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formState.phoneNumber}
              onChange={handleChange}
              required
              placeholder="+1-XXX-XXX-XXXX"
              maxLength={15}
              className={error ? styles.inputError : ''}
            />
            {error && <div className={styles.errorMessage}>{error}</div>}
            <div className={styles.helpText}>
              Format: +1-XXX-XXX-XXXX (US numbers only)
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="status">Status</label>
            <select
              id="status"
              name="status"
              value={formState.status}
              onChange={handleChange}
              className={styles.select}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
          <div className={styles.formActions}>
            <button 
              type="button" 
              onClick={onClose} 
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add Number')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 