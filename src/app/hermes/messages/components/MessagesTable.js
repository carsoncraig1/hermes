'use client';

import { useState, useEffect, useMemo } from 'react';
import { getMessages, getMessageStats } from '@/lib/actions/messages';
import { groupMessagesIntoConversations } from '@/lib/conversationUtils';
import ConversationList from './ConversationList';
import ConversationDetail from './ConversationDetail';
import styles from './MessagesTable.module.css';

export default function MessagesTable({ initialMessages, initialStats }) {
  const [messages, setMessages] = useState(initialMessages || []);
  const [stats, setStats] = useState(initialStats || {});
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [selectedConversationId, setSelectedConversationId] = useState(null);

  // Auto-select first conversation if none selected
  const conversations = useMemo(() => {
    return groupMessagesIntoConversations(messages);
  }, [messages]);

  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

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

  if (loading && messages.length === 0) {
    return <div className={styles.loading}>Loading messages...</div>;
  }

  return (
    <div className={styles.conversationContainer}>
      <div className={styles.conversationHeader}>
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
              <option value="all">All Messages</option>
              <option value="outbound">Sent</option>
              <option value="inbound">Received</option>
            </select>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
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

      <div className={styles.conversationLayout}>
        <div className={styles.conversationSidebar}>
          <ConversationList
            messages={messages}
            selectedConversationId={selectedConversationId}
            onSelectConversation={setSelectedConversationId}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            directionFilter={directionFilter}
          />
        </div>
        <div className={styles.conversationMain}>
          <ConversationDetail
            messages={messages}
            conversationId={selectedConversationId}
          />
        </div>
      </div>
    </div>
  );
}

