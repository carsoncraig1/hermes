'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return session.user.id;
}

/**
 * Get messages for the current user with pagination
 * OPTIMIZED: Uses pagination to avoid loading all messages at once
 * @param {Object} filters - Optional filters (status, campaignId, contactId, dateRange, search, page, pageSize)
 * @returns {Promise<Object>} - { messages: Array, total: number, page: number, pageSize: number, totalPages: number }
 */
export async function getMessages(filters = {}) {
  try {
    const userId = await getUserId();
    const page = filters.page || 0;
    const pageSize = filters.pageSize || 50; // Default to 50 for better performance
    
    const where = {
      userId,
      ...(filters.status && { status: filters.status }),
      ...(filters.campaignId && { campaignId: parseInt(filters.campaignId, 10) }),
      ...(filters.contactId && { contactId: parseInt(filters.contactId, 10) }),
      ...(filters.direction && { direction: filters.direction }),
      ...(filters.dateRange && {
        createdAt: {
          gte: filters.dateRange.start,
          lte: filters.dateRange.end
        }
      }),
      ...(filters.search && {
        OR: [
          { to: { contains: filters.search, mode: 'insensitive' } },
          { from: { contains: filters.search, mode: 'insensitive' } },
          { text: { contains: filters.search, mode: 'insensitive' } }
        ]
      })
    };

    // OPTIMIZED: Run count and fetch in parallel
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true
            }
          },
          campaign: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: page * pageSize,
        take: pageSize
      }),
      prisma.message.count({ where })
    ]);

    // Convert Decimal fields to numbers to avoid client component warnings
    const messagesClean = messages.map(message => ({
      ...message,
      costAmount: message.costAmount ? parseFloat(message.costAmount.toString()) : null
    }));
    
    return {
      messages: messagesClean,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }
}

/**
 * Get message statistics
 * @returns {Promise<Object>} - Message statistics
 */
export async function getMessageStats() {
  try {
    const userId = await getUserId();
    
    const [total, delivered, failed, queued, totalCost] = await Promise.all([
      prisma.message.count({
        where: { userId, direction: 'outbound' }
      }),
      prisma.message.count({
        where: { userId, direction: 'outbound', status: 'delivered' }
      }),
      prisma.message.count({
        where: { 
          userId, 
          direction: 'outbound',
          status: { in: ['sending_failed', 'delivery_failed'] }
        }
      }),
      prisma.message.count({
        where: { 
          userId, 
          direction: 'outbound',
          status: { in: ['queued', 'sending'] }
        }
      }),
      prisma.message.aggregate({
        where: { 
          userId, 
          direction: 'outbound',
          status: 'delivered' // Only delivered messages are billed by Telnyx
        },
        _sum: { costAmount: true }
      })
    ]);

    return {
      total,
      delivered,
      failed,
      queued,
      totalCost: totalCost._sum.costAmount ? parseFloat(totalCost._sum.costAmount) : 0,
      deliveryRate: total > 0 ? (delivered / total) * 100 : 0
    };
  } catch (error) {
    console.error('Error fetching message stats:', error);
    throw error;
  }
}

/**
 * Check rate limits for a user (optimized with caching)
 * 
 * Rate limits based on Telnyx documentation:
 * - Long Code: 6 messages/minute/number (recommended: ~200 messages/day for deliverability)
 * - Toll Free: 1200 messages/minute/number
 * - Account: 10 messages/second (600/min, 36,000/hour)
 * 
 * Defaults configured for Toll-Free numbers:
 * - 1200 messages/minute (matching toll-free limit)
 * - 30,000 messages/hour (conservative, well below account limit of 36,000/hour)
 * 
 * @param {string} userId - User ID
 * @param {number} maxMessagesPerMinute - Maximum messages per minute (default: 1200 for toll-free)
 * @param {number} maxMessagesPerHour - Maximum messages per hour (default: 30000)
 * @param {boolean} useCache - Whether to use cache (default: true)
 * @returns {Promise<Object>} - Rate limit check result
 */
export async function checkRateLimit(userId, maxMessagesPerMinute = 1200, maxMessagesPerHour = 30000, useCache = true) {
  const now = new Date();
  
  let recentMinute, recentHour;
  
  if (useCache) {
    // Use cached rate limit data
    const { getCachedRateLimit } = await import('@/lib/rateLimitCache');
    const cached = await getCachedRateLimit(userId);
    recentMinute = cached.minuteCount;
    recentHour = cached.hourCount;
  } else {
    // Calculate fresh (for critical checks)
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    [recentMinute, recentHour] = await Promise.all([
      prisma.message.count({
        where: {
          userId,
          direction: 'outbound',
          createdAt: { gte: oneMinuteAgo },
          status: { not: 'sending_failed' }
        }
      }),
      prisma.message.count({
        where: {
          userId,
          direction: 'outbound',
          createdAt: { gte: oneHourAgo },
          status: { not: 'sending_failed' }
        }
      })
    ]);
  }

  const withinMinuteLimit = recentMinute < maxMessagesPerMinute;
  const withinHourLimit = recentHour < maxMessagesPerHour;
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

  return {
    allowed: withinMinuteLimit && withinHourLimit,
    minuteCount: recentMinute,
    hourCount: recentHour,
    minuteLimit: maxMessagesPerMinute,
    hourLimit: maxMessagesPerHour,
    retryAfter: withinMinuteLimit ? null : Math.ceil(60 - (now.getTime() - oneMinuteAgo.getTime()) / 1000)
  };
}

/**
 * Create a message record in the database
 * @param {Object} messageData - Message data
 * @returns {Promise<Object>} - Created message record
 */
export async function createMessageRecord({
  userId,
  telnyxMessageId,
  contactId,
  campaignId,
  from,
  to,
  text,
  type = 'SMS',
  parts = 1,
  status = 'queued',
  direction = 'outbound',
  costAmount = null,
  costCurrency = 'USD',
  telnyxMetadata = null,
  errorMessage = null,
  failedAt = null
}) {
  const message = await prisma.message.create({
    data: {
      userId,
      telnyxMessageId,
      contactId,
      campaignId,
      from,
      to,
      text,
      type,
      parts,
      status,
      direction,
      // Only set costAmount for sent/delivered/unconfirmed messages (Telnyx bills for these)
      // delivery_unconfirmed messages are still billed (sent to carrier, no confirmation)
      costAmount: (status === 'sent' || status === 'delivered' || status === 'delivery_unconfirmed') && costAmount ? parseFloat(costAmount) : null,
      costCurrency: (status === 'sent' || status === 'delivered') ? costCurrency : 'USD',
      telnyxMetadata: telnyxMetadata ? JSON.parse(JSON.stringify(telnyxMetadata)) : null,
      errorMessage,
      sentAt: status === 'sent' || status === 'sending' ? new Date() : null,
      failedAt: failedAt || (status === 'sending_failed' || status === 'delivery_failed' ? new Date() : null)
    }
  });

  return message;
}

/**
 * Update a message record
 * @param {string} telnyxMessageId - Telnyx message ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} - Updated message record, or null if not found
 */
export async function updateMessageRecord(telnyxMessageId, updates) {
  // First check if the message exists
  const existingMessage = await prisma.message.findUnique({
    where: { telnyxMessageId },
    select: { id: true }
  });

  if (!existingMessage) {
    // Message doesn't exist - return null instead of throwing
    return null;
  }

  const updateData = {
    ...(updates.status && { status: updates.status }),
    ...(updates.costAmount !== undefined && { costAmount: parseFloat(updates.costAmount) }),
    ...(updates.costCurrency && { costCurrency: updates.costCurrency }),
    ...(updates.errorMessage && { errorMessage: updates.errorMessage }),
    ...(updates.sentAt && { sentAt: new Date(updates.sentAt) }),
    ...(updates.deliveredAt && { deliveredAt: new Date(updates.deliveredAt) }),
    ...(updates.failedAt && { failedAt: new Date(updates.failedAt) }),
    ...(updates.telnyxMetadata && { telnyxMetadata: JSON.parse(JSON.stringify(updates.telnyxMetadata)) })
  };

  const message = await prisma.message.update({
    where: { telnyxMessageId },
    data: updateData
  });

  return message;
}

/**
 * Get message analytics for a user
 * @param {string} userId - User ID
 * @param {Object} filters - Optional filters
 * @returns {Promise<Object>} - Analytics data
 */
export async function getMessageAnalytics(userId, filters = {}) {
  const where = {
    userId,
    direction: 'outbound',
    ...(filters.campaignId && { campaignId: parseInt(filters.campaignId, 10) }),
    ...(filters.dateRange && {
      createdAt: {
        gte: filters.dateRange.start,
        lte: filters.dateRange.end
      }
    })
  };

  const [total, delivered, failed, sent, queued, totalCost] = await Promise.all([
    prisma.message.count({ where }),
    prisma.message.count({ where: { ...where, status: 'delivered' } }),
    prisma.message.count({ 
      where: { 
        ...where, 
        status: { in: ['sending_failed', 'delivery_failed'] }
      }
    }),
    prisma.message.count({ where: { ...where, status: 'sent' } }),
    prisma.message.count({ 
      where: { 
        ...where, 
        status: { in: ['queued', 'sending'] }
      }
    }),
    prisma.message.aggregate({
      where: {
        ...where,
        status: 'delivered' // Only delivered messages are billed by Telnyx
      },
      _sum: { costAmount: true }
    })
  ]);

  return {
    total,
    delivered,
    failed,
    sent,
    queued,
    totalCost: totalCost._sum.costAmount ? parseFloat(totalCost._sum.costAmount) : 0,
    deliveryRate: total > 0 ? (delivered / total) * 100 : 0
  };
}

/**
 * Get campaign performance metrics
 * @param {number} campaignId - Campaign ID
 * @returns {Promise<Object>} - Campaign performance data
 */
export async function getCampaignPerformance(campaignId) {
  const messages = await prisma.message.findMany({
    where: { campaignId: parseInt(campaignId, 10) },
    include: {
      contact: {
        select: {
          id: true
        }
      }
    }
  });

  const total = messages.length;
  const delivered = messages.filter(m => m.status === 'delivered').length;
  const failed = messages.filter(m => 
    m.status === 'sending_failed' || m.status === 'delivery_failed'
  ).length;
  const sent = messages.filter(m => m.status === 'sent').length;
  const queued = messages.filter(m => 
    m.status === 'queued' || m.status === 'sending'
  ).length;

  const totalCost = messages.reduce((sum, m) => {
    return sum + (m.costAmount ? parseFloat(m.costAmount) : 0);
  }, 0);

  return {
    campaignId,
    total,
    delivered,
    failed,
    sent,
    queued,
    deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
    totalCost: parseFloat(totalCost.toFixed(4))
  };
}
