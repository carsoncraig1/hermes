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
 * OPTIMIZED: Uses aggregate queries instead of fetching all records
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

    // OPTIMIZED: Run all queries in parallel using aggregates where possible
    const [
      // Revenue aggregate
      revenueAggregate,
      revenueCount,
      
      // Message stats by status (single groupBy query)
      messageStats,
      
      // Cost aggregate (only delivered messages)
      costAggregate,
      
      // Shortlink aggregates
      shortlinkStats,
      shortlinkCount,
      
      // Only fetch recent revenue events for display (limited to 50)
      recentRevenueEvents
    ] = await Promise.all([
      // Total revenue
      prisma.revenueEvent.aggregate({
        where: {
          userId,
          ...dateFilter,
          ...campaignFilter,
          ...shortlinkFilter
        },
        _sum: { payout: true }
      }),
      
      // Revenue event count
      prisma.revenueEvent.count({
        where: {
          userId,
          ...dateFilter,
          ...campaignFilter,
          ...shortlinkFilter
        }
      }),
      
      // Message counts by status (single query instead of fetching all)
      prisma.message.groupBy({
        by: ['status'],
        where: {
          userId,
          direction: 'outbound',
          ...dateFilter,
          ...(filters.campaignId && { campaignId: parseInt(filters.campaignId, 10) })
        },
        _count: true
      }),
      
      // Total cost (delivered messages only)
      prisma.message.aggregate({
        where: {
          userId,
          direction: 'outbound',
          status: 'delivered',
          ...dateFilter,
          ...(filters.campaignId && { campaignId: parseInt(filters.campaignId, 10) })
        },
        _sum: { costAmount: true }
      }),
      
      // Shortlink click/open totals
      prisma.shortlink.aggregate({
        where: {
          userId,
          ...(filters.shortlinkId && { id: parseInt(filters.shortlinkId, 10) })
        },
        _sum: { clicks: true, opens: true }
      }),
      
      // Shortlink count
      prisma.shortlink.count({
        where: {
          userId,
          ...(filters.shortlinkId && { id: parseInt(filters.shortlinkId, 10) })
        }
      }),
      
      // Recent revenue events (limited for display)
      prisma.revenueEvent.findMany({
        where: {
          userId,
          ...dateFilter,
          ...campaignFilter,
          ...shortlinkFilter
        },
        include: {
          campaign: { select: { id: true, name: true } },
          shortlink: { select: { id: true, nickname: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      })
    ]);

    // Process message stats from groupBy
    let totalMessages = 0;
    let deliveredMessages = 0;
    let failedMessages = 0;
    let sentMessages = 0;
    let queuedMessages = 0;
    
    messageStats.forEach(stat => {
      totalMessages += stat._count;
      if (stat.status === 'delivered') deliveredMessages = stat._count;
      else if (stat.status === 'sending_failed' || stat.status === 'delivery_failed') {
        failedMessages += stat._count;
      }
      else if (stat.status === 'sent') sentMessages = stat._count;
      else if (stat.status === 'queued' || stat.status === 'sending') {
        queuedMessages += stat._count;
      }
    });

    // Calculate totals from aggregates
    const totalRevenue = revenueAggregate._sum?.payout ? parseFloat(revenueAggregate._sum.payout.toString()) : 0;
    const totalCost = costAggregate._sum?.costAmount ? parseFloat(costAggregate._sum.costAmount.toString()) : 0;
    const roas = totalCost > 0 ? (totalRevenue / totalCost) : 0;
    
    const totalClicks = shortlinkStats._sum?.clicks || 0;
    const totalOpens = shortlinkStats._sum?.opens || 0;
    const totalSends = totalMessages;
    
    // Calculate additional metrics
    const clickthroughRate = totalSends > 0 ? (totalClicks / totalSends) * 100 : 0;
    const cpc = totalClicks > 0 ? (totalCost / totalClicks) : 0;
    const epc = totalClicks > 0 ? (totalRevenue / totalClicks) : 0;
    const cvr = totalClicks > 0 ? ((revenueCount / totalClicks) * 100) : 0;

    // Group by dimension if specified (using the limited recent events)
    let groupedData = {};
    if (filters.groupBy && recentRevenueEvents.length > 0) {
      if (filters.groupBy === 'campaign') {
        const campaignMap = new Map();
        recentRevenueEvents.forEach(event => {
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
        recentRevenueEvents.forEach(event => {
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
        recentRevenueEvents.forEach(event => {
          const date = new Date(event.createdAt).toISOString().split('T')[0];
          if (!dateMap.has(date)) {
            dateMap.set(date, { date, revenue: 0, events: 0 });
          }
          const group = dateMap.get(date);
          group.revenue += parseFloat(event.payout.toString());
          group.events += 1;
        });
        groupedData = Object.fromEntries(dateMap);
      }
    }

    // Convert Decimal fields for client
    const revenueEventsClean = recentRevenueEvents.map(event => ({
      ...event,
      payout: parseFloat(event.payout.toString())
    }));

    return {
      totalRevenue,
      totalCost,
      roas,
      revenueEventCount: revenueCount,
      totalMessages,
      deliveredMessages,
      failedMessages,
      shortlinks: shortlinkCount,
      totalClicks,
      totalOpens,
      totalSends,
      clickthroughRate,
      cpc,
      epc,
      cvr,
      groupedData,
      revenueEvents: revenueEventsClean,
      messages: [] // No longer fetching all messages - use aggregates
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
            status: 'delivered', // Only delivered messages are billed by Telnyx
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
      // Messages are already filtered to sent/delivered at database level
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
 * OPTIMIZED: Uses groupBy aggregate instead of fetching all messages
 * @returns {Promise<Array>} - Campaign delivery summaries
 */
export async function getCampaignDeliveryStatus() {
  try {
    const userId = await getUserId();
    
    // OPTIMIZED: Fetch campaigns without messages, then use groupBy for stats
    const [campaigns, messageStatsByCampaign, costByCampaign] = await Promise.all([
      // Get campaign list (lightweight)
      prisma.campaign.findMany({
        where: { userId },
        select: {
          id: true,
          name: true
        }
      }),
      
      // Get message counts by campaign and status
      prisma.message.groupBy({
        by: ['campaignId', 'status'],
        where: {
          userId,
          campaignId: { not: null }
        },
        _count: true
      }),
      
      // Get cost by campaign (delivered only)
      prisma.message.groupBy({
        by: ['campaignId'],
        where: {
          userId,
          campaignId: { not: null },
          status: 'delivered'
        },
        _sum: { costAmount: true }
      })
    ]);
    
    // Build lookup maps for O(1) access
    const statsMap = new Map(); // campaignId -> { delivered: n, failed: n, ... }
    messageStatsByCampaign.forEach(stat => {
      if (!stat.campaignId) return;
      if (!statsMap.has(stat.campaignId)) {
        statsMap.set(stat.campaignId, { total: 0, delivered: 0, failed: 0, sent: 0, queued: 0 });
      }
      const entry = statsMap.get(stat.campaignId);
      entry.total += stat._count;
      if (stat.status === 'delivered') entry.delivered = stat._count;
      else if (stat.status === 'sending_failed' || stat.status === 'delivery_failed') {
        entry.failed += stat._count;
      }
      else if (stat.status === 'sent') entry.sent = stat._count;
      else if (stat.status === 'queued' || stat.status === 'sending') {
        entry.queued += stat._count;
      }
    });
    
    const costMap = new Map();
    costByCampaign.forEach(stat => {
      if (stat.campaignId) {
        costMap.set(stat.campaignId, stat._sum?.costAmount ? parseFloat(stat._sum.costAmount.toString()) : 0);
      }
    });
    
    return campaigns.map(campaign => {
      const stats = statsMap.get(campaign.id) || { total: 0, delivered: 0, failed: 0, sent: 0, queued: 0 };
      const totalCost = costMap.get(campaign.id) || 0;
      
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        total: stats.total,
        delivered: stats.delivered,
        failed: stats.failed,
        sent: stats.sent,
        queued: stats.queued,
        deliveryRate: stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0,
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
        where: {
          ...where,
          status: 'delivered' // Only delivered messages are billed by Telnyx
        },
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
