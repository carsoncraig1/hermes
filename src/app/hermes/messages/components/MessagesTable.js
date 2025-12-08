'use client';

import { useState, useEffect } from 'react';
import { getMessages, getMessageStats } from '@/lib/actions/messages';
import styles from './MessagesTable.module.css';

export default function MessagesTable({ initialMessages, initialStats }) {
  const [messages, setMessages] = useState(initialMessages || []);
  const [stats, setStats] = useState(initialStats || {});
  const [filteredMessages, setFilteredMessages] = useState(initialMessages || []);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');

  useEffect(() => {
    if (!searchQuery.trim() && statusFilter === 'all' && directionFilter === 'all') {
      setFilteredMessages(messages);
      return;
    }

    let filtered = [...messages];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(msg => 
        msg.to?.toLowerCase().includes(query) ||
        msg.from?.toLowerCase().includes(query) ||
        msg.text?.toLowerCase().includes(query) ||
        msg.contact?.firstName?.toLowerCase().includes(query) ||
        msg.contact?.lastName?.toLowerCase().includes(query) ||
        msg.campaign?.name?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(msg => msg.status === statusFilter);
    }

    // Apply direction filter
    if (directionFilter !== 'all') {
      filtered = filtered.filter(msg => msg.direction === directionFilter);
    }

    setFilteredMessages(filtered);
  }, [searchQuery, statusFilter, directionFilter, messages]);

  const handleSync = async () => {
    setLoading(true);
    try {
      const [freshMessages, freshStats] = await Promise.all([
        getMessages(),
        getMessageStats()
      ]);
      setMessages(freshMessages);
      setFilteredMessages(freshMessages);
      setStats(freshStats);
    } catch (error) {
      console.error('Error syncing messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'delivered':
        return styles.statusDelivered;
      case 'sent':
        return styles.statusSent;
      case 'queued':
      case 'sending':
        return styles.statusQueued;
      case 'sending_failed':
      case 'delivery_failed':
      case 'delivery_unconfirmed':
        return styles.statusFailed;
      default:
        return styles.statusUnknown;
    }
  };

  const formatStatus = (status) => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatPhone = (phone) => {
    if (!phone) return 'N/A';
    // Format as (XXX) XXX-XXXX if it's a US number
    if (phone.startsWith('+1') && phone.length === 12) {
      const digits = phone.slice(2);
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const truncateText = (text, maxLength = 50) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  if (loading && messages.length === 0) {
    return <div className={styles.loading}>Loading messages...</div>;
  }

  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableHeader}>
        <div className={styles.tableControls}>
          <div className={styles.filters}>
            <button 
              className={styles.syncButton}
              onClick={handleSync}
              disabled={loading}
            >
              ↻ Refresh
            </button>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Status</option>
              <option value="queued">Queued</option>
              <option value="sending">Sending</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="sending_failed">Failed</option>
              <option value="delivery_failed">Delivery Failed</option>
            </select>
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Directions</option>
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </select>
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            <div className={styles.showing}>
              Showing {filteredMessages.length} of {messages.length}
            </div>
          </div>
        </div>
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total:</span>
            <span className={styles.statValue}>{stats.total || 0}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Delivered:</span>
            <span className={`${styles.statValue} ${styles.statSuccess}`}>{stats.delivered || 0}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Failed:</span>
            <span className={`${styles.statValue} ${styles.statError}`}>{stats.failed || 0}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total Cost:</span>
            <span className={styles.statValue}>${(stats.totalCost || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Status</th>
              <th>To</th>
              <th>From</th>
              <th>Message</th>
              <th>Contact</th>
              <th>Campaign</th>
              <th>Cost</th>
              <th>Sent At</th>
              <th>Delivered At</th>
            </tr>
          </thead>
          <tbody>
            {filteredMessages.length === 0 ? (
              <tr>
                <td colSpan="9" className={styles.noData}>
                  {messages.length === 0 ? 'No messages found' : 'No messages match your filters'}
                </td>
              </tr>
            ) : (
              filteredMessages.map((message) => (
                <tr key={message.id}>
                  <td>
                    <span className={`${styles.statusBadge} ${getStatusBadgeClass(message.status)}`}>
                      {formatStatus(message.status)}
                    </span>
                  </td>
                  <td className={styles.phoneCell}>{formatPhone(message.to)}</td>
                  <td className={styles.phoneCell}>{formatPhone(message.from)}</td>
                  <td className={styles.messageCell} title={message.text}>
                    {truncateText(message.text, 60)}
                  </td>
                  <td>
                    {message.contact ? (
                      <span className={styles.contactLink}>
                        {message.contact.firstName || message.contact.lastName
                          ? `${message.contact.firstName || ''} ${message.contact.lastName || ''}`.trim()
                          : formatPhone(message.contact.phone)}
                      </span>
                    ) : (
                      <span className={styles.noData}>—</span>
                    )}
                  </td>
                  <td>
                    {message.campaign ? (
                      <span className={styles.campaignLink}>{message.campaign.name}</span>
                    ) : (
                      <span className={styles.noData}>—</span>
                    )}
                  </td>
                  <td>
                    {message.costAmount ? (
                      <span className={styles.cost}>${parseFloat(message.costAmount).toFixed(4)}</span>
                    ) : (
                      <span className={styles.noData}>—</span>
                    )}
                  </td>
                  <td>
                    {message.sentAt ? (
                      <span className={styles.timestamp}>
                        {new Date(message.sentAt).toLocaleString()}
                      </span>
                    ) : (
                      <span className={styles.noData}>—</span>
                    )}
                  </td>
                  <td>
                    {message.deliveredAt ? (
                      <span className={styles.timestamp}>
                        {new Date(message.deliveredAt).toLocaleString()}
                      </span>
                    ) : (
                      <span className={styles.noData}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

