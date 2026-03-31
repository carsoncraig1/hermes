'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

function getTimeRangeBounds(timeRange = 'today') {
  const now = new Date();
  const start = new Date();

  switch (timeRange) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case '3d':
      start.setDate(now.getDate() - 3);
      break;
    case '7d':
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case '30d':
    case 'month':
      start.setDate(now.getDate() - 30);
      break;
    case '90d':
      start.setDate(now.getDate() - 90);
      break;
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      break;
    case 'all':
      start.setFullYear(2020);
      break;
    default:
      start.setHours(0, 0, 0, 0);
      break;
  }

  return { start, end: now };
}

function getDayKey(dateValue) {
  const d = new Date(dateValue);
  return d.toISOString().split('T')[0];
}

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return session.user.id;
}

export async function trackSpamFilterEvent({
  userId,
  campaignId = null,
  messageId = null,
  providerMessageId = null,
  fromNumber = null,
  toNumber = null,
  carrier = null,
  lineType = null,
  errorCode = '40002',
  errorTitle = null,
  errorDetail = null,
  occurredAt = null,
  rawPayload = null
}) {
  const safeOccurredAt = occurredAt ? new Date(occurredAt) : new Date();
  const eventKey = `${providerMessageId || 'unknown'}:${errorCode}:${toNumber || 'unknown'}:${safeOccurredAt.toISOString()}`;

  try {
    return await prisma.spamFilterEvent.create({
      data: {
        eventKey,
        userId,
        campaignId,
        messageId,
        providerMessageId,
        fromNumber,
        toNumber,
        carrier,
        lineType,
        errorCode,
        errorTitle,
        errorDetail,
        occurredAt: safeOccurredAt,
        rawPayload
      }
    });
  } catch (error) {
    // Idempotent webhook retries: ignore duplicate event key
    if (error.code === 'P2002') {
      return null;
    }
    throw error;
  }
}

export async function getSpamRateAnalytics(timeRange = 'today', limit = 10) {
  const userId = await getUserId();
  return getSpamRateAnalyticsForUser(userId, timeRange, limit);
}

export async function getSpamRateAnalyticsForUser(userId, timeRange = 'today', limit = 10) {
  const { start, end } = getTimeRangeBounds(timeRange);

  const eventsPromise = prisma.$queryRaw`
    SELECT
      sfe.id,
      sfe.campaign_id AS "campaignId",
      sfe.from_number AS "fromNumber",
      sfe.to_number AS "toNumber",
      sfe.carrier,
      sfe.line_type AS "lineType",
      sfe.error_code AS "errorCode",
      sfe.error_title AS "errorTitle",
      sfe.error_detail AS "errorDetail",
      sfe.occurred_at AS "occurredAt",
      c.id AS "campaignRefId",
      c.name AS "campaignName"
    FROM "spam_filter_events" sfe
    LEFT JOIN "campaigns" c ON c.id = sfe.campaign_id
    WHERE
      sfe.user_id = ${userId}
      AND sfe.error_code = '40002'
      AND sfe.occurred_at >= ${start}
      AND sfe.occurred_at <= ${end}
    ORDER BY sfe.occurred_at DESC
  `;

  const [eventRows, totalOutboundMessages, messageByCampaign, messageBySender, outboundCreatedAt] = await Promise.all([
    eventsPromise,
    prisma.message.count({
      where: {
        userId,
        direction: 'outbound',
        createdAt: { gte: start, lte: end }
      }
    }),
    prisma.message.groupBy({
      by: ['campaignId'],
      where: {
        userId,
        direction: 'outbound',
        createdAt: { gte: start, lte: end },
        campaignId: { not: null }
      },
      _count: true
    }),
    prisma.message.groupBy({
      by: ['from'],
      where: {
        userId,
        direction: 'outbound',
        createdAt: { gte: start, lte: end },
        from: { not: '' }
      },
      _count: true
    }),
    prisma.message.findMany({
      where: {
        userId,
        direction: 'outbound',
        createdAt: { gte: start, lte: end }
      },
      select: {
        createdAt: true
      }
    })
  ]);

  const events = eventRows.map((row) => ({
    id: row.id,
    campaignId: row.campaignId,
    fromNumber: row.fromNumber,
    toNumber: row.toNumber,
    carrier: row.carrier,
    lineType: row.lineType,
    errorCode: row.errorCode,
    errorTitle: row.errorTitle,
    errorDetail: row.errorDetail,
    occurredAt: row.occurredAt,
    campaign: row.campaignRefId ? {
      id: row.campaignRefId,
      name: row.campaignName
    } : null
  }));

  const spamCount = events.length;
  const spamRate = totalOutboundMessages > 0 ? (spamCount / totalOutboundMessages) * 100 : 0;

  const campaignOutboundMap = new Map();
  messageByCampaign.forEach((entry) => {
    if (entry.campaignId !== null) {
      campaignOutboundMap.set(entry.campaignId, entry._count);
    }
  });

  const senderOutboundMap = new Map();
  messageBySender.forEach((entry) => {
    const key = entry.from || 'unknown';
    senderOutboundMap.set(key, entry._count);
  });

  const spamByCampaignMap = new Map();
  const spamBySenderMap = new Map();
  const spamByDayMap = new Map();

  events.forEach((event) => {
    const campaignKey = event.campaignId ?? 'none';
    const existingCampaign = spamByCampaignMap.get(campaignKey) || {
      campaignId: event.campaignId,
      campaignName: event.campaign?.name || 'Unassigned',
      spamCount: 0,
      outboundCount: event.campaignId ? campaignOutboundMap.get(event.campaignId) || 0 : 0
    };
    existingCampaign.spamCount += 1;
    spamByCampaignMap.set(campaignKey, existingCampaign);

    const senderKey = event.fromNumber || 'unknown';
    const existingSender = spamBySenderMap.get(senderKey) || {
      senderNumber: senderKey,
      spamCount: 0,
      outboundCount: senderOutboundMap.get(senderKey) || 0
    };
    existingSender.spamCount += 1;
    spamBySenderMap.set(senderKey, existingSender);

    const dayKey = getDayKey(event.occurredAt);
    const existingDay = spamByDayMap.get(dayKey) || {
      day: dayKey,
      spamCount: 0,
      outboundCount: 0
    };
    existingDay.spamCount += 1;
    spamByDayMap.set(dayKey, existingDay);
  });

  const outboundByDayMap = new Map();
  outboundCreatedAt.forEach((msg) => {
    const key = getDayKey(msg.createdAt);
    outboundByDayMap.set(key, (outboundByDayMap.get(key) || 0) + 1);
  });

  outboundByDayMap.forEach((count, day) => {
    const existing = spamByDayMap.get(day) || { day, spamCount: 0, outboundCount: 0 };
    existing.outboundCount = count;
    spamByDayMap.set(day, existing);
  });

  const byCampaign = [...spamByCampaignMap.values()]
    .map((row) => ({
      ...row,
      spamRate: row.outboundCount > 0 ? (row.spamCount / row.outboundCount) * 100 : 0
    }))
    .sort((a, b) => b.spamCount - a.spamCount)
    .slice(0, limit);

  const bySender = [...spamBySenderMap.values()]
    .map((row) => ({
      ...row,
      spamRate: row.outboundCount > 0 ? (row.spamCount / row.outboundCount) * 100 : 0
    }))
    .sort((a, b) => b.spamCount - a.spamCount)
    .slice(0, limit);

  const byDay = [...spamByDayMap.values()]
    .map((row) => ({
      ...row,
      spamRate: row.outboundCount > 0 ? (row.spamCount / row.outboundCount) * 100 : 0
    }))
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, limit);

  return {
    timeRange,
    start,
    end,
    summary: {
      spamCount,
      outboundCount: totalOutboundMessages,
      spamRate
    },
    byCampaign,
    bySender,
    byDay
  };
}
