# Hermes Rebuild Proposal — Throughput + UI Performance

**Primary goal:** Sustain 20 messages/sec on each of 3 toll-free numbers simultaneously (60 MPS / 3,600 MPM aggregate) without breaking a sweat, plus make the dashboard load fast.

**Constraint:** Don't lose any existing functionality — revolver assignment, click-code tracking, shortlinks, opt-out handling, scheduled sends, workflow-based sends, delivery webhooks, spam-rate analytics, conversation view.

---

## Table of Contents

1. [What's there now (current state)](#1-whats-there-now-current-state)
2. [Why it can't hit 20 MPS × 3 numbers](#2-why-it-cant-hit-20-mps--3-numbers-throughput-shortcomings)
3. [Why the dashboard is slow](#3-why-the-dashboard-is-slow-ui-shortcomings)
4. [Target architecture](#4-target-architecture)
5. [New data model](#5-new-data-model)
6. [The new send pipeline, step by step](#6-the-new-send-pipeline-step-by-step)
7. [The new dashboard read path](#7-the-new-dashboard-read-path)
8. [Infrastructure & cost](#8-infrastructure--cost)
9. [Migration plan (phased, can keep the app running)](#9-migration-plan-phased-can-keep-the-app-running)
10. [Observability & SLOs](#10-observability--slos)
11. [Risks and open questions](#11-risks-and-open-questions)

---

## 1. What's there now (current state)

**Stack:** Next.js 14 (App Router) + Prisma 6 + PostgreSQL + Telnyx SDK + NextAuth. Hosted on DigitalOcean App Platform: 1 web app instance + 1 managed Postgres (DO pooler at port 25061 in transaction mode, current `connection_limit=20`, `pool_timeout=20` per `.env`).

**Send pipeline today** (`src/lib/actions/campaigns.js:1145–1567` — `executeDedicatedSend`):

1. Caller (UI or `/api/jobs/process` cron) invokes `executeDedicatedSend(campaignId, scheduledAt, jobId, userId)`.
2. Setup phase: reads campaign + targets, creates/claims a `SendJob` row, fetches user settings + `getTelnyxConfig()` + `PhoneNumber[]` for the user in `Promise.all`, builds an in-memory `phoneNumberConfigMap` keyed by `phoneNumber.id` plus a `'legacy'` fallback using `User.telnyxPhoneNumber`.
3. Outer paging loop: `getCampaignContactsPaginated(campaignId, page, 1000, userId)` returns 1,000 contacts per page. Each page issues 3 queries internally (a duplicate `campaign.findFirst`, a `contact.findMany`, and a `contact.count` — re-issued on every page).
4. Inner batch loop: slice of 50 contacts → group by `assignedPhoneNumberId` → `Promise.allSettled` across groups.
5. Inside each group, 4 phases:
   - **Phase 1:** `prisma.message.createMany` — bulk insert with status `queued` (1 round trip per group). IDs pre-generated with `crypto.randomUUID()`.
   - **Phase 2:** `createMessageClickCodesBatch()` — 1 `shortlink.findMany` to validate ownership + 1 `messageClickCode.createMany` for all (contacts × shortlinks) codes.
   - **Phase 3:** `Promise.allSettled` over `retryWithBackoff(sendMessageBulkOptimized(...))` — N concurrent Telnyx HTTPS calls in flight at once.
   - **Phase 4:** array of N `prisma.message.update(...)` ops + one `contact.updateMany` for `lastMessageSent`, wrapped in `prisma.$transaction([...])`. **This is a single interactive transaction holding a pool connection while it serially round-trips N UPDATEs.**
6. After all groups settle: fire-and-forget `updateSendJobProgress` + `campaign.update({ messagesSent: { increment } })`. Pacing sleep based on `Math.ceil((batchSize / rateLimit) * 60000)`.

**Job processor** (`src/app/api/jobs/process/route.js`): authenticated by `?secret=`, polled externally. On each tick: processes delayed workflow actions, scheduled redirects, then `getPendingJobs(5)` and runs each job **sequentially, inline inside the HTTP handler** (`await executeDedicatedSend(...)`). There is no external worker process. All sends — scheduled and immediate — run inside the Next.js web dyno.

**Webhook handlers:**
- `POST /api/message/status` (`src/app/api/message/status/route.js`): resolves user via 5-min `messagingProfileCache`, then does `message.findUnique({ where: { telnyxMessageId } })` followed by `message.update`. Also fires `contact.update`, `trackSpamFilterEvent`, or `contact.updateMany` (auto-unsubscribe) — most fire-and-forget. Telnyx fires ≈2 webhooks per outbound (sent + finalized), so a 10k blast = ~20k webhooks pounding the same Postgres pool the sender is using.
- `POST /api/message/inbound` (STOP handler): revolver-aware lookup (`phoneNumber.findFirst` → `user.findFirst` fallback) + 1 `contact.updateMany`.

**Tracking surface** (the data model the rebuild has to preserve):
- `Message` — full text, parts, status (`queued/sending/sent/delivered/sending_failed/delivery_failed/delivery_unconfirmed`), cost, `telnyxMetadata` JSON blob, send/deliver/fail timestamps, error message, direction, `(userId, contactId, campaignId)` foreign keys.
- `MessageClickCode` (6-char base62) — per (message × shortlink × contact) tracking, with `opened` (preview fetch) + `clicked` (actual click) flags and `ShortlinkClick` rows for individual clicks. 30-day TTL.
- `ShortlinkClick` — individual click row with `hrms`, user-agent, IP, referrer.
- `RevenueEvent` — attribution row tying revenue back through shortlinkClick → message → campaign.
- `SpamFilterEvent` — idempotent per `eventKey` log of carrier spam blocks.
- `ConsoleLog` — server log mirror.
- `PhoneNumber` — revolver pool with `enabled`, `acceptingNewLeads`, `rateLimit`, `currentMonthMessages`.

Nothing here goes away in the rebuild — the model is correct in spirit. It's the **runtime infrastructure** and a few **per-message hot-path patterns** that need surgery.

---

## 2. Why it can't hit 20 MPS × 3 numbers (throughput shortcomings)

The math says the current setup tops out around 300–600 MPM sustained before pool exhaustion. The 60 MPS target is **~6× that**. Here's why, ranked by severity:

### S1 — Send loop runs inside the Next.js web process

Every send — scheduled or immediate — executes inside a Next.js request handler. The web dyno is the same process serving the dashboard, the contacts page, and every Telnyx delivery webhook. They all share one event loop, one Prisma pool, one outbound HTTP connection pool.

A 100k-contact blast in this process competes for CPU and DB connections with:
- ~67 Telnyx webhooks/sec (≈2 webhooks × 33 sends/sec)
- Whatever UI traffic exists
- Whatever cron tasks (`processDelayedActions`, `processScheduledRedirects`) ran before the send started

DO App Platform's request timeout also bounds how long a single HTTP request can run. Immediate sends are particularly fragile: if the dyno restarts mid-flight, the job is stuck in `processing` forever — `recoverStaleSendJobs` (`sendJob.js:187`) only resets jobs where `scheduledAt IS NOT NULL`.

**Cap implied:** even on the best day, you're sharing one Node event loop across all SMS work and all web traffic.

### S2 — Interactive `$transaction` per group serializes post-Telnyx writes

`prisma.$transaction([...messageUpdates])` (`campaigns.js:1468`) wraps N individual `message.update` statements **plus** a `contact.updateMany` in one transaction. Prisma issues them sequentially within the transaction. With 10 messages per group, that's 10 sequential round trips × ~5–10 ms each ≈ 50–100 ms of held connection, per group, per batch. Multiple concurrent groups starve the pool fast.

There is **no atomicity requirement** for these updates — message rows don't constrain each other. The transaction exists only because Prisma doesn't natively support `updateMany` with per-row values. A single raw `UPDATE … FROM (VALUES …)` would compress N round trips into 1.

### S3 — Postgres connection pool is sized for 2024, not 2026

`.env` has `connection_limit=20&pool_timeout=20`. Prisma's own comments in `src/lib/prisma.js:7–31` recommend `connection_limit=50–100` for bulk sends and `pool_timeout=30`. With the current 20-connection cap, three concurrent send groups can already exhaust the pool when webhooks are flowing.

DO's transaction-mode pooler can handle 100+ client connections backed by ~22 backend connections — the bottleneck is the Prisma-side `connection_limit`, not the DB itself.

### S4 — Two writes per outbound message (queued → sent), plus another on webhook

For every successful outbound:
- `message.createMany` writes a row with `status='queued'`.
- `message.update` rewrites the same row with `telnyxMessageId`, `status='sent'`, `costAmount`, `sentAt`, `text` (with codes), and `telnyxMetadata` (the full Telnyx response — usually 1–3 KB of JSON).
- A few seconds later, the `message.finalized` webhook does *another* `message.findUnique` + `message.update`, which **overwrites** `telnyxMetadata` with the webhook payload.

So `telnyxMetadata` is written twice and the second write throws away the first. At 100k messages that's >300 MB of JSON churn on a TOAST column — pure waste.

### S5 — "Per-number rate limit" is a label, not a budget

`PhoneNumber.rateLimit` (1,200 default) is read into config and used **only** to compute the inter-batch sleep (`campaigns.js:1471, 1521`). Within a batch, all messages for a number fire in parallel — no semaphore, no token bucket, no per-number gate. If you launch a batch of 50 contacts all assigned to phone #1, you get 50 simultaneous Telnyx calls to one number; you blew past 20 MPS for that one number.

`rateLimitCache` (`src/lib/rateLimitCache.js`) is a per-userId cache, not per-number, and `executeDedicatedSend` doesn't even consult it (only `executeManualFire` does).

### S6 — Cron processor sequentially `await`s each job inline

`/api/jobs/process` (`route.js:30–43`) iterates `pendingJobs` and runs `await executeDedicatedSend(...)` one at a time inside one HTTP handler. So scheduled jobs run serially, one cron tick at a time. With sends that can take minutes, this means a single big send blocks every other scheduled job.

### S7 — Workflow / manual-fire path is the un-optimized path

`executeManualFire` (`campaigns.js:369–613`) uses `executeWorkflow` → the legacy `telnyx.js:sendMessage()` which still does the old 5–6 round trips per message and instantiates a fresh `new Telnyx()` client per call (`telnyx.js:227`). The "bulk optimized" sender is only used by `executeDedicatedSend`.

### S8 — No idempotency key on Telnyx send

`telnyxClient.messages.create(...)` doesn't pass an `Idempotency-Key` header. `retryWithBackoff` can therefore double-send if the original succeeded but the response was lost in transit.

### S9 — Duplicate-send guard is a JS `Set` in process memory

`sentContactIds` (`campaigns.js:1157, 1343`) dedupes within one invocation only. There's no DB unique constraint on `(campaignId, contactId)` for outbound messages. A retried or stuck-and-restarted job can re-send.

### S10 — `contact.count(*)` runs on every page of pagination

`contactPagination.js:154, 290` issues `prisma.contact.count` for every page of the outer loop. On 50k subscribed contacts paged at 1,000/page that's 50× the same count.

### Net effect

The realistic ceiling on the current architecture is ~5–10 MPS aggregate sustained, with serious tail-latency degradation under webhook backpressure. To hit **60 MPS sustained**, the rebuild has to (a) move the send loop out of the web process, (b) shrink per-message DB cost, (c) enforce per-number rate budgets with real concurrency control, (d) keep webhooks off the sender's pool, and (e) cache hot reads so the dashboard doesn't compete with the send loop.

---

## 3. Why the dashboard is slow (UI shortcomings)

### S11 — Dashboard fires 11+ heavy queries on every load

`getDashboardData` (`src/lib/actions/dashboard.js:52–298`) issues ~11 queries in `Promise.all`, including:
- `shortlink.aggregate(clicks, opens)` with no date filter — sums **all-time** clicks every load (line 137).
- `campaign.findMany take:100` pulling full `message` text + `workflow` JSON just to filter `workflow === null` in JS (line 144).
- `getSpamRateAnalyticsForUser` runs `prisma.message.findMany({ select: { createdAt: true } })` over every outbound message in the date range with **no LIMIT** (`spamTracking.js:162–171`) — devolves into a millions-of-rows scan on week/month/year.

The only cache is `dashboardCache`, an in-process `Map` with a 30s TTL (line 7) — useless across workers, dies on every redeploy.

### S12 — Conversations are re-derived in JS on every messages page load

There is no `Conversation` model. `/hermes/messages` loads raw messages (50 at a time, including the full `text @db.Text` and `telnyxMetadata Json` blobs by default) and `conversationUtils.js:47–124` groups them by normalized phone in JavaScript. Pagination is over raw messages, but the UI is conversation-centric, so a user paging 50 messages might see 5 conversations.

`getMessageStats` (`messages.js:99–146`) runs **5 unbounded `count`s + 1 aggregate** with no date filter — every load re-counts every outbound message ever sent.

### S13 — Analytics breakdown is OLAP on OLTP

`getBreakdownData` (`analyticsBreakdown.js:19–348`) does a 5-level `include` (campaign → shortlink → shortlinkClick → messageClickCode → contact → tags), no LIMIT, then fans rows out per-tag in JS. On any nontrivial volume it scans every revenue event, every outbound message, every click, joined to contacts/tags, then explodes in app memory. This is structural OLAP work running on the OLTP DB.

Same file uses `$queryRaw` with `GROUP BY DATE("createdAt")` — `DATE()` can't use a normal index, so it's a sequential scan per query.

### S14 — Contacts list does ILIKE search with no trigram index

`getContactsPaginated` ILIKE-searches `firstName / lastName / email / phone / source` (`contacts.js:94–101`) with no `pg_trgm` GIN index. Sequential scan on every keystroke.

### S15 — Shortlinks page returns every shortlink the user has ever made

`getShortlinks` (`shortlinks.js:14–46`) — no take, no pagination, full `Campaign` include. Fine today; doesn't scale.

### S16 — Missing indexes worth calling out

- `Contact.phone` (used in `addContactsBatch` dedup and inbound STOP) — should be `@@unique([userId, phone])`.
- `Contact.source` (used in `distinct: ['source']` in analytics).
- `(userId, source)` and `(userId, assignedPhoneNumberId)` composite indexes.
- `Shortlink (userId, createdAt)` — only `slug` is indexed.
- Trigram GIN on contact search columns.
- Functional index `(userId, direction, DATE("createdAt"), status)` for analytics raw SQL.

### Net effect

The dashboard's slowness is the same DB the sender uses being asked to do OLAP on every paint, with no Redis layer absorbing the repeated reads. Fix the DB and cache layer correctly and the dashboard gets fast for free.

---

## 4. Target architecture

```
                              ┌────────────────────┐
                              │  Telnyx (cloud)    │
                              └──┬──────────────▲──┘
                                 │ 1 HTTP/msg   │ webhooks
                                 │              │
                  ┌──────────────┼──────────────┼──────────────┐
                  │              ▼              │              │
                  │   ┌──────────────────┐   ┌──┴──────────┐   │
   sends ────────►│   │ Send Worker(s)   │   │ Webhook svc │   │ DigitalOcean
                  │   │ Droplets, N=4-8  │   │ (droplets,  │   │ behind a load
                  │   │ Node + BullMQ    │   │  stateless) │   │ balancer
                  │   └──┬───────────────┘   └──┬──────────┘   │
                  │      │                      │              │
                  │      ▼                      ▼              │
                  │   ┌────────────────────────────────────┐   │
                  │   │   Redis (managed, single primary)  │   │
                  │   │   • BullMQ queues per number       │   │
                  │   │   • token-bucket rate limiters     │   │
                  │   │   • messagingProfile cache         │   │
                  │   │   • dashboard/list caches          │   │
                  │   │   • idempotency keys               │   │
                  │   └────────────────────────────────────┘   │
                  │                  │                         │
                  │                  ▼                         │
                  │   ┌────────────────────────────────────┐   │
                  │   │   PostgreSQL primary (managed)     │   │
                  │   │   • OLTP only                      │   │
                  │   │   • PgBouncer transaction pool     │   │
                  │   │   • partitioned messages table     │   │
                  │   └──┬─────────────────────────────────┘   │
                  │      │ logical replica                     │
                  │      ▼                                     │
                  │   ┌────────────────────────────────────┐   │
                  │   │   Postgres read replica            │   │
                  │   │   • dashboards, analytics          │   │
                  │   │   • async rollups                  │   │
                  │   └────────────────────────────────────┘   │
                  │                                            │
                  │   ┌────────────────────────────────────┐   │
   web traffic ──►│   │ Next.js web (droplets, N=2-3,      │   │
                  │   │ behind LB) — UI + APIs + webhooks  │   │
                  │   │ talks to Redis + Postgres replica  │   │
                  │   └────────────────────────────────────┘   │
                  └────────────────────────────────────────────┘
```

Three things are different from today:

1. **The send loop is its own service, on its own droplets.** Web traffic and sends no longer fight for the same event loop or Prisma pool.
2. **Redis is the source of truth for in-flight rate limiting, queues, and hot reads.** Postgres is no longer asked to be a queue.
3. **Postgres is split into primary (OLTP) + read replica (analytics).** Dashboards read the replica; sends never compete with the dashboard.

### Component choices (modular, swappable)

- **App platform → droplets.** Standardized Ubuntu 22 droplet images with Node 22 + the same Hermes Docker image. Scale by adding droplets, not by paying App Platform pricing. Use **DO Load Balancer** (or Caddy/nginx) in front of web droplets. Send-worker droplets are not behind the LB.
- **Job queue: BullMQ on Redis.** Battle-tested for Node, native rate-limiter + per-queue concurrency, retries with exponential backoff, dead-letter queue, dashboards.
  - Alternative: **pg_boss** if you want to avoid running Redis for queueing (keeps queue in Postgres). I'd avoid this — Postgres-as-queue is what bit you the first time.
- **Redis: DO Managed Redis** (or Upstash if you want serverless billing). Small enough that you don't need a cluster.
- **DB: keep DO Managed Postgres**, bump tier to the next size up, and enable a read replica. Stay on Postgres; you don't need Mongo/DynamoDB/etc.
- **PgBouncer:** already in front of DO Postgres in transaction mode (port 25061). Bump app `connection_limit` to 80–100 per app instance.
- **Object storage:** S3 is already wired for OG-image uploads (`@aws-sdk/client-s3`). Keep it.
- **Observability:** OpenTelemetry → Grafana Cloud (free tier covers this) or Datadog. Prometheus scrape on each droplet for system metrics. **Critical** — without metrics you can't tell if you actually hit 60 MPS.

---

## 5. New data model

The Prisma schema mostly stays. Targeted changes:

### 5.1 New: `Conversation` table (kills S12)

```prisma
model Conversation {
  id                Int      @id @default(autoincrement())
  userId            String
  contactId         Int?     // null if contact deleted but conversation kept
  contactPhone      String   // normalized E.164
  phoneNumberId     Int?     // which of our numbers this conversation is on
  lastMessageAt     DateTime
  lastMessageText   String   @db.VarChar(280) // truncated preview only
  lastMessageDir    String   // 'inbound' | 'outbound'
  unreadCount       Int      @default(0)
  totalMessages     Int      @default(0)
  totalDelivered    Int      @default(0)
  totalFailed       Int      @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  contact           Contact? @relation(fields: [contactId], references: [id], onDelete: SetNull)

  @@unique([userId, contactPhone])
  @@index([userId, lastMessageAt(sort: Desc)])
  @@map("conversations")
}
```

Maintained by **the send worker on outbound** and **inbound webhook handler on inbound** via a small atomic upsert. Messages page goes from grouping-in-JS to `SELECT * FROM conversations WHERE userId=? ORDER BY lastMessageAt DESC LIMIT 50`.

### 5.2 New: `MessageDailyStats` rollup

```prisma
model MessageDailyStats {
  id              Int      @id @default(autoincrement())
  userId          String
  campaignId      Int?
  phoneNumberId   Int?
  day             DateTime @db.Date
  sent            Int      @default(0)
  delivered       Int      @default(0)
  failed          Int      @default(0)
  inboundReplies  Int      @default(0)
  cost            Decimal  @default(0) @db.Decimal(12, 4)
  revenue         Decimal  @default(0) @db.Decimal(12, 4)
  clicks          Int      @default(0)
  opens           Int      @default(0)

  @@unique([userId, campaignId, phoneNumberId, day])
  @@index([userId, day])
  @@map("message_daily_stats")
}
```

Refreshed every 5–15 minutes by a cron worker against the **read replica** with `INSERT ... ON CONFLICT DO UPDATE`. Powers the dashboard and analytics in O(rows-in-range).

### 5.3 Modify: `Message` partitioning

`Message` becomes the largest table by a wide margin (~2 webhooks × ~100k+ sends/month). Partition by `createdAt` monthly using native PG declarative partitioning:

```sql
CREATE TABLE messages (...) PARTITION BY RANGE (createdAt);
CREATE TABLE messages_2026_05 PARTITION OF messages FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
-- pg_partman or a small cron auto-creates next month's partition
```

Drops indexes scan size dramatically. Old partitions can be `DETACH`-ed and archived to S3 after 90 days.

Also: **drop `telnyxMetadata` from per-message storage** for outbound. Keep it only on failures (with a `Message.failureDetails` JSON column). For successful sends, you don't need the 1–3 KB Telnyx response — `telnyxMessageId` + `status` + `costAmount` is enough. Store the full payload only when `status` ends in `_failed` for debugging. This alone cuts table size ~50% and shrinks TOAST churn.

### 5.4 Modify: outbound dedup constraint

```prisma
@@unique([campaignId, contactId, direction]) // on Message, with partial: where direction='outbound'
```

Enforce at the DB level so retries / crash-restarts can't double-send.

### 5.5 Modify: indexes called out in §3

- `Contact: @@unique([userId, phone])`
- `Contact: @@index([userId, source])`, `@@index([userId, assignedPhoneNumberId])`
- `Shortlink: @@index([userId, createdAt])`
- `pg_trgm` GIN on contact search columns
- `Conversation` indexes per §5.1

### 5.6 Modify: `PhoneNumber` — add tracked monthly counter via cron

Today `PhoneNumber.currentMonthMessages` exists but nothing increments it. Have the rollup worker write to it nightly from the daily stats table. Use it in the assignment heuristic.

---

## 6. The new send pipeline, step by step

### 6.1 Submission → queue (web tier)

UI hits a server action. Server action:

1. Reads campaign config + target sets (lists, tags, sources).
2. Streams **contact IDs only** (not full rows) from Postgres via a keyset-paginated query, writing them into a Redis Set keyed `campaign:{id}:queued`.
3. Creates a `SendJob` row in Postgres (status `queued`) for UI tracking.
4. Enqueues a single BullMQ job `campaign:start` carrying `{ jobId, campaignId, userId }`.
5. Returns immediately. The web request is now done.

No more "send loop inside the web request." The UI shows the `SendJob` progress by polling `GET /api/jobs/:id` (which reads from Redis-cached fields).

### 6.2 Fan-out into per-number queues (send-worker tier)

A BullMQ worker on the send droplets picks up `campaign:start`. It:

1. Loads campaign + user + phone numbers + opt-out text **once**.
2. Loads contact IDs from Redis in chunks of, say, 5,000.
3. For each chunk, runs the assignment heuristic and groups contact IDs by destination number. Pushes each group onto a per-number queue: `send:phone:{phoneNumberId}` (or `send:phone:legacy`).
4. Stamps an idempotency key per (message-intent) into Redis: `msg-intent:{campaignId}:{contactId}` with the generated `messageId` as the value, TTL 7 days. This protects against accidental double-sending across retries.

Per-number queues are the unit of rate limiting. Each queue has:
- **Rate limiter** (BullMQ-native): `{ max: 20, duration: 1000 }` enforces 20 msg/sec. Tune per number.
- **Concurrency** (BullMQ): start at 10. The worker handles up to 10 messages in parallel for the queue, the rate limiter gates the start time.

This gives you per-number, per-second budgets enforced by Redis — exactly what S5 needs.

### 6.3 Processing one message (send-worker tier)

A send-queue worker dequeues a job `{ messageId, contactId, campaignId, userId, phoneNumberId, text, shortlinkSubs }`. It:

1. Calls Telnyx (`messages.create`) with `Idempotency-Key: messageId`. Single HTTP call. Reuses a persistent Telnyx client per worker process (one `new Telnyx()` per process, not per message).
2. Pushes the result onto a **single shared write-batcher queue**: `write:messages`.

That's it. The worker doesn't write to Postgres directly — that's the next stage's job.

### 6.4 Batched writes (write-batcher worker)

A dedicated worker drains the `write:messages` queue in batches of up to 200 every 200 ms (whichever comes first). For each batch:

1. One `UPDATE messages SET status=…, telnyxMessageId=…, costAmount=…, sentAt=… FROM (VALUES …) WHERE id=…` (raw SQL, single round trip).
2. One `UPDATE contacts SET lastMessageSent=… WHERE id IN (…)` for successes.
3. Increment Redis counters for `SendJob` progress (so the UI sees liveness without DB writes).

Periodically (say every 5 s), flush Redis counters into the `SendJob` row in one update.

**Net DB cost per message in steady state: ~3 writes amortized across 200 messages = effectively 1 write per 60–70 messages of throughput.** Compare with current ~70 round trips per 50 messages — that's a **>100× reduction** in DB round trips per outbound.

### 6.5 Click codes — same batching, but at submission time

Click codes are generated **once per campaign, per contact** at submission (step 6.1), not per send. The generation is pure CPU + one `messageClickCode.createMany` per chunk of 1000–5000. The text-with-codes is stored in Redis alongside the contact-id in the per-number queue payload, so the worker doesn't touch Postgres for codes either.

### 6.6 Webhook ingestion (web tier)

Telnyx webhooks hit the web droplets. The handler:

1. Resolves user via Redis-cached `messagingProfileId → userId` lookup (already exists, just move to Redis).
2. **Pushes the webhook event onto a `webhook:status` Redis stream and returns 200 immediately.** This frees the HTTP request in <10 ms regardless of DB state.
3. A dedicated webhook-processor worker drains the stream in batches of 200 every 200 ms and applies the same VALUES-style bulk update as §6.4. Idempotency on `telnyxMessageId` (already unique).

This decouples webhook bursts from the DB pool entirely. Telnyx never sees a slow webhook even during a 60-MPS blast.

### 6.7 Rate limit story end-to-end

- **Per-number sustained rate:** BullMQ rate limiter on `send:phone:{id}` queues. 20 msg/sec each. Aggregate: 20 × N numbers.
- **Per-user fallback ceiling:** Redis token bucket `ratelimit:user:{userId}` with a 1-minute window. Defense-in-depth.
- **Concurrency cap:** BullMQ `concurrency` per queue. Stops a flash of 200 jobs from opening 200 Telnyx sockets at once.
- **Telnyx idempotency:** every retry uses the same `Idempotency-Key`. Doubles can't slip through.

### 6.8 Failure handling

- BullMQ retries with exponential backoff for Telnyx 5xx / network errors. Configure `attempts: 3, backoff: { type: 'exponential', delay: 1000 }`.
- Permanent failures (e.g. carrier filter, opt-out destinations) — write-batcher applies the auto-unsubscribe and spam-tracking via the same VALUES-pattern batched updates. The handler does **not** hit Postgres in a hot loop.
- Dead-letter queue: anything that exhausts retries lands on `send:phone:{id}:dead`. UI shows DLQ depth.

### 6.9 Concrete throughput sanity check

3 numbers × 20 MPS = **60 MPS**. Send worker concurrency 10 per queue × 3 queues = 30 in-flight Telnyx calls at peak. Telnyx latency typically 80–250 ms per call → 30 in flight comfortably yields 60+ MPS. CPU on a $24/mo droplet doing pure HTTPS + Redis is <30%. DB writes are 1 batched UPDATE every 200 ms = 5/sec on the primary. The bottleneck moves cleanly from the app to Telnyx itself.

If you want headroom to scale beyond 3 numbers, you scale send-worker droplets horizontally — each droplet runs the same image and BullMQ shards queues across them automatically. **Standardized droplets, modular scaling.**

---

## 7. The new dashboard read path

Three changes do the heavy lifting:

1. **Use the read replica for dashboard + analytics queries.** Configure a second `PrismaClient` with `DATABASE_URL_REPLICA`. All non-mutation routes use it. The write path is untouched.

2. **Stand up Redis-backed read caches** with explicit invalidation. Recommended keys + TTLs:

   | Key | TTL | Invalidated on |
   |---|---|---|
   | `dash:{userId}:{timeRange}` | 60 s | send job completion |
   | `msg-stats:{userId}` | 5 min | send job completion |
   | `convo-list:{userId}:p{n}` | 30 s | new message on user |
   | `campaign-list:{userId}` | 5 min | campaign create/update/delete |
   | `shortlink-list:{userId}` | 5 min | shortlink create/update/delete |
   | `analytics-breakdown:{userId}:{hash}` | 10 min | nightly rebuild |
   | `dim-values:{userId}` | 1 hour | rare; tag/source change |
   | `phone-numbers:{userId}` | 1 hour | settings change |

   Implementation: simple `redis.get` then `await dbRead()` then `redis.setex` wrapper. Use `revalidateTag` from Next.js for `unstable_cache` integration if you want the framework primitives.

3. **Build the `Conversation` table (§5.1) and `MessageDailyStats` rollup (§5.2).**
   - Conversations are maintained synchronously by the send worker and webhook processor on every status update. The messages page becomes `SELECT * FROM conversations ORDER BY lastMessageAt DESC LIMIT 50` — ~10 ms even with 10M messages.
   - Rollups are recomputed every 5–15 min by a small worker hitting the read replica with windowed aggregates and upserting into `message_daily_stats`. Dashboard / analytics queries scan O(days) rows, not O(messages).

Plus targeted index work:

- `pg_trgm` GIN indexes on `Contact.firstName / lastName / email / phone` for search.
- Functional indexes on `(userId, direction, DATE("createdAt"))` if you keep any of the raw SQL bucket queries (preferred: replace them with rollup table reads).
- The composite indexes called out in §5.5.
- Drop the `select`-less `prisma.message.findMany` patterns; always explicit `select` to avoid `text @db.Text` and `telnyxMetadata` on list views.

After these three changes, the dashboard's first paint should comfortably hit <300 ms even on a tenant with millions of historical messages. Today's worst offender (`getBreakdownData` joining 5 levels with no LIMIT) becomes a single rollup-table read.

---

## 8. Infrastructure & cost

| Component | Count | DO size | $/mo approx |
|---|---|---|---|
| Web droplets (Next.js) | 2 | basic-s-1vcpu-2gb-amd | $24 |
| Send-worker droplets | 2 (start) | basic-s-1vcpu-2gb-amd | $24 |
| Write-batcher / webhook-processor droplet | 1 | basic-s-1vcpu-2gb-amd | $12 |
| Rollup worker droplet | 1 | basic-s-1vcpu-1gb-amd | $7 |
| Load balancer | 1 | small | $12 |
| Managed Redis | 1 | basic 1GB | $15 |
| Managed Postgres primary | 1 | db-s-2vcpu-4gb | $60 |
| Postgres read replica | 1 | db-s-1vcpu-2gb | $30 |
| S3 (existing) | — | — | <$5 |
| **Total** |  |  | **~$190/mo** |

Compared to App Platform's per-app pricing this is similar or cheaper, while being **horizontally scalable** without lift-and-shift. To 5+ numbers, add a send-worker droplet ($12). To 10× traffic, add a read replica ($30) before scaling the primary.

All droplets pull the **same Docker image** at boot; only the `ROLE` env var differs (`web`, `send-worker`, `writer`, `rollup`, `webhook`). One image, one CI build, easy operations.

---

## 9. Migration plan (phased, can keep the app running)

The right order is **infrastructure first, queue next, hot-path optimizations last.** Don't refactor application code on top of the wrong infrastructure.

### Phase 0 — Quick wins on current infra (~1 week)

These are reversible, low-risk fixes that buy room before the rebuild. Do them first.

- Bump `connection_limit` to 80 and `pool_timeout` to 30 in `DATABASE_URL`. **(S3)**
- Replace `prisma.$transaction([...messageUpdates])` (`campaigns.js:1468`) with a single raw `UPDATE … FROM (VALUES …)` per group. **(S2)**
- Stop writing `telnyxMetadata` on successful sends; only on failures. **(S4)**
- Drop the duplicate `prisma.campaign.findFirst` call in `contactPagination.js`. **(S10)**
- Cache `contact.count` for the campaign for the duration of the send (in-memory inside the function). **(S10)**
- Fix `recoverStaleSendJobs` to also recover immediate jobs (`scheduledAt: null`) older than 30 min. **(S1 fragility)**
- Pass `Idempotency-Key` header on Telnyx calls. **(S8)**
- Add `@@unique([campaignId, contactId, direction])` partial index for outbound. **(S9)**

These alone should roughly **2–3× current throughput** (maybe to 15–30 MPS aggregate) and stabilize behavior. They're a low-risk bridge.

### Phase 1 — Read replica + Redis + dashboard caches (~2 weeks)

- Provision DO Managed Redis. Provision Postgres read replica.
- Add `DATABASE_URL_REPLICA` env. Create `prismaReplica` client. Route all read-only server actions (dashboard, analytics, list pages) to it.
- Wire Redis-backed caches for the keys in §7. Add cache busts on the matching mutations.
- Build `MessageDailyStats` table + a small rollup worker (separate Node process, scheduled every 5 min).
- Build `Conversation` table + write logic in the existing send path and inbound webhook. Backfill from existing messages with a one-shot script.
- Switch messages page UI to read from `Conversation` table.

At end of Phase 1 the dashboard is fast and the rebuild can proceed without the user noticing perf regressions while the send path is being rewritten.

### Phase 2 — Queue + worker tier (~2–3 weeks)

- Add BullMQ. Create the `campaign:start`, `send:phone:*`, `write:messages`, `webhook:status` queues.
- Write the new send-worker code path (`packages/worker/`) that wraps `sendMessageBulkOptimized` and produces to the write queue.
- Write the write-batcher worker (uses raw SQL bulk UPDATEs).
- Write the webhook-processor worker.
- Refactor `executeDedicatedSend` to be the queue submitter (steps 6.1 + 6.2 only). Keep the existing inline path behind a feature flag (`SEND_PIPELINE=legacy|queue`).
- Run both paths in parallel on a test campaign. Compare throughput, error rate, cost.

### Phase 3 — Droplet migration (~1 week)

- Build the unified Docker image. Add `ROLE` env switch.
- Provision droplets per §8. Deploy.
- Move DNS / load balancer to the new web droplets. Decommission the DO App Platform instance.
- Drain old `executeDedicatedSend` queue path (feature flag → `queue`), monitor for one full week.

### Phase 4 — Hot-path optimizations + cleanup (~1–2 weeks)

- Partition `Message` by month. Backfill into partitions.
- Replace remaining ILIKE searches with trigram-backed equivalents.
- Replace `getBreakdownData` with rollup-table reads.
- Remove the legacy `sendMessage` and `executeWorkflow → sendMessage` wrappers from the bulk path. Workflow executor switches to enqueueing into the same `send:phone:*` queues. **(S7)**
- Move webhook handler to push-to-stream only (§6.6).
- Wire OpenTelemetry + Grafana dashboards (queue depth, send latency, DB pool, Redis latency, MPS per number).

### Total

~7–9 weeks for one developer working full-time on this. Phase 0 alone gets you to ~15–30 MPS in a week; Phase 2 unlocks 60+ MPS; Phase 4 is the long-tail polish.

---

## 10. Observability & SLOs

You can't tune what you can't see. Mandatory metrics post-rebuild:

| Metric | Target | Alert if |
|---|---|---|
| MPS per phone number (1-minute average) | 20 sustained | < 15 for 5 min during active send |
| BullMQ queue depth `send:phone:*` | < 1000 idle | > 5000 for 5 min |
| Send-worker job duration p99 | < 500 ms | > 2 s |
| Telnyx 5xx rate | < 0.1% | > 1% |
| Webhook processing lag (stream to DB write) | < 5 s | > 30 s |
| Postgres connection pool utilization | < 70% | > 90% |
| Dashboard p95 load time | < 500 ms | > 2 s |
| Redis memory | < 50% of plan | > 80% |

Grafana Cloud free tier handles this comfortably. The send-worker should emit a per-message Prometheus counter so you can chart MPS in real time during the next big blast — this is the visualization that proves the rebuild worked.

---

## 11. Risks and open questions

1. **Carrier throttling vs. app throttling.** Telnyx's stated 20 MPS toll-free ceiling is per-number, but carriers sometimes apply soft throttles below that. Plan for a per-number `effective_rate_limit` that's tunable in `PhoneNumber.rateLimit` and start conservatively at 18 MPS, ramp up to 20 if no `40010`/`40011`/`30007` spikes.

2. **Telnyx idempotency-key support.** Verify the Telnyx Node SDK actually forwards `Idempotency-Key` headers (some versions ignore arbitrary headers). May need to drop to raw `fetch` for the `messages.create` call in the worker.

3. **PgBouncer transaction mode + Prisma prepared statements.** Add `?pgbouncer=true` to the connection string. Confirmed in the current `.env` comment but not currently set — verify.

4. **Backfill cost for `Conversation` table.** On a tenant with millions of messages, the backfill is a one-shot but it will be slow. Run it in batches with `LIMIT ... OFFSET` keyset style and rate-limit it.

5. **DLQ policy.** What happens to messages that exhaust 3 Telnyx retries? Surface them in a UI "Failed sends" tab tied to the `SendJob` so you can manually re-fire or unsubscribe.

6. **Multi-tenancy assumptions.** The codebase is single-tenant in practice (one user), but the schema is multi-tenant. The plan above scales fine for multi-tenant. Just confirm before partitioning by `(userId, day)` vs. just `day`.

7. **Cost of read replica.** $30/mo is the smallest replica. If analytics page p95 stays low, you might not need a replica at all in Phase 1 — Redis cache alone may cover it. Provision the replica in Phase 1 only if dashboard reads still impact send-loop tail latency post-cache.

8. **What kills the old infra?** Don't delete the App Platform instance until Phase 3 is stable for two weeks. Run both stacks side-by-side and cut DNS over once metrics match.

---

## TL;DR — what would happen if you said yes today

1. **This week** — Apply Phase 0. The app should sustain 15–30 MPS with no architectural changes. Buys time.
2. **Next 2 weeks** — Phase 1 (Redis + replica + caches + conversations table). Dashboard slowness goes away.
3. **3–5 weeks from now** — Phase 2 (BullMQ + worker tier). 60 MPS sustained on 3 numbers, behind a feature flag for safe rollout.
4. **6–8 weeks** — Phase 3 + 4 (droplet migration, partitioning, workflow path on the queue). Old infra retired.

The send-throughput shortcomings are dominated by **architecture**, not code: one Node process doing everything, one Postgres pool absorbing every webhook and every send, no per-number budget enforcement. The fix is to separate concerns onto cheap standardized droplets, put a real queue + rate limiter (BullMQ + Redis) between submission and Telnyx, and stop using Postgres as both the queue and the analytics warehouse. The data model is mostly right; the runtime is wrong.
