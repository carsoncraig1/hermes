'use client';

import { useState, useEffect, useMemo } from 'react';
import { getMessages, getMessageStats } from '@/lib/actions/messages';
import { groupMessagesIntoConversations } from '@/lib/conversationUtils';
import ConversationList from './ConversationList';
import ConversationDetail from './ConversationDetail';
import styles from './MessagesTable.module.css';

export default function MessagesTable({ initialMessages, initialStats }) {
  // OPTIMIZED: Handle paginated response format
  const [messages, setMessages] = useState(initialMessages?.messages || initialMessages || []);
  const [stats, setStats] = useState(initialStats || {});
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  
  // Pagination state
  const [page, setPage] = useState(initialMessages?.page || 0);
  const [totalPages, setTotalPages] = useState(initialMessages?.totalPages || 1);
  const [total, setTotal] = useState(initialMessages?.total || messages.length);

  // Auto-select first conversation if none selected
  const conversations = useMemo(() => {
    return groupMessagesIntoConversations(messages);
  }, [messages]);

  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  const loadPage = async (newPage, filters = {}) => {
    setLoading(true);
    try {
      const result = await getMessages({
        page: newPage,
        pageSize: 50,
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(directionFilter !== 'all' && { direction: directionFilter }),
        ...(searchQuery && { search: searchQuery }),
        ...filters
      });
      setMessages(result.messages);
      setPage(result.page);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      const [freshResult, freshStats] = await Promise.all([
        getMessages({ page: 0, pageSize: 50 }),
        getMessageStats()
      ]);
      setMessages(freshResult.messages);
      setPage(freshResult.page);
      setTotalPages(freshResult.totalPages);
      setTotal(freshResult.total);
      setStats(freshStats);
    } catch (error) {
      console.error('Error syncing messages:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle filter changes
  useEffect(() => {
    // Debounce search
    const timeoutId = setTimeout(() => {
      if (statusFilter !== 'all' || directionFilter !== 'all' || searchQuery) {
        loadPage(0);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [statusFilter, directionFilter, searchQuery]);

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
          
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => loadPage(page - 1)}
                disabled={page === 0 || loading}
                className={styles.paginationButton}
              >
                ← Prev
              </button>
              <span className={styles.paginationInfo}>
                Page {page + 1} of {totalPages} ({total} total)
              </span>
              <button
                onClick={() => loadPage(page + 1)}
                disabled={page >= totalPages - 1 || loading}
                className={styles.paginationButton}
              >
                Next →
              </button>
            </div>
          )}
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

