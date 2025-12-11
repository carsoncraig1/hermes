'use client';

import { useState, useMemo } from 'react';
import { 
  groupMessagesIntoConversations, 
  getConversationDisplayName, 
  formatPhoneForDisplay,
  getRelativeTime 
} from '@/lib/conversationUtils';
import styles from './ConversationList.module.css';

export default function ConversationList({ 
  messages, 
  selectedConversationId, 
  onSelectConversation,
  searchQuery = '',
  statusFilter = 'all',
  directionFilter = 'all'
}) {
  // Group messages into conversations
  const conversations = useMemo(() => {
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

    return groupMessagesIntoConversations(filtered);
  }, [messages, searchQuery, statusFilter, directionFilter]);

  const truncateText = (text, maxLength = 60) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const getStatusIndicator = (conversation) => {
    if (conversation.failedCount > 0) {
      return <span className={styles.statusIndicator} style={{ background: '#ef4444' }} title="Has failed messages" />;
    }
    if (conversation.lastMessage?.status === 'delivered') {
      return <span className={styles.statusIndicator} style={{ background: '#10b981' }} title="All messages delivered" />;
    }
    return null;
  };

  if (conversations.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No conversations found</p>
        {messages.length > 0 && (
          <p className={styles.emptySubtext}>Try adjusting your filters</p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.conversationList}>
      {conversations.map(conversation => {
        const displayName = getConversationDisplayName(conversation);
        const isSelected = selectedConversationId === conversation.id;
        const lastMessage = conversation.lastMessage;
        const isOutbound = lastMessage?.direction === 'outbound';

        return (
          <div
            key={conversation.id}
            className={`${styles.conversationItem} ${isSelected ? styles.selected : ''}`}
            onClick={() => onSelectConversation(conversation.id)}
          >
            <div className={styles.conversationAvatar}>
              {conversation.contact?.firstName ? (
                <span className={styles.avatarInitial}>
                  {conversation.contact.firstName.charAt(0).toUpperCase()}
                </span>
              ) : (
                <span className={styles.avatarPhone}>
                  {formatPhoneForDisplay(conversation.contactPhone).charAt(1)}
                </span>
              )}
            </div>
            <div className={styles.conversationContent}>
              <div className={styles.conversationHeader}>
                <div className={styles.conversationNameRow}>
                  <span className={styles.conversationName}>{displayName}</span>
                  {getStatusIndicator(conversation)}
                  <span className={styles.conversationTime}>
                    {getRelativeTime(conversation.lastMessageAt)}
                  </span>
                </div>
                <div className={styles.conversationMeta}>
                  <span className={styles.phoneNumber}>
                    {formatPhoneForDisplay(conversation.contactPhone)}
                  </span>
                  {conversation.totalMessages > 1 && (
                    <span className={styles.messageCount}>
                      {conversation.totalMessages} messages
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.conversationPreview}>
                {lastMessage && (
                  <>
                    <span className={styles.previewDirection}>
                      {isOutbound ? '→' : '←'}
                    </span>
                    <span className={styles.previewText}>
                      {truncateText(lastMessage.text, 80)}
                    </span>
                    {lastMessage.status && (
                      <span className={`${styles.previewStatus} ${styles[`status${lastMessage.status}`]}`}>
                        {lastMessage.status === 'delivered' ? '✓' : 
                         lastMessage.status === 'sent' ? '✓' :
                         lastMessage.status === 'sending_failed' || lastMessage.status === 'delivery_failed' ? '✗' : ''}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

