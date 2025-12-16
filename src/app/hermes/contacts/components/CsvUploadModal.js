'use client';

import { useState, useRef } from 'react';
import styles from './AddContactModal.module.css';
import { addContactsBatch } from '@/lib/actions/contacts';

export default function CsvUploadModal({ onClose, onUploadComplete }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0, errors: [] });
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    
    // Preview first few rows
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').slice(0, 6); // First 5 data rows + header
      setPreview(lines.join('\n'));
    };
    reader.readAsText(selectedFile);
  };

  // Proper CSV parsing that handles quoted fields
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    result.push(current.trim());
    return result;
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    // Parse header with proper CSV parsing
    const header = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
    
    // Map common column names to our field names
    const fieldMap = {
      'phone': 'phone',
      'phone number': 'phone',
      'phone_number': 'phone',
      'first name': 'firstName',
      'firstname': 'firstName',
      'first_name': 'firstName',
      'last name': 'lastName',
      'lastname': 'lastName',
      'last_name': 'lastName',
      'email': 'email',
      'clickid': 'clickid',
      'click id': 'clickid',
      'click_id': 'clickid',
      'clickids': 'clickid',
      'source': 'source',
      'age': 'age',
      'ip': 'ip',
      'ip address': 'ip',
      'ip_address': 'ip',
      'useragent': 'useragent',
      'user agent': 'useragent',
      'user_agent': 'useragent',
      'referrer': 'referrer',
      'subscribed': 'subscribed',
      'tags': 'tags',
      'tag': 'tags',
    };

    // Create mapping from CSV columns to our fields
    const columnMap = {};
    header.forEach((col, index) => {
      const normalizedCol = col.toLowerCase().trim();
      if (fieldMap[normalizedCol]) {
        columnMap[fieldMap[normalizedCol]] = index;
      }
    });

    // Parse data rows
    const contacts = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, '').trim());
      
      // Skip empty rows
      if (values.every(v => !v)) continue;

      const contact = {};
      
      // Map values to contact fields
      Object.keys(columnMap).forEach(field => {
        const colIndex = columnMap[field];
        if (colIndex !== undefined && values[colIndex]) {
          if (field === 'clickid') {
            // Handle comma-separated clickids
            contact[field] = values[colIndex].split(',').map(c => c.trim()).filter(c => c);
          } else if (field === 'tags') {
            // Handle comma-separated tags
            contact[field] = values[colIndex].split(',').map(t => t.trim()).filter(t => t);
          } else if (field === 'subscribed') {
            // Handle boolean
            const val = values[colIndex].toLowerCase();
            contact[field] = val === 'true' || val === 'yes' || val === '1';
          } else {
            contact[field] = values[colIndex];
          }
        }
      });

      // Phone is required
      if (contact.phone) {
        contacts.push(contact);
      }
    }

    return contacts;
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress({ processed: 0, total: 0, errors: [] });

    try {
      const text = await file.text();
      const contacts = parseCSV(text);

      if (contacts.length === 0) {
        alert('No valid contacts found in CSV. Make sure the file has a "phone" column.');
        setUploading(false);
        return;
      }

      setProgress({ processed: 0, total: contacts.length, errors: [] });

      // Upload contacts in batches for better performance
      const BATCH_SIZE = 50
      const result = await addContactsBatch(
        contacts, 
        BATCH_SIZE,
        // Progress callback - updates UI as batches complete
        (processed, total, errors) => {
          setProgress({ processed, total, errors })
        }
      )

      if (result.success > 0) {
        alert(`Successfully uploaded ${result.success} contact(s).${result.failed > 0 ? ` ${result.failed} error(s).` : ''}`);
        onUploadComplete();
        onClose();
      } else {
        alert(`Failed to upload contacts. ${result.failed} error(s).`);
      }
    } catch (error) {
      console.error('Error processing CSV:', error);
      alert('Error processing CSV file: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal} style={{ maxWidth: '600px' }}>
        <div className={styles.modalHeader}>
          <h2>Bulk Upload Contacts (CSV)</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        
        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="csvFile">Select CSV File</label>
            <input
              ref={fileInputRef}
              type="file"
              id="csvFile"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={uploading}
            />
            <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Required columns: <strong>phone</strong><br/>
              Optional columns: firstName, lastName, email, clickid, source, age, ip, useragent, referrer, subscribed, tags
            </div>
          </div>

          {preview && (
            <div className={styles.formGroup}>
              <label>Preview (first 5 rows)</label>
              <pre style={{
                background: 'var(--bg-tertiary)',
                padding: '1rem',
                borderRadius: 'var(--border-radius-md)',
                fontSize: '0.75rem',
                overflow: 'auto',
                maxHeight: '200px',
                border: '1px solid var(--border-primary)'
              }}>
                {preview}
              </pre>
            </div>
          )}

          {uploading && (
            <div className={styles.formGroup}>
              <div style={{ 
                background: 'var(--bg-tertiary)', 
                padding: '1rem', 
                borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--border-primary)'
              }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  Processing: {progress.processed} / {progress.total}
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${(progress.processed / progress.total) * 100}%`,
                    height: '100%',
                    background: 'var(--accent-orange)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                {progress.errors.length > 0 && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--error)' }}>
                    Errors: {progress.errors.length}
                  </div>
                )}
              </div>
            </div>
          )}

          {progress.errors.length > 0 && !uploading && (
            <div className={styles.formGroup}>
              <label>Errors ({progress.errors.length})</label>
              <div style={{
                background: 'var(--bg-tertiary)',
                padding: '1rem',
                borderRadius: 'var(--border-radius-md)',
                fontSize: '0.8125rem',
                maxHeight: '200px',
                overflow: 'auto',
                border: '1px solid var(--border-primary)'
              }}>
                {progress.errors.map((err, idx) => (
                  <div key={idx} style={{ marginBottom: '0.5rem', color: 'var(--error)' }}>
                    Row {err.row}: {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.formActions}>
            <button 
              type="button" 
              onClick={onClose} 
              className={styles.cancelButton}
              disabled={uploading}
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={handleUpload}
              className={styles.submitButton}
              disabled={!file || uploading}
            >
              {uploading ? `Uploading... (${progress.processed}/${progress.total})` : 'Upload CSV'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

