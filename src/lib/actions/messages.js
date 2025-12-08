'use server';

import prisma from '@/lib/prisma';

/**
 * Check rate limits for a user
 * Telnyx rate limits vary by number type:
 * - Long code: ~200 messages/day per number (similar content)
 * - Toll-free: Higher limits
 * - Short code: Very high limits
 * 
 * We'll implement a simple per-user rate limit
 * @param {string} userId - User ID
 * @param {number} maxMessagesPerMinute - Maximum messages per minute (default: 60)
 * @param {number} maxMessagesPerHour - Maximum messages per hour (default: 1000)
 * @returns {Promise<Object>} - Rate limit check result
 */
export async function checkRateLimit(userId, maxMessagesPerMinute = 60, maxMessagesPerHour = 1000) {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // Count messages sent in the last minute
  const recentMinute = await prisma.message.count({
    where: {
      userId,
      direction: 'outbound',
      createdAt: {
        gte: oneMinuteAgo
      },
      status: {
        not: 'sending_failed' // Don't count failed messages
      }
    }
  });

  // Count messages sent in the last hour
  const recentHour = await prisma.message.count({
    where: {
      userId,
      direction: 'outbound',
      createdAt: {
        gte: oneHourAgo
      },
      status: {
        not: 'sending_failed'
      }
    }
  });

  const withinMinuteLimit = recentMinute < maxMessagesPerMinute;
  const withinHourLimit = recentHour < maxMessagesPerHour;

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
 * @param {Object} params - Message parameters
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
  telnyxMetadata = null
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
      costAmount: costAmount ? parseFloat(costAmount) : null,
      costCurrency,
      telnyxMetadata: telnyxMetadata ? JSON.parse(JSON.stringify(telnyxMetadata)) : null,
      sentAt: status === 'sent' ? new Date() : null
    }
  });

  return message;
}

/**
 * Update message record with status and cost information
 * @param {string} telnyxMessageId - Telnyx message ID
 * @param {Object} updates - Update data
 * @returns {Promise<Object>} - Updated message record
 */
export async function updateMessageRecord(telnyxMessageId, updates) {
  const updateData = {};

  if (updates.status) {
    updateData.status = updates.status;
    
    // Set timestamps based on status
    if (updates.status === 'sent' && !updates.sentAt) {
      updateData.sentAt = new Date();
    } else if (updates.status === 'delivered' && !updates.deliveredAt) {
      updateData.deliveredAt = new Date();
    } else if ((updates.status === 'sending_failed' || updates.status === 'delivery_failed') && !updates.failedAt) {
      updateData.failedAt = new Date();
    }
  }

  if (updates.sentAt) updateData.sentAt = new Date(updates.sentAt);
  if (updates.deliveredAt) updateData.deliveredAt = new Date(updates.deliveredAt);
  if (updates.failedAt) updateData.failedAt = new Date(updates.failedAt);
  if (updates.costAmount !== undefined) updateData.costAmount = parseFloat(updates.costAmount);
  if (updates.costCurrency) updateData.costCurrency = updates.costCurrency;
  if (updates.errorMessage) updateData.errorMessage = updates.errorMessage;
  if (updates.telnyxMetadata) {
    updateData.telnyxMetadata = JSON.parse(JSON.stringify(updates.telnyxMetadata));
  }

  const message = await prisma.message.update({
    where: { telnyxMessageId },
    data: updateData
  });

  return message;
}

/**
 * Get message analytics for a user
 * @param {string} userId - User ID
 * @param {Object} filters - Optional filters (campaignId, dateRange, etc.)
 * @returns {Promise<Object>} - Analytics data
 */
export async function getMessageAnalytics(userId, filters = {}) {
  const where = {
    userId,
    direction: 'outbound',
    ...(filters.campaignId && { campaignId: filters.campaignId }),
    ...(filters.dateRange && {
      createdAt: {
        gte: filters.dateRange.start,
        lte: filters.dateRange.end
      }
    })
  };

  // Get all messages matching filters
  const messages = await prisma.message.findMany({
    where,
    select: {
      id: true,
      status: true,
      costAmount: true,
      createdAt: true,
      sentAt: true,
      deliveredAt: true,
      campaignId: true,
      contactId: true
    }
  });

  // Calculate statistics
  const total = messages.length;
  const byStatus = messages.reduce((acc, msg) => {
    acc[msg.status] = (acc[msg.status] || 0) + 1;
    return acc;
  }, {});

  const delivered = byStatus.delivered || 0;
  const sent = byStatus.sent || 0;
  const failed = (byStatus.sending_failed || 0) + (byStatus.delivery_failed || 0);
  const queued = byStatus.queued || 0;
  const sending = byStatus.sending || 0;

  // Calculate delivery rate
  const deliveryRate = total > 0 ? (delivered / total) * 100 : 0;
  const successRate = total > 0 ? ((delivered + sent) / total) * 100 : 0;

  // Calculate total cost
  const totalCost = messages.reduce((sum, msg) => {
    return sum + (msg.costAmount ? parseFloat(msg.costAmount) : 0);
  }, 0);

  // Group by campaign
  const byCampaign = messages.reduce((acc, msg) => {
    const campaignId = msg.campaignId || 'no-campaign';
    if (!acc[campaignId]) {
      acc[campaignId] = {
        total: 0,
        delivered: 0,
        failed: 0,
        cost: 0
      };
    }
    acc[campaignId].total++;
    if (msg.status === 'delivered') acc[campaignId].delivered++;
    if (msg.status === 'sending_failed' || msg.status === 'delivery_failed') acc[campaignId].failed++;
    if (msg.costAmount) acc[campaignId].cost += parseFloat(msg.costAmount);
    return acc;
  }, {});

  // Time series data (messages per day)
  const byDate = messages.reduce((acc, msg) => {
    const date = new Date(msg.createdAt).toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = { sent: 0, delivered: 0, failed: 0 };
    }
    if (msg.status === 'delivered') acc[date].delivered++;
    else if (msg.status === 'sending_failed' || msg.status === 'delivery_failed') acc[date].failed++;
    else acc[date].sent++;
    return acc;
  }, {});

  return {
    total,
    delivered,
    sent,
    failed,
    queued,
    sending,
    deliveryRate: parseFloat(deliveryRate.toFixed(2)),
    successRate: parseFloat(successRate.toFixed(2)),
    totalCost: parseFloat(totalCost.toFixed(4)),
    byStatus,
    byCampaign,
    byDate: Object.entries(byDate).map(([date, counts]) => ({
      date,
      ...counts
    })).sort((a, b) => a.date.localeCompare(b.date))
  };
}

/**
 * Get campaign performance metrics
 * @param {number} campaignId - Campaign ID
 * @returns {Promise<Object>} - Campaign performance data
 */
export async function getCampaignPerformance(campaignId) {
  const messages = await prisma.message.findMany({
    where: {
      campaignId,
      direction: 'outbound'
    },
    include: {
      contact: {
        select: {
          id: true,
          phone: true
        }
      }
    }
  });

  const total = messages.length;
  const delivered = messages.filter(m => m.status === 'delivered').length;
  const failed = messages.filter(m => 
    m.status === 'sending_failed' || m.status === 'delivery_failed'
  ).length;

  const totalCost = messages.reduce((sum, msg) => {
    return sum + (msg.costAmount ? parseFloat(msg.costAmount) : 0);
  }, 0);

  // Get unique contacts who received messages
  const uniqueContacts = new Set(messages.map(m => m.contactId).filter(Boolean));
  
  // Get shortlink clicks/opens for this campaign
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      shortlinks: {
        select: {
          id: true,
          clicks: true,
          opens: true
        }
      }
    }
  });

  const totalClicks = campaign?.shortlinks?.reduce((sum, sl) => sum + sl.clicks, 0) || 0;
  const totalOpens = campaign?.shortlinks?.reduce((sum, sl) => sum + sl.opens, 0) || 0;

  // Calculate click-through rate (CTR)
  const ctr = delivered > 0 ? (totalClicks / delivered) * 100 : 0;
  const openRate = delivered > 0 ? (totalOpens / delivered) * 100 : 0;

  return {
    total,
    delivered,
    failed,
    deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
    totalCost: parseFloat(totalCost.toFixed(4)),
    uniqueContacts: uniqueContacts.size,
    shortlinkClicks: totalClicks,
    shortlinkOpens: totalOpens,
    clickThroughRate: parseFloat(ctr.toFixed(2)),
    openRate: parseFloat(openRate.toFixed(2))
  };
}

