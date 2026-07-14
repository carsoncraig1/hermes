import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Helper function to get user ID from API key
 */
async function getUserIdFromApiKey(apiKey) {
  if (!apiKey) return null;

  const user = await prisma.user.findUnique({
    where: { apiKey },
    select: { id: true }
  });

  return user?.id || null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 400;

// Bumped on every behavior change; echoed on all responses so a probe of the
// (unauthenticated) 401 path confirms which build is actually serving traffic.
const REPORT_REV = '3';

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'x-cost-report-rev': REPORT_REV } });
}

/**
 * Parse the requested date range from query params.
 * - date=YYYY-MM-DD           -> that single UTC day
 * - start=...&end=...         -> inclusive UTC day range
 * - (nothing)                 -> yesterday UTC
 * Returns { start, end, startTs, endTsExclusive } or { error }.
 * All boundaries are UTC days.
 */
export function parseDateRange(searchParams, now = new Date()) {
  const date = searchParams.get('date');
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  let startStr, endStr;
  if (date) {
    if (!DATE_RE.test(date)) return { error: 'date must be YYYY-MM-DD' };
    startStr = endStr = date;
  } else if (start || end) {
    if (!start || !end) return { error: 'start and end must both be provided (YYYY-MM-DD, inclusive)' };
    if (!DATE_RE.test(start) || !DATE_RE.test(end)) return { error: 'start/end must be YYYY-MM-DD' };
    startStr = start;
    endStr = end;
  } else {
    // Default: yesterday UTC (the most recent complete day)
    const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    startStr = endStr = y.toISOString().slice(0, 10);
  }

  const startTs = new Date(`${startStr}T00:00:00.000Z`);
  const endTsExclusive = new Date(new Date(`${endStr}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000);
  if (isNaN(startTs.getTime()) || isNaN(endTsExclusive.getTime())) return { error: 'invalid date' };
  if (endTsExclusive <= startTs) return { error: 'end must be >= start' };
  if ((endTsExclusive - startTs) / 86400000 > MAX_RANGE_DAYS) return { error: `range too large (max ${MAX_RANGE_DAYS} days)` };

  return { start: startStr, end: endStr, startTs, endTsExclusive };
}

/**
 * SMS Cost Report API Endpoint
 *
 * Daily per-send message cost rollup for external cost sync (e.g. the
 * bullpress Neon warehouse). A "send" here is a SHORTLINK ID — the numeric
 * segment of the hrms click key (hrms_{user}_{shortlinkId}_{ts}_{rand}), so
 * callers can join costs to their click-level hrms data.
 *
 * GET /api/cost-report?key=hermes-api-key[&date=YYYY-MM-DD | &start=...&end=...]
 *
 * Query Parameters:
 * - key:   Required - Hermes API key for authentication (same as /api/revenue)
 * - date:  Optional - single UTC day (default: yesterday UTC)
 * - start: Optional - inclusive UTC start day (requires end)
 * - end:   Optional - inclusive UTC end day (requires start)
 *
 * Message -> shortlink linkage is via message_click_codes (one code per
 * shortlink per message at send time). A message containing N distinct
 * shortlinks has its cost split evenly across them so day totals stay exact.
 * Outbound messages only. costAmount is what Telnyx reported billing us
 * (null for failed sends, which count toward message_count but not cost).
 *
 * Response:
 * {
 *   start, end, currency: 'USD',
 *   rows: [{ send_id, date, message_count, billed_count, parts, total_cost,
 *            nickname, campaign_id, campaign_name }],
 *   unattributed: [{ campaign_id, campaign_name, date, message_count,
 *                    billed_count, total_cost }]   // outbound cost on messages
 *                                                  // with no shortlink linkage
 * }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const t0 = Date.now();
    const apiKey = searchParams.get('key');
    if (!apiKey) {
      return json(
        { error: 'API key is required. Include your hermes-api-key as the "key" parameter.' },
        401
      );
    }

    const userId = await getUserIdFromApiKey(apiKey);
    if (!userId) {
      return json({ error: 'Invalid API key' }, 401);
    }

    const range = parseDateRange(searchParams);
    if (range.error) {
      return json({ error: range.error }, 400);
    }
    const { start, end, startTs, endTsExclusive } = range;
    console.log(`[cost-report] rev=${REPORT_REV} start window=${start}..${end} auth=${Date.now() - t0}ms`);

    // debug=1: log which indexes actually exist on the two hot tables — the
    // schema declares them but migrations here are hand-applied, so prod may
    // be missing them (the difference between ms and minutes for this report).
    if (searchParams.get('debug') === '1') {
      const idx = await prisma.$queryRaw`
        SELECT tablename, indexname FROM pg_indexes
        WHERE tablename IN ('messages', 'message_click_codes')
        ORDER BY tablename, indexname`;
      console.log(`[cost-report] indexes: ${idx.map((r) => `${r.tablename}.${r.indexname}`).join(', ')}`);
    }

    // Per-send (shortlink) x day rollup. msgs narrows to the window FIRST —
    // the sargable createdAt bracket (sentAt trails createdAt by seconds, so
    // ±2 days is a safe envelope) hits the (userId, createdAt) index, then the
    // precise COALESCE filter trims the edges. Click codes are then joined per
    // message id (indexed), never scanned table-wide. msg_links dedups codes to
    // one row per (message, shortlink); link_counts drives the even cost split
    // for the rare message that contains multiple shortlinks.
    const bracketStart = new Date(startTs.getTime() - 2 * 86400000);
    const bracketEnd = new Date(endTsExclusive.getTime() + 2 * 86400000);
    const tSend = Date.now();
    const sendRows = await prisma.$queryRaw`
      WITH msgs AS (
        SELECT m.id, m."costAmount", m.parts,
               (COALESCE(m."sentAt", m."createdAt") AT TIME ZONE 'UTC')::date AS day
        FROM "messages" m
        WHERE m."userId" = ${userId}
          AND m.direction = 'outbound'
          AND m."createdAt" >= ${bracketStart} AND m."createdAt" < ${bracketEnd}
          AND COALESCE(m."sentAt", m."createdAt") >= ${startTs}
          AND COALESCE(m."sentAt", m."createdAt") < ${endTsExclusive}
      ),
      msg_links AS (
        SELECT DISTINCT c."messageId" AS message_id, c."shortlinkId" AS shortlink_id
        FROM "message_click_codes" c
        JOIN msgs ON msgs.id = c."messageId"
      ),
      link_counts AS (
        SELECT message_id, COUNT(*)::numeric AS n_links
        FROM msg_links
        GROUP BY message_id
      )
      SELECT
        ml.shortlink_id AS send_id,
        to_char(m.day, 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS message_count,
        COUNT(*) FILTER (WHERE m."costAmount" IS NOT NULL)::int AS billed_count,
        COALESCE(SUM(m.parts), 0)::int AS parts,
        ROUND(SUM(COALESCE(m."costAmount", 0) / lc.n_links), 4)::float8 AS total_cost
      FROM msgs m
      JOIN msg_links ml ON ml.message_id = m.id
      JOIN link_counts lc ON lc.message_id = m.id
      GROUP BY 1, 2
      ORDER BY 2, 1
    `;

    console.log(`[cost-report] sendRows query: ${sendRows.length} row(s) in ${Date.now() - tSend}ms`);

    // Outbound cost that has NO shortlink linkage (plain-text sends, or codes
    // deleted by cleanup). Surfaced per campaign so nothing is silently missing
    // from day totals; callers decide whether/where to book it.
    const tUnattr = Date.now();
    const unattributedRows = await prisma.$queryRaw`
      SELECT
        m."campaignId" AS campaign_id,
        to_char((COALESCE(m."sentAt", m."createdAt") AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS message_count,
        COUNT(*) FILTER (WHERE m."costAmount" IS NOT NULL)::int AS billed_count,
        ROUND(SUM(COALESCE(m."costAmount", 0)), 4)::float8 AS total_cost
      FROM "messages" m
      WHERE m."userId" = ${userId}
        AND m.direction = 'outbound'
        AND m."createdAt" >= ${bracketStart} AND m."createdAt" < ${bracketEnd}
        AND COALESCE(m."sentAt", m."createdAt") >= ${startTs}
        AND COALESCE(m."sentAt", m."createdAt") < ${endTsExclusive}
        AND NOT EXISTS (
          SELECT 1 FROM "message_click_codes" c WHERE c."messageId" = m.id
        )
      GROUP BY 1, 2
      HAVING SUM(COALESCE(m."costAmount", 0)) > 0
      ORDER BY 2, 1
    `;

    console.log(`[cost-report] unattributed query: ${unattributedRows.length} row(s) in ${Date.now() - tUnattr}ms`);

    // Attach shortlink + campaign names for the send rows
    const shortlinkIds = [...new Set(sendRows.map((r) => r.send_id))];
    const shortlinks = shortlinkIds.length
      ? await prisma.shortlink.findMany({
          where: { id: { in: shortlinkIds }, userId },
          select: {
            id: true,
            nickname: true,
            campaign: { select: { id: true, name: true } }
          }
        })
      : [];
    const bySend = new Map(shortlinks.map((s) => [s.id, s]));

    const campaignIds = [...new Set(unattributedRows.map((r) => r.campaign_id).filter((id) => id != null))];
    const campaigns = campaignIds.length
      ? await prisma.campaign.findMany({
          where: { id: { in: campaignIds }, userId },
          select: { id: true, name: true }
        })
      : [];
    const byCampaign = new Map(campaigns.map((c) => [c.id, c]));

    const rows = sendRows.map((r) => {
      const sl = bySend.get(r.send_id);
      return {
        send_id: r.send_id,
        date: r.date,
        message_count: r.message_count,
        billed_count: r.billed_count,
        parts: r.parts,
        total_cost: r.total_cost,
        nickname: sl?.nickname || null,
        campaign_id: sl?.campaign?.id ?? null,
        campaign_name: sl?.campaign?.name ?? null
      };
    });

    const unattributed = unattributedRows.map((r) => ({
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_id != null ? (byCampaign.get(r.campaign_id)?.name ?? null) : null,
      date: r.date,
      message_count: r.message_count,
      billed_count: r.billed_count,
      total_cost: r.total_cost
    }));

    console.log(`[cost-report] done window=${start}..${end} rows=${rows.length} total=${Date.now() - t0}ms`);
    return json({
      start,
      end,
      currency: 'USD',
      rows,
      unattributed
    });
  } catch (error) {
    console.error('[cost-report] ERROR:', error);
    return json({ error: 'Internal server error' }, 500);
  }
}
