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
 * Get comprehensive analytics data
 * @param {Object} filters - Filters (dateRange, campaignId, shortlinkId, groupBy)
 * @returns {Promise<Object>} - Analytics data
 */
export async function getAnalytics(filters = {}) {
  try {
    const userId = await getUserId();
    
    const dateFilter = filters.dateRange ? {
      createdAt: {
        gte: new Date(filters.dateRange.start),
        lte: new Date(filters.dateRange.end)
      }
    } : {};

    const campaignFilter = filters.campaignId ? { campaignId: parseInt(filters.campaignId, 10) } : {};
    const shortlinkFilter = filters.shortlinkId ? { shortlinkId: parseInt(filters.shortlinkId, 10) } : {};

    // Get revenue events
    const revenueEvents = await prisma.revenueEvent.findMany({
      where: {
        userId,
        ...dateFilter,
        ...campaignFilter,
        ...shortlinkFilter
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true
          }
        },
        shortlink: {
          select: {
            id: true,
            nickname: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get messages for cost calculation
    const messages = await prisma.message.findMany({
      where: {
        userId,
        direction: 'outbound',
        ...dateFilter,
        ...(filters.campaignId && { campaignId: parseInt(filters.campaignId, 10) })
      },
      select: {
        costAmount: true,
        campaignId: true,
        status: true,
        createdAt: true
      }
    });

    // Calculate totals
    const totalRevenue = revenueEvents.reduce((sum, event) => sum + parseFloat(event.payout.toString()), 0);
    const totalCost = messages.reduce((sum, msg) => sum + (msg.costAmount ? parseFloat(msg.costAmount.toString()) : 0), 0);
    const roas = totalCost > 0 ? (totalRevenue / totalCost) : 0;
    
    // Count messages by status (only count delivered messages as delivered)
    const totalMessages = messages.length;
    const deliveredMessages = messages.filter(msg => msg.status === 'delivered').length;
    const failedMessages = messages.filter(msg => 
      msg.status === 'sending_failed' || msg.status === 'delivery_failed'
    ).length;

    // Get shortlink click data
    const shortlinks = await prisma.shortlink.findMany({
      where: {
        userId,
        ...(filters.shortlinkId && { id: parseInt(filters.shortlinkId, 10) })
      },
      select: {
        id: true,
        nickname: true,
        clicks: true,
        opens: true,
        campaignId: true,
        campaign: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Group by dimension if specified
    let groupedData = {};
    if (filters.groupBy) {
      if (filters.groupBy === 'campaign') {
        const campaignMap = new Map();
        revenueEvents.forEach(event => {
          const key = event.campaignId ? `campaign_${event.campaignId}` : 'no_campaign';
          if (!campaignMap.has(key)) {
            campaignMap.set(key, {
              name: event.campaign?.name || 'No Campaign',
              revenue: 0,
              events: 0
            });
          }
          const group = campaignMap.get(key);
          group.revenue += parseFloat(event.payout.toString());
          group.events += 1;
        });
        groupedData = Object.fromEntries(campaignMap);
      } else if (filters.groupBy === 'shortlink') {
        const shortlinkMap = new Map();
        revenueEvents.forEach(event => {
          const key = event.shortlinkId ? `shortlink_${event.shortlinkId}` : 'no_shortlink';
          if (!shortlinkMap.has(key)) {
            shortlinkMap.set(key, {
              name: event.shortlink?.nickname || `Shortlink #${event.shortlinkId}` || 'No Shortlink',
              revenue: 0,
              events: 0
            });
          }
          const group = shortlinkMap.get(key);
          group.revenue += parseFloat(event.payout.toString());
          group.events += 1;
        });
        groupedData = Object.fromEntries(shortlinkMap);
      } else if (filters.groupBy === 'date') {
        const dateMap = new Map();
        revenueEvents.forEach(event => {
          const date = new Date(event.createdAt).toISOString().split('T')[0];
          if (!dateMap.has(date)) {
            dateMap.set(date, {
              date,
              revenue: 0,
              events: 0
            });
          }
          const group = dateMap.get(date);
          group.revenue += parseFloat(event.payout.toString());
          group.events += 1;
        });
        groupedData = Object.fromEntries(dateMap);
      }
    }

    // Convert Decimal fields to numbers to avoid client component warnings
    const revenueEventsClean = revenueEvents.slice(0, 100).map(event => ({
      ...event,
      payout: parseFloat(event.payout.toString())
    }));
    
    const messagesClean = messages.slice(0, 100).map(msg => ({
      ...msg,
      costAmount: msg.costAmount ? parseFloat(msg.costAmount.toString()) : null
    }));

    return {
      totalRevenue,
      totalCost,
      roas,
      revenueEventCount: revenueEvents.length,
      totalMessages: totalMessages,
      deliveredMessages: deliveredMessages, // Only messages with status 'delivered'
      failedMessages: failedMessages, // Messages that failed to send or deliver
      shortlinks: shortlinks.length,
      totalClicks: shortlinks.reduce((sum, s) => sum + s.clicks, 0),
      totalOpens: shortlinks.reduce((sum, s) => sum + s.opens, 0),
      groupedData,
      revenueEvents: revenueEventsClean, // Converted Decimal fields
      messages: messagesClean // Converted Decimal fields
    };
  } catch (error) {
    console.error('Error fetching analytics:', error);
    throw error;
  }
}

/**
 * Get all campaigns with ROAS and revenue data
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} - Campaign performance data with ROAS
 */
export async function getCampaignsWithROAS(filters = {}) {
  try {
    const userId = await getUserId();
    
    const dateFilter = filters.dateRange ? {
      createdAt: {
        gte: new Date(filters.dateRange.start),
        lte: new Date(filters.dateRange.end)
      }
    } : {};

    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      include: {
        revenueEvents: {
          where: dateFilter,
          select: {
            payout: true,
            createdAt: true
          }
        },
        messages: {
          where: {
            direction: 'outbound',
            ...dateFilter
          },
          select: {
            costAmount: true,
            status: true
          }
        },
        shortlinks: {
          select: {
            clicks: true,
            opens: true
          }
        },
        targets: {
          include: {
            tag: true
          }
        }
      }
    });

    // Get contact counts for each campaign
    const campaignContactCounts = await Promise.all(
      campaigns.map(async (campaign) => {
        // Check if campaign targets all subscribed contacts
        const targetsAllSubscribed = campaign.targets.some(t => t.targetType === 'ALL_SUBSCRIBED');
        
        if (targetsAllSubscribed) {
          // Count all subscribed contacts for the user
          const count = await prisma.contact.count({
            where: {
              userId,
              subscribed: true
            }
          });
          return { campaignId: campaign.id, contactCount: count };
        } else {
          // Count contacts by tags and sources
          const tagIds = campaign.targets
            .filter(t => t.targetType === 'TAG' && t.tagId)
            .map(t => t.tagId);
          const sourceValues = campaign.targets
            .filter(t => t.targetType === 'SOURCE' && t.sourceValue)
            .map(t => t.sourceValue);

          const whereConditions = {
            userId,
            subscribed: true
          };

          if (tagIds.length > 0 || sourceValues.length > 0) {
            whereConditions.OR = [];
            
            if (tagIds.length > 0) {
              whereConditions.OR.push({
                tags: {
                  some: {
                    id: { in: tagIds }
                  }
                }
              });
            }
            
            if (sourceValues.length > 0) {
              whereConditions.OR.push({
                source: { in: sourceValues }
              });
            }
          }

          const count = await prisma.contact.count({
            where: whereConditions
          });
          return { campaignId: campaign.id, contactCount: count };
        }
      })
    );

    const contactCountMap = new Map(
      campaignContactCounts.map(item => [item.campaignId, item.contactCount])
    );

    return campaigns.map(campaign => {
      const revenue = campaign.revenueEvents.reduce((sum, event) => sum + parseFloat(event.payout.toString()), 0);
      const cost = campaign.messages.reduce((sum, msg) => sum + (msg.costAmount ? parseFloat(msg.costAmount.toString()) : 0), 0);
      const clicks = campaign.shortlinks.reduce((sum, s) => sum + s.clicks, 0);
      const opens = campaign.shortlinks.reduce((sum, s) => sum + s.opens, 0);
      const roas = cost > 0 ? (revenue / cost) : 0;
      const conversionRate = clicks > 0 ? (campaign.revenueEvents.length / clicks) * 100 : 0;
      const contactCount = contactCountMap.get(campaign.id) || 0;
      const costPerClick = clicks > 0 ? (cost / clicks) : 0;
      const epc = clicks > 0 ? (revenue / clicks) : 0; // Earnings per click

      return {
        id: campaign.id,
        name: campaign.name,
        contactCount,
        cost,
        clicks,
        costPerClick,
        revenue,
        roas,
        conversionRate,
        epc,
        revenueEvents: campaign.revenueEvents.length,
        messages: campaign.messages.length,
        opens
      };
    });
  } catch (error) {
    console.error('Error fetching campaign performance:', error);
    throw error;
  }
}

/**
 * Get campaign delivery status (for dashboard analytics)
 * @returns {Promise<Array>} - Campaign delivery summaries
 */
export async function getCampaignDeliveryStatus() {
  try {
    const userId = await getUserId();
    
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      include: {
        messages: {
          select: {
            status: true,
            costAmount: true
          }
        }
      }
    });
    
    return campaigns.map(campaign => {
      const messages = campaign.messages || [];
      const total = messages.length;
      const delivered = messages.filter(m => m.status === 'delivered').length;
      const failed = messages.filter(m => 
        m.status === 'sending_failed' || m.status === 'delivery_failed'
      ).length;
      const sent = messages.filter(m => m.status === 'sent').length;
      const queued = messages.filter(m => m.status === 'queued' || m.status === 'sending').length;
      
      const totalCost = messages.reduce((sum, m) => {
        return sum + (m.costAmount ? parseFloat(m.costAmount) : 0);
      }, 0);
      
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        total,
        delivered,
        failed,
        sent,
        queued,
        deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
        totalCost: parseFloat(totalCost.toFixed(4))
      };
    });
  } catch (error) {
    console.error('Error fetching campaign delivery status:', error);
    throw error;
  }
}

/**
 * Get message analytics for dashboard (legacy function for compatibility)
 * @param {Object} filters - Optional filters
 * @returns {Promise<Object>} - Message analytics data
 */
export async function getMessageAnalytics(filters = {}) {
  try {
    const userId = await getUserId();
    
    const dateFilter = filters.dateRange ? {
      createdAt: {
        gte: new Date(filters.dateRange.start),
        lte: new Date(filters.dateRange.end)
      }
    } : {};

    const where = {
      userId,
      direction: 'outbound',
      ...dateFilter
    };

    const [total, delivered, failed, sent, queued, totalCost, messages] = await Promise.all([
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
        where,
        _sum: { costAmount: true }
      }),
      prisma.message.findMany({
        where,
        select: {
          status: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    ]);

    // Group by date
    const byDate = {};
    messages.forEach(msg => {
      const date = new Date(msg.createdAt).toISOString().split('T')[0];
      if (!byDate[date]) {
        byDate[date] = { date, delivered: 0, sent: 0, failed: 0 };
      }
      if (msg.status === 'delivered') byDate[date].delivered++;
      else if (msg.status === 'sent') byDate[date].sent++;
      else if (msg.status === 'sending_failed' || msg.status === 'delivery_failed') byDate[date].failed++;
    });

    return {
      total,
      delivered,
      failed,
      sent,
      queued,
      totalCost: totalCost._sum.costAmount ? parseFloat(totalCost._sum.costAmount) : 0,
      deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
      byDate: Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
    };
  } catch (error) {
    console.error('Error fetching message analytics:', error);
    throw error;
  }
}
