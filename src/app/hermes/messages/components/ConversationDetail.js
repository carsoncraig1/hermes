'use client';

import { useMemo } from 'react';
import { 
  groupMessagesIntoConversations,
  getConversationDisplayName,
  formatPhoneForDisplay,
  getRelativeTime
} from '@/lib/conversationUtils';
import styles from './ConversationDetail.module.css';

export default function ConversationDetail({ 
  messages, 
  conversationId
}) {
  const conversation = useMemo(() => {
    if (!conversationId) return null;
    const conversations = groupMessagesIntoConversations(messages);
    return conversations.find(c => c.id === conversationId) || null;
  }, [messages, conversationId]);

  if (!conversation) {
    return (
      <div className={styles.emptyState}>
        <p>Select a conversation to view messages</p>
      </div>
    );
  }

  const displayName = getConversationDisplayName(conversation);

  const formatMessageTime = (date) => {
    if (!date) return '';
    const messageDate = new Date(date);
    const now = new Date();
    const isToday = messageDate.toDateString() === now.toDateString();
    
    if (isToday) {
      return messageDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    }
    
    return messageDate.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const isAttachmentMessage = (message) => {
    return message.type === 'MMS' || (Array.isArray(message.mediaUrls) && message.mediaUrls.length > 0);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered':
        return <span className={styles.statusIconDelivered} title="Delivered">✓✓</span>;
      case 'sent':
        return <span className={styles.statusIconSent} title="Sent">✓</span>;
      case 'sending_failed':
      case 'delivery_failed':
        return <span className={styles.statusIconFailed} title="Failed">✗</span>;
      case 'queued':
      case 'sending':
        return <span className={styles.statusIconPending} title="Pending">⏱</span>;
      default:
        return null;
    }
  };

  return (
    <div className={styles.conversationDetail}>
      <div className={styles.conversationHeader}>
        <div className={styles.headerInfo}>
          <div className={styles.headerAvatar}>
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
          <div className={styles.headerText}>
            <h2 className={styles.headerName}>{displayName}</h2>
            <p className={styles.headerPhone}>
              {formatPhoneForDisplay(conversation.contactPhone)}
            </p>
          </div>
        </div>
        <div className={styles.headerStats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Messages:</span>
            <span className={styles.statValue}>{conversation.totalMessages}</span>
          </div>
          {conversation.deliveredCount > 0 && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>Delivered:</span>
              <span className={`${styles.statValue} ${styles.statSuccess}`}>
                {conversation.deliveredCount}
              </span>
            </div>
          )}
          {conversation.failedCount > 0 && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>Failed:</span>
              <span className={`${styles.statValue} ${styles.statError}`}>
                {conversation.failedCount}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.messagesThread}>
        {conversation.messages.length === 0 ? (
          <div className={styles.emptyThread}>
            <p>No messages in this conversation</p>
          </div>
        ) : (
          conversation.messages.map((message) => {
            const isOutbound = message.direction === 'outbound';
            const messageDate = message.createdAt ? new Date(message.createdAt) : null;
            const showDateSeparator = false; // Could add date separators between days

            return (
              <div key={message.id} className={styles.messageWrapper}>
                <div className={`${styles.messageBubble} ${isOutbound ? styles.outbound : styles.inbound}`}>
                  <div className={styles.messageContent}>
                    {message.text ? (
                      <p className={styles.messageText}>{message.text}</p>
                    ) : null}
                    {isAttachmentMessage(message) && (() => {
                      const attachmentUrl = message.mediaUrls?.[0];
                      const isVcard = message.type === 'MMS' || !attachmentUrl
                        ? true
                        : /\.vcf(\?|$)/i.test(attachmentUrl);
                      const chipLabel = isVcard ? 'Contact card' : 'Attachment';
                      const chipContent = (
                        <>
                          <span className={styles.attachmentIcon} aria-hidden="true">📎</span>
                          <span>{chipLabel}</span>
                        </>
                      );
                      return attachmentUrl ? (
                        <a
                          className={styles.attachmentChip}
                          href={attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {chipContent}
                        </a>
                      ) : (
                        <span className={styles.attachmentChip}>{chipContent}</span>
                      );
                    })()}
                    {message.campaign && (
                      <div className={styles.messageCampaign}>
                        <span className={styles.campaignTag}>Campaign: {message.campaign.name}</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.messageFooter}>
                    <span className={styles.messageTime}>
                      {formatMessageTime(message.createdAt)}
                    </span>
                    {isOutbound && getStatusIcon(message.status)}
                    {message.costAmount && (
                      <span className={styles.messageCost}>
                        ${parseFloat(message.costAmount).toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

