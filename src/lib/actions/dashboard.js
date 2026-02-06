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
 * Get time range boundaries for date filtering
 */
function getTimeRangeBounds(timeRange = 'today') {
  const now = new Date();
  const start = new Date();
  
  switch (timeRange) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setDate(now.getDate() - 30);
      break;
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      break;
    case 'all':
      start.setFullYear(2020);
      break;
    default:
      start.setHours(0, 0, 0, 0);
  }
  
  return { start, end: now };
}

/**
 * Get ALL dashboard data in a single server call
 * This eliminates client-side waterfall fetching
 */
export async function getDashboardData(timeRange = 'today') {
  const userId = await getUserId();
  const { start, end } = getTimeRangeBounds(timeRange);
  
  // Run ALL queries in parallel for maximum speed
  const [
    // Contact stats
    subscribedCount,
    newContactsCount,
    unsubscribedCount,
    
    // Analytics aggregates (using _count and _sum instead of fetching all records)
    messageStats,
    revenueStats,
    clickStats,
    
    // Campaign lists for dropdowns (lightweight)
    dedicatedSendCampaigns,
    workflowCampaigns,
    
    // Recent logs (limited)
    recentLogs
  ] = await Promise.all([
    // Subscribed contacts count
    prisma.contact.count({
      where: { userId, subscribed: true }
    }),
    
    // New contacts in time range
    prisma.contact.count({
      where: {
        userId,
        createdAt: { gte: start, lte: end }
      }
    }),
    
    // Unsubscribed in time range
    prisma.contact.count({
      where: {
        userId,
        subscribed: false,
        updatedAt: { gte: start, lte: end }
      }
    }),
    
    // Message stats using aggregates (MUCH faster than fetching all messages)
    prisma.message.groupBy({
      by: ['status'],
      where: {
        userId,
        direction: 'outbound',
        createdAt: { gte: start, lte: end }
      },
      _count: true,
      _sum: { costAmount: true }
    }),
    
    // Revenue stats using aggregates
    prisma.revenueEvent.aggregate({
      where: {
        userId,
        createdAt: { gte: start, lte: end }
      },
      _sum: { payout: true },
      _count: true
    }),
    
    // Click stats using aggregates
    prisma.shortlink.aggregate({
      where: { userId },
      _sum: { clicks: true, opens: true }
    }),
    
    // Dedicated send campaigns (lightweight - no messages)
    // Fetch all campaigns and filter for null workflow (Prisma JSON null checks are unreliable)
    prisma.campaign.findMany({
      where: {
        userId,
        message: { not: '' }
      },
      select: {
        id: true,
        name: true,
        message: true,
        workflow: true,
        _count: {
          select: {
            targets: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100 // Fetch more to account for filtering
    }),
    
    // Workflow campaigns (lightweight)
    prisma.campaign.findMany({
      where: {
        userId,
        workflow: { not: null },
        enabled: true
      },
      select: {
        id: true,
        name: true,
        workflow: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    }),
    
    // Recent logs (limited to 50)
    prisma.consoleLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
  ]);
  
  // Process message stats from groupBy
  const messageStatsProcessed = {
    total: 0,
    delivered: 0,
    failed: 0,
    sent: 0,
    queued: 0,
    totalCost: 0
  };
  
  messageStats.forEach(stat => {
    messageStatsProcessed.total += stat._count;
    if (stat.status === 'delivered') {
      messageStatsProcessed.delivered = stat._count;
      messageStatsProcessed.totalCost += stat._sum?.costAmount ? parseFloat(stat._sum.costAmount.toString()) : 0;
    } else if (stat.status === 'sending_failed' || stat.status === 'delivery_failed') {
      messageStatsProcessed.failed += stat._count;
    } else if (stat.status === 'sent') {
      messageStatsProcessed.sent = stat._count;
    } else if (stat.status === 'queued' || stat.status === 'sending') {
      messageStatsProcessed.queued += stat._count;
    }
  });
  
  // Calculate derived metrics
  const totalRevenue = revenueStats._sum?.payout ? parseFloat(revenueStats._sum.payout.toString()) : 0;
  const totalCost = messageStatsProcessed.totalCost;
  const totalClicks = clickStats._sum?.clicks || 0;
  const roas = totalCost > 0 ? totalRevenue / totalCost : 0;
  const profit = totalRevenue - totalCost;
  
  // Net contact growth
  const netGrowth = newContactsCount - unsubscribedCount;
  
  return {
    // Contact stats
    contactStats: {
      subscribedCount,
      newContactsCount,
      unsubscribedCount,
      netGrowth
    },
    
    // Analytics
    analytics: {
      totalRevenue,
      totalCost,
      roas,
      profit,
      totalClicks,
      totalOpens: clickStats._sum?.opens || 0,
      revenueEventCount: revenueStats._count || 0,
      totalMessages: messageStatsProcessed.total,
      deliveredMessages: messageStatsProcessed.delivered,
      failedMessages: messageStatsProcessed.failed
    },
    
    // Message delivery stats
    messageStats: messageStatsProcessed,
    
    // Campaign lists for dropdowns
    dedicatedSendCampaigns: dedicatedSendCampaigns
      .filter(c => c.workflow === null) // Filter for dedicated send campaigns (no workflow)
      .slice(0, 50) // Limit to 50 after filtering
      .map(c => ({
        id: c.id,
        name: c.name,
        message: c.message
      })),
    
    workflowCampaigns: workflowCampaigns.filter(c => {
      if (!c.workflow?.nodes) return false;
      const triggerNode = c.workflow.nodes.find(node => node.type === 'trigger');
      return !!triggerNode;
    }).map(c => ({
      id: c.id,
      name: c.name,
      workflow: c.workflow
    })),
    
    // Console logs
    logs: recentLogs.map(log => ({
      id: log.id,
      level: log.level,
      message: log.message,
      meta: log.meta,
      timestamp: log.createdAt
    })),
    
    // Metadata
    timeRange,
    fetchedAt: new Date().toISOString()
  };
}

/**
 * Get analytics data for a specific date range
 * Optimized version using aggregates
 */
export async function getAnalyticsOptimized(dateRange = 'today') {
  const userId = await getUserId();
  const { start, end } = getTimeRangeBounds(dateRange);
  
  const [messageStats, revenueStats, clickStats] = await Promise.all([
    // Message stats using groupBy
    prisma.message.groupBy({
      by: ['status'],
      where: {
        userId,
        direction: 'outbound',
        createdAt: { gte: start, lte: end }
      },
      _count: true,
      _sum: { costAmount: true }
    }),
    
    // Revenue aggregate
    prisma.revenueEvent.aggregate({
      where: {
        userId,
        createdAt: { gte: start, lte: end }
      },
      _sum: { payout: true },
      _count: true
    }),
    
    // Click stats
    prisma.shortlink.aggregate({
      where: { userId },
      _sum: { clicks: true, opens: true }
    })
  ]);
  
  // Process message stats
  let total = 0, delivered = 0, failed = 0, totalCost = 0;
  messageStats.forEach(stat => {
    total += stat._count;
    if (stat.status === 'delivered') {
      delivered = stat._count;
      totalCost += stat._sum?.costAmount ? parseFloat(stat._sum.costAmount.toString()) : 0;
    } else if (stat.status === 'sending_failed' || stat.status === 'delivery_failed') {
      failed += stat._count;
    }
  });
  
  const totalRevenue = revenueStats._sum?.payout ? parseFloat(revenueStats._sum.payout.toString()) : 0;
  const totalClicks = clickStats._sum?.clicks || 0;
  
  return {
    totalRevenue,
    totalCost,
    roas: totalCost > 0 ? totalRevenue / totalCost : 0,
    profit: totalRevenue - totalCost,
    totalClicks,
    revenueEventCount: revenueStats._count || 0,
    totalMessages: total,
    deliveredMessages: delivered,
    failedMessages: failed
  };
}
