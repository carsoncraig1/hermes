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
const REPORT_REV = '11'; // no cost-report change in 11 — bumped as the deploy probe for the messages-page perf fix

// Hard server-side cap per DAY query (rev 8 computes day-by-day, so this now
// bounds a single day, not a whole window). Abandoned HTTP attempts used to
// leave their queries running to completion ("zombies") — several stacked
// zombies starve the DB and make every subsequent attempt slower, a death
// spiral on heavy days. Past this cap the query errors out and frees the
// connection.
const STATEMENT_TIMEOUT_MS = 240000;

// A day's slice is durably cached only once the day ended at least this many
// hours ago. Telnyx cost postbacks land within seconds-to-minutes of send;
// this margin covers stragglers so a cached day never misses late cost.
const SETTLE_HOURS = 12;

const DAY_MS = 24 * 60 * 60 * 1000;

// Migrations here are hand-applied, so the cache table bootstraps itself:
// one idempotent CREATE on the first request per container (no-op after the
// table exists). Mirrors prisma/migrations/add_cost_report_day_cache.sql.
let cacheTableReady = null;
function ensureCacheTable() {
  if (!cacheTableReady) {
    cacheTableReady = (async () => {
      await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS "cost_report_days" (
        "id" SERIAL PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "day" VARCHAR(10) NOT NULL,
        "body" JSONB NOT NULL,
        "computedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      )`;
      await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "cost_report_days_userId_day_key"
        ON "cost_report_days"("userId", "day")`;
    })().catch((error) => {
      cacheTableReady = null; // retry on next request instead of caching the failure
      throw error;
    });
  }
  return cacheTableReady;
}

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
    const y = new Date(now.getTime() - DAY_MS);
    startStr = endStr = y.toISOString().slice(0, 10);
  }

  const startTs = new Date(`${startStr}T00:00:00.000Z`);
  const endTsExclusive = new Date(new Date(`${endStr}T00:00:00.000Z`).getTime() + DAY_MS);
  if (isNaN(startTs.getTime()) || isNaN(endTsExclusive.getTime())) return { error: 'invalid date' };
  if (endTsExclusive <= startTs) return { error: 'end must be >= start' };
  if ((endTsExclusive - startTs) / 86400000 > MAX_RANGE_DAYS) return { error: `range too large (max ${MAX_RANGE_DAYS} days)` };

  return { start: startStr, end: endStr, startTs, endTsExclusive };
}

// Step-1 SQL: the window's messages only — no joins. The sargable createdAt
// bracket keeps the scan on the (userId, direction, createdAt) index, then the
// precise COALESCE filter trims the edges. createdAt <= COALESCE(sentAt,
// createdAt) always, and sentAt trails createdAt by seconds — so
// [fromTs - 1 day, toTs) fully envelopes the precise filter.
function buildMessagesSql(userId, fromTs, toTs) {
  const bracketStart = new Date(fromTs.getTime() - DAY_MS);
  return Prisma.sql`
    SELECT m.id,
           m."costAmount"::float8 AS cost,
           m.parts,
           m."campaignId" AS campaign_id,
           to_char((COALESCE(m."sentAt", m."createdAt") AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS date
    FROM "messages" m
    WHERE m."userId" = ${userId}
      AND m.direction = 'outbound'
      AND m."createdAt" >= ${bracketStart} AND m."createdAt" < ${toTs}
      AND COALESCE(m."sentAt", m."createdAt") >= ${fromTs}
      AND COALESCE(m."sentAt", m."createdAt") < ${toTs}
  `;
}

// Two-step scan (rev 10). The old single combined query joined click codes in
// SQL; with enable_nestloop=off (needed against planner misestimates) that hash
// join re-scanned the ENTIRE message_click_codes table on every request — a
// fixed cost that grows with total table size, which by late August exceeded
// the 240s timeout for every uncached day (even 4-hour chunks). Instead:
// (1) index-bracketed scan of the window's messages, (2) batched IN() probes
// of the message_click_codes (messageId) index, (3) aggregate in JS. Work is
// proportional to the window's message count, never to table size, and there
// is no join for the planner to misestimate.
const LINK_BATCH = 1000;

async function runScan(userId, fromTs, toTs) {
  const [, msgs] = await prisma.$transaction([
    prisma.$executeRaw`SET LOCAL statement_timeout = ${Prisma.raw(String(STATEMENT_TIMEOUT_MS))}`,
    prisma.$queryRaw(buildMessagesSql(userId, fromTs, toTs)),
  ]);

  // Distinct (message, shortlink) pairs for the window's messages, batched so
  // each probe is a bounded set of indexed lookups.
  const linksByMessage = new Map();
  for (let i = 0; i < msgs.length; i += LINK_BATCH) {
    const batch = msgs.slice(i, i + LINK_BATCH).map((m) => m.id);
    const links = await prisma.$queryRaw(Prisma.sql`
      SELECT DISTINCT "messageId" AS message_id, "shortlinkId" AS shortlink_id
      FROM "message_click_codes"
      WHERE "messageId" IN (${Prisma.join(batch)})
    `);
    for (const l of links) {
      const arr = linksByMessage.get(l.message_id);
      if (arr) arr.push(l.shortlink_id);
      else linksByMessage.set(l.message_id, [l.shortlink_id]);
    }
  }

  // Aggregate to the same row grain the old combined query produced:
  // (send_id, campaign_id, date). A message's cost splits evenly across its
  // distinct shortlinks; counts/parts attach whole to each link row, and
  // link-less messages become send_id=null rows ('unattributed' downstream).
  const round4 = (n) => Math.round(n * 10000) / 10000;
  const grouped = new Map();
  for (const m of msgs) {
    const links = linksByMessage.get(m.id) || [null];
    for (const sendId of links) {
      const k = `${sendId}|${m.campaign_id}|${m.date}`;
      const cur = grouped.get(k) || {
        send_id: sendId, campaign_id: m.campaign_id, date: m.date,
        message_count: 0, billed_count: 0, parts: 0, total_cost: 0
      };
      cur.message_count += 1;
      if (m.cost != null) cur.billed_count += 1;
      cur.parts += m.parts;
      cur.total_cost += (m.cost ?? 0) / links.length;
      grouped.set(k, cur);
    }
  }
  return [...grouped.values()].map((r) => ({ ...r, total_cost: round4(r.total_cost) }));
}

// Prisma P2010 wrapping Postgres 57014 = our SET LOCAL statement_timeout fired.
function isStatementTimeout(error) {
  return error?.code === 'P2010' && String(error?.meta?.code ?? '') === '57014';
}

// The heaviest send days (observed: 2026-07-05..07-08) exceed the statement
// timeout as a single query and would otherwise never complete — and never
// reach the durable cache. Slicing the day bounds each query's work: every
// aggregate is additive and each message falls in exactly one slice (by its
// COALESCE(sentAt, createdAt) instant), so concatenated slice rows group to
// identical day totals downstream.
const DAY_CHUNKS = 6; // 4-hour slices; ~1/6 of a day that misses 240s fits easily

async function computeDayRows(userId, day) {
  const dayStartTs = new Date(`${day}T00:00:00.000Z`);
  const dayEndExclusive = new Date(dayStartTs.getTime() + DAY_MS);
  const t = Date.now();
  try {
    const rows = await runScan(userId, dayStartTs, dayEndExclusive);
    console.log(`[cost-report] day=${day} query: ${rows.length} row(s) in ${Date.now() - t}ms`);
    return rows;
  } catch (error) {
    if (!isStatementTimeout(error)) {
      console.error(`[cost-report] day=${day} FAILED after ${Date.now() - t}ms`);
      throw error;
    }
    console.log(`[cost-report] day=${day} timed out at ${Date.now() - t}ms — falling back to ${DAY_CHUNKS} sub-day chunks`);
  }

  const chunkMs = DAY_MS / DAY_CHUNKS;
  const rows = [];
  for (let i = 0; i < DAY_CHUNKS; i++) {
    const fromTs = new Date(dayStartTs.getTime() + i * chunkMs);
    const toTs = new Date(dayStartTs.getTime() + (i + 1) * chunkMs);
    const tC = Date.now();
    try {
      const chunkRows = await runScan(userId, fromTs, toTs);
      rows.push(...chunkRows);
      console.log(`[cost-report] day=${day} chunk ${i + 1}/${DAY_CHUNKS}: ${chunkRows.length} row(s) in ${Date.now() - tC}ms`);
    } catch (error) {
      console.error(`[cost-report] day=${day} chunk ${i + 1}/${DAY_CHUNKS} FAILED after ${Date.now() - tC}ms`);
      throw error;
    }
  }
  console.log(`[cost-report] day=${day} chunked: ${rows.length} row(s) in ${Date.now() - t}ms total`);
  return rows;
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
 * - key:     Required - Hermes API key for authentication (same as /api/revenue)
 * - date:    Optional - single UTC day (default: yesterday UTC)
 * - start:   Optional - inclusive UTC start day (requires end)
 * - end:     Optional - inclusive UTC end day (requires start)
 * - refresh: Optional - refresh=1 recomputes days even when durably cached
 *            (correction path; recomputed settled days overwrite their cache)
 *
 * Rev 8: the report is computed DAY BY DAY, and each settled day's slice
 * (ended > SETTLE_HOURS ago; immutable) is persisted to cost_report_days.
 * Historical days are therefore computed at most once EVER — a retried or
 * re-pulled backfill window reads them back in milliseconds instead of
 * recomputing 100-230s scans, and a timeout partway through a multi-day
 * window keeps the days already computed (the retry only runs what's left).
 *
 * Rev 9: a day whose single query exceeds the statement timeout (the heaviest
 * blast days) automatically falls back to 4-hour sub-day chunks — each its own
 * bounded query — merged into the same day slice and cached. Every day now
 * converges, no matter how heavy.
 *
 * Rev 10: the combined SQL join was replaced with a two-step scan (messages
 * via index bracket, then batched IN() probes for click codes, aggregated in
 * JS) after the join's full-table-scan fixed cost grew past the timeout for
 * every day. Per-day cost now scales with that day's message count only; the
 * chunk fallback remains as a safety net.
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

    // Enumerate the window's UTC days and which of them are settled
    // (cacheable): a day is settled once it ended > SETTLE_HOURS ago.
    const settleCutoff = new Date(Date.now() - SETTLE_HOURS * 60 * 60 * 1000);
    const days = [];
    for (let ts = startTs.getTime(); ts < endTsExclusive.getTime(); ts += DAY_MS) {
      const day = new Date(ts).toISOString().slice(0, 10);
      days.push({ day, settled: new Date(ts + DAY_MS) <= settleCutoff });
    }

    console.log(`[cost-report] rev=${REPORT_REV} start window=${start}..${end} days=${days.length} auth=${Date.now() - t0}ms`);

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

    // maintenance=1: one-shot hygiene, auth-gated. ANALYZE refreshes the stale
    // stats that cause the rows=1 misestimates; pg_cancel_backend clears
    // zombie report queries left by abandoned pre-rev-6 attempts (same-role
    // backends only — no superuser needed). Both safe to re-run.
    if (searchParams.get('maintenance') === '1') {
      const tM = Date.now();
      await prisma.$executeRaw`ANALYZE "messages"`;
      await prisma.$executeRaw`ANALYZE "message_click_codes"`;
      const cancelled = await prisma.$queryRaw`
        SELECT pg_cancel_backend(pid) AS ok, pid
        FROM pg_stat_activity
        WHERE state = 'active' AND pid <> pg_backend_pid()
          AND query LIKE '%message_click_codes%'
          AND query_start < now() - interval '5 minutes'`;
      console.log(`[cost-report] maintenance: analyzed 2 tables, cancelled ${cancelled.length} stale quer(ies) in ${Date.now() - tM}ms`);
      return json({ analyzed: ['messages', 'message_click_codes'], cancelled: cancelled.length, ms: Date.now() - tM });
    }

    // explain=1: log + return the PLAN of the window's first day's step-1
    // messages scan (no execution) — the only query with a plan worth checking;
    // the link lookups are bounded IN() probes of the messageId index.
    if (searchParams.get('explain') === '1') {
      const dayStartTs = new Date(`${days[0].day}T00:00:00.000Z`);
      const daySql = buildMessagesSql(userId, dayStartTs, new Date(dayStartTs.getTime() + DAY_MS));
      const plan = await prisma.$queryRaw(Prisma.sql`EXPLAIN (FORMAT TEXT) ${daySql}`);
      const lines = plan.map((r) => r['QUERY PLAN']);
      console.log(`[cost-report] EXPLAIN day=${days[0].day}:\n${lines.join('\n')}`);
      return json({ start, end, explain_day: days[0].day, explain: lines });
    }

    await ensureCacheTable();

    // Load durably cached slices for settled days (skipped by refresh=1).
    const forceRefresh = searchParams.get('refresh') === '1';
    const settledDays = days.filter((d) => d.settled).map((d) => d.day);
    const cached = !forceRefresh && settledDays.length
      ? await prisma.costReportDay.findMany({
          where: { userId, day: { in: settledDays } },
          select: { day: true, body: true }
        })
      : [];
    const cachedByDay = new Map(cached.map((c) => [c.day, c.body]));

    // Compute the missing days SEQUENTIALLY (parallel day scans on one droplet
    // DB would contend with each other and live send traffic). Each settled
    // day is persisted the moment it finishes, so a timeout later in the
    // window never throws away completed work.
    const allRows = [];
    let computedDays = 0;
    for (const { day, settled } of days) {
      const hit = cachedByDay.get(day);
      if (hit) {
        allRows.push(...hit.rows);
        continue;
      }
      const rows = await computeDayRows(userId, day);
      computedDays++;
      allRows.push(...rows);
      if (settled) {
        await prisma.costReportDay.upsert({
          where: { userId_day: { userId, day } },
          create: { userId, day, body: { rows } },
          update: { body: { rows }, computedAt: new Date() }
        });
      }
    }
    console.log(`[cost-report] window=${start}..${end}: ${cachedByDay.size} day(s) cached, ${computedDays} computed`);

    // Split the per-day scans into the two report sections. Send rows collapse
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

    // Attach shortlink + campaign names for the send rows. Names are attached
    // at read time (never cached) so renames show up on historical pulls.
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
    return json({ start, end, currency: 'USD', rows, unattributed });
  } catch (error) {
    console.error('[cost-report] ERROR:', error);
    return json({ error: 'Internal server error' }, 500);
  }
}
