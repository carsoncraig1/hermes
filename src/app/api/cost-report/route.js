import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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
const REPORT_REV = '6';

// Hard server-side cap per report query. Abandoned HTTP attempts used to leave
// their queries running to completion ("zombies") — several stacked zombies
// starve the DB and make every subsequent attempt slower, a death spiral on
// heavy days. Past this cap the query errors out and frees the connection.
const STATEMENT_TIMEOUT_MS = 240000;

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'x-cost-report-rev': REPORT_REV } });
}

// In-memory cache of finished reports for FULLY-PAST windows (immutable data).
// The DB can take >90s per day under live send load — longer than callers
// (and Cloudflare, ~100s) will wait. But the computation still completes
// server-side after the client bails, so caching it turns a caller's retry
// into an instant hit. Per-container and lost on deploy, which is fine: it
// only needs to survive between an abandoned attempt and its retry.
const reportCache = new Map(); // key -> { body, at }
const REPORT_CACHE_MAX = 200;

function cacheKey(userId, start, end) {
  return `${userId}|${start}|${end}`;
}

function cachePut(key, body) {
  if (reportCache.size >= REPORT_CACHE_MAX) {
    const oldest = reportCache.keys().next().value; // Map preserves insertion order
    reportCache.delete(oldest);
  }
  reportCache.set(key, { body, at: Date.now() });
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

    // Fully-past windows are immutable -> serve from cache when we have it.
    const todayStartUTC = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const isPastWindow = endTsExclusive <= todayStartUTC;
    const key = cacheKey(userId, start, end);
    if (isPastWindow && reportCache.has(key)) {
      console.log(`[cost-report] rev=${REPORT_REV} CACHE HIT window=${start}..${end}`);
      return json(reportCache.get(key).body);
    }
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

    // ONE pass over the window's messages: msgs narrows FIRST — the sargable
    // createdAt bracket (sentAt trails createdAt by seconds, so ±1 day is a
    // safe envelope) hits the (userId, direction, createdAt) index, then the
    // precise COALESCE filter trims the edges. Click codes join per message id
    // (indexed), LEFT so link-less messages ride the same scan: rows with a
    // shortlink become send rows, rows without become 'unattributed'. n_links
    // drives the even cost split for the rare message with multiple shortlinks.
    const bracketStart = new Date(startTs.getTime() - 1 * 86400000);
    const bracketEnd = new Date(endTsExclusive.getTime() + 1 * 86400000);
    const reportSql = Prisma.sql`
      WITH msgs AS (
        SELECT m.id, m."costAmount", m.parts, m."campaignId",
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
        m."campaignId" AS campaign_id,
        to_char(m.day, 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS message_count,
        COUNT(*) FILTER (WHERE m."costAmount" IS NOT NULL)::int AS billed_count,
        COALESCE(SUM(m.parts), 0)::int AS parts,
        ROUND(SUM(COALESCE(m."costAmount", 0) / COALESCE(lc.n_links, 1)), 4)::float8 AS total_cost
      FROM msgs m
      LEFT JOIN msg_links ml ON ml.message_id = m.id
      LEFT JOIN link_counts lc ON lc.message_id = m.id
      GROUP BY 1, 2, 3
      ORDER BY 3, 1
    `;

    // explain=1: log + return the query PLAN (no execution) — how we diagnose
    // a window that never finishes without adding load.
    if (searchParams.get('explain') === '1') {
      const plan = await prisma.$queryRaw(Prisma.sql`EXPLAIN (FORMAT TEXT) ${reportSql}`);
      const lines = plan.map((r) => r['QUERY PLAN']);
      console.log(`[cost-report] EXPLAIN window=${start}..${end}:\n${lines.join('\n')}`);
      return json({ start, end, explain: lines });
    }

    const tQuery = Date.now();
    const [, allRows] = await prisma.$transaction([
      prisma.$executeRaw`SET LOCAL statement_timeout = ${Prisma.raw(String(STATEMENT_TIMEOUT_MS))}`,
      prisma.$queryRaw(reportSql),
    ]);
    console.log(`[cost-report] combined query: ${allRows.length} row(s) in ${Date.now() - tQuery}ms`);

    // Split the single scan into the two report sections. Send rows collapse
    // across campaign_id (a shortlink's messages can span campaigns); rows with
    // no shortlink linkage surface per campaign as 'unattributed' when they
    // carry cost, so nothing silently drops from day totals.
    const round4 = (n) => Math.round(n * 10000) / 10000;
    const sendGrouped = new Map();
    const unattrGrouped = new Map();
    for (const r of allRows) {
      if (r.send_id != null) {
        const k = `${r.send_id}|${r.date}`;
        const cur = sendGrouped.get(k) || { send_id: r.send_id, date: r.date, message_count: 0, billed_count: 0, parts: 0, total_cost: 0 };
        cur.message_count += r.message_count;
        cur.billed_count += r.billed_count;
        cur.parts += r.parts;
        cur.total_cost = round4(cur.total_cost + r.total_cost);
        sendGrouped.set(k, cur);
      } else if (r.total_cost > 0) {
        const k = `${r.campaign_id}|${r.date}`;
        const cur = unattrGrouped.get(k) || { campaign_id: r.campaign_id, date: r.date, message_count: 0, billed_count: 0, total_cost: 0 };
        cur.message_count += r.message_count;
        cur.billed_count += r.billed_count;
        cur.total_cost = round4(cur.total_cost + r.total_cost);
        unattrGrouped.set(k, cur);
      }
    }
    const sendRows = [...sendGrouped.values()];
    const unattributedRows = [...unattrGrouped.values()];

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
    const body = { start, end, currency: 'USD', rows, unattributed };
    if (isPastWindow) cachePut(key, body);
    return json(body);
  } catch (error) {
    console.error('[cost-report] ERROR:', error);
    return json({ error: 'Internal server error' }, 500);
  }
}
