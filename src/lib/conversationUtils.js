/**
 * Utility functions for grouping messages into conversations
 */

/**
 * Normalize phone number for conversation grouping
 * @param {string} phone - Phone number
 * @returns {string} - Normalized phone number
 */
export function normalizePhoneForConversation(phone) {
  if (!phone) return null;
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  // Ensure it starts with +1 for US numbers
  if (cleaned.startsWith('+1')) {
    return cleaned;
  }
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return `+${cleaned}`;
  }
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  return cleaned;
}

/**
 * Get conversation key from message
 * For outbound: use 'to' number
 * For inbound: use 'from' number
 * @param {Object} message - Message object
 * @returns {string|null} - Conversation key (normalized phone number)
 */
export function getConversationKey(message) {
  if (message.direction === 'outbound') {
    return normalizePhoneForConversation(message.to);
  } else {
    return normalizePhoneForConversation(message.from);
  }
}

/**
 * Group messages into conversations
 * @param {Array} messages - Array of message objects
 * @returns {Array} - Array of conversation objects
 */
export function groupMessagesIntoConversations(messages) {
  const conversationMap = new Map();

  messages.forEach(message => {
    const key = getConversationKey(message);
    if (!key) return;

    if (!conversationMap.has(key)) {
      // Determine the contact phone number (opposite of direction)
      const contactPhone = message.direction === 'outbound' 
        ? normalizePhoneForConversation(message.to)
        : normalizePhoneForConversation(message.from);
      
      // Get user's phone number (for outbound it's 'from', for inbound it's 'to')
      const userPhone = message.direction === 'outbound'
        ? normalizePhoneForConversation(message.from)
        : normalizePhoneForConversation(message.to);

      conversationMap.set(key, {
        id: key,
        contactPhone,
        userPhone,
        contact: message.contact || null,
        messages: [],
        lastMessageAt: null,
        lastMessage: null,
        unreadCount: 0,
        // Aggregate stats
        totalMessages: 0,
        outboundCount: 0,
        inboundCount: 0,
        deliveredCount: 0,
        failedCount: 0,
      });
    }

    const conversation = conversationMap.get(key);
    conversation.messages.push(message);
    conversation.totalMessages++;
    
    if (message.direction === 'outbound') {
      conversation.outboundCount++;
    } else {
      conversation.inboundCount++;
    }

    if (message.status === 'delivered') {
      conversation.deliveredCount++;
    } else if (message.status === 'sending_failed' || message.status === 'delivery_failed') {
      conversation.failedCount++;
    }

    // Track last message
    const messageTime = message.createdAt ? new Date(message.createdAt).getTime() : 0;
    const lastTime = conversation.lastMessageAt ? new Date(conversation.lastMessageAt).getTime() : 0;
    
    if (messageTime > lastTime) {
      conversation.lastMessageAt = message.createdAt;
      conversation.lastMessage = message;
    }
  });

  // Sort messages within each conversation by date (oldest first for thread view)
  conversationMap.forEach(conversation => {
    conversation.messages.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB; // Oldest first for thread view
    });
  });

  // Convert to array and sort by most recent conversation first
  return Array.from(conversationMap.values()).sort((a, b) => {
    const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return timeB - timeA; // Most recent first
  });
}

/**
 * Get display name for a conversation
 * @param {Object} conversation - Conversation object
 * @returns {string} - Display name
 */
export function getConversationDisplayName(conversation) {
  if (conversation.contact) {
    const firstName = conversation.contact.firstName || '';
    const lastName = conversation.contact.lastName || '';
    const name = `${firstName} ${lastName}`.trim();
    if (name) {
      return name;
    }
  }
  // Fallback to formatted phone number
  return formatPhoneForDisplay(conversation.contactPhone);
}

/**
 * Format phone number for display
 * @param {string} phone - Phone number
 * @returns {string} - Formatted phone number
 */
export function formatPhoneForDisplay(phone) {
  if (!phone) return 'Unknown';
  // Format as (XXX) XXX-XXXX if it's a US number
  if (phone.startsWith('+1') && phone.length === 12) {
    const digits = phone.slice(2);
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * Get relative time string (e.g., "2 hours ago", "Yesterday", "Jan 15")
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} - Relative time string
 */
export function getRelativeTime(date) {
  if (!date) return '';
  
  const messageDate = new Date(date);
  const now = new Date();
  const diffMs = now - messageDate;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // For older messages, show date
  return messageDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

