# Phase 0 — Quick Wins Spec

**Goal:** Raise sustained throughput from ~5–10 MPS to ~15–30 MPS without changing the architecture. Five surgical edits to existing files. Zero new services. Reversible.

**Time:** ~6–10 hours of dev work + 1 hour of verification + 1 week of metric watching.

**Touched files (only these):**

```
.env                                     # DATABASE_URL params
prisma/schema.prisma                     # add directUrl
src/lib/telnyx.js                        # idempotency key on bulk send
src/lib/actions/campaigns.js             # raw VALUES UPDATE; drop telnyxMetadata on success
src/app/api/message/status/route.js      # idempotent webhook update; keep telnyxMetadata only on failure
src/lib/sendJob.js                       # recover immediate jobs too
```

Everything else stays untouched. No new dependencies.

---

## Work item 1 — Bump the Postgres pool (15 min)

**Why first:** Lowest risk. Buys headroom for everything else. No code change.

### Change

In **`.env`** and in the **DO App Platform env var panel**, update `DATABASE_URL`:

```diff
- ?sslmode=require&connection_limit=20&pool_timeout=20
+ ?sslmode=require&connection_limit=80&pool_timeout=30&pgbouncer=true&connect_timeout=15
```

Add a second env var for migrations only:

```
DIRECT_DATABASE_URL=postgresql://db:****@<HOST>:25060/hermes-executor?sslmode=require
```

(Same host/creds, port `25060` instead of `25061`, no pool params — direct mode for migrations only.)

### Update `prisma/schema.prisma`

```diff
 datasource db {
   provider = "postgresql"
   url      = env("DATABASE_URL")
+  directUrl = env("DIRECT_DATABASE_URL")
 }
```

### Why this works

- Port `25061` is the DO transaction-mode pooler. `connection_limit` is the size of Prisma's client-side pool to the pooler, not to Postgres. The pooler multiplexes 80 client connections across ~47 backend connections per the new DB tier.
- `pgbouncer=true` disables Prisma's prepared-statement caching, which PgBouncer transaction mode does not support. Without this you'll occasionally see `prepared statement "s1" does not exist` under load. Even if you haven't hit it yet, the next bump in concurrency will surface it.
- `directUrl` lets `prisma migrate` bypass the pooler and use session-mode (port 25060), which migrations require.

### Verification

1. Redeploy. Tail logs for `P2024` (`Timed out fetching a new connection`) — should be absent.
2. Run `prisma migrate status` to confirm `directUrl` works.
3. During a 500-contact test send, check DO Database Insights → Connections. "Connections to pooler" should climb to 40–80; "Connections to database" should stay <40.

### Rollback

Revert `DATABASE_URL` to old params. No schema change is destructive (`directUrl` is additive).

---

## Work item 2 — Stop double-writing `telnyxMetadata` (30 min)

**Why second:** Pure waste. Every successful send writes ~1–3 KB of JSON to the `messages` row, and the webhook handler overwrites it a few seconds later. Removing the first write is a free reduction in row-size churn and TOAST writes.

### Change A — `src/lib/actions/campaigns.js`

In the bulk update loop inside `executeDedicatedSend`, around **line 1424–1438**, drop `telnyxMetadata` from the success-path update payload:

```diff
 messageUpdates.push(
   prisma.message.update({
     where: { id: messageId },
     data: {
       telnyxMessageId: sendResult.telnyxMessageId,
       status,
       costAmount: (status === 'sent' || status === 'delivered' || status === 'delivery_unconfirmed') && sendResult.costAmount
         ? parseFloat(sendResult.costAmount)
         : null,
       costCurrency: sendResult.costCurrency || 'USD',
       sentAt: (status === 'sent' || status === 'sending') ? now : null,
       text: textForContact,
-      telnyxMetadata: sendResult.rawData ? JSON.parse(JSON.stringify(sendResult.rawData)) : null,
     }
   })
 )
```

Keep `telnyxMetadata` on the **failure** branch (line ~1445–1454) for debugging. Failures are rare; the JSON is genuinely useful there.

### Change B — `src/app/api/message/status/route.js`

Same idea on the webhook side. Around **line 122–129**, write `telnyxMetadata` only on failure terminal states:

```diff
 const updateData = {
   status,
   ...(status === 'sent' || status === 'delivered' || status === 'delivery_unconfirmed' ? { costAmount, costCurrency } : { costAmount: null, costCurrency }),
-  telnyxMetadata: payload
+  ...((status === 'sending_failed' || status === 'delivery_failed') ? { telnyxMetadata: payload } : {})
 };
```

### Why this works

- Successful sends rarely need the full Telnyx payload — `telnyxMessageId`, `status`, `costAmount` are sufficient.
- TOAST-stored JSON columns are expensive to write *and* expensive to scan when accidentally pulled by `SELECT *`. Eliminating the write removes a hidden cost on both sides.

### Verification

1. Send 50 test messages. Confirm row size: `SELECT pg_size_pretty(pg_total_relation_size('messages'));` should grow more slowly per message.
2. Force a delivery failure (use an invalid number) and confirm `telnyxMetadata` is populated on the failed row.

### Rollback

Add the lines back. No data is lost — existing rows keep whatever metadata they had.

---

## Work item 3 — Telnyx idempotency keys (45 min)

**Why now:** Phase 0 reshapes the bulk send path. Before any retries can possibly produce duplicates, get idempotency in place. Costs nothing performance-wise; saves you from a billing/reputation disaster if a retry ever double-sends.

### Change — `src/lib/telnyx.js`

In `sendMessageBulkOptimized` (line 17), accept an `idempotencyKey` parameter and pass it as the SDK's second-arg request option:

```diff
 export async function sendMessageBulkOptimized({
   telnyxClient,
   from,
   to,
   text,
   messagingProfileId,
+  idempotencyKey,
 }) {
-  const response = await telnyxClient.messages.create({
-    from,
-    to: [to],
-    text,
-    type: 'SMS',
-    messaging_profile_id: messagingProfileId,
-    webhook_url: 'https://txt.cx/api/message/status',
-    webhook_failover_url: '',
-  });
+  const response = await telnyxClient.messages.create(
+    {
+      from,
+      to: [to],
+      text,
+      type: 'SMS',
+      messaging_profile_id: messagingProfileId,
+      webhook_url: 'https://txt.cx/api/message/status',
+      webhook_failover_url: '',
+    },
+    idempotencyKey ? { idempotencyKey } : undefined
+  );
```

### Change — `src/lib/actions/campaigns.js`

In `executeDedicatedSend`'s Phase 3 (line 1388–1405), pass each message's pre-generated `messageId` as the idempotency key. The `messageId` is already a UUID generated at line 1365, so it's perfect — globally unique, deterministic per intent, and the worker already has it in scope.

```diff
 const telnyxResults = await Promise.allSettled(
   groupContacts.map(contact =>
     retryWithBackoff(
       () => sendMessageBulkOptimized({
         telnyxClient: groupConfig.telnyxClient,
         from: groupConfig.phoneNumber,
         to: normalizePhoneForTelnyx(contact.phone),
         text: contactTextMap.get(contact.id) || messageText,
         messagingProfileId: groupConfig.messagingProfileId,
+        idempotencyKey: contactToMessageId.get(contact.id),
       }),
       {
         maxRetries: 3,
         initialDelay: 1000,
         shouldRetry: isRetryableError
       }
     )
   )
 )
```

### Why this works

- The Telnyx Node SDK (v2.x, your version) accepts a second-arg options object that maps `idempotencyKey` to the `Idempotency-Key` HTTP header. Telnyx caches the response for 24 hours per key. A retry with the same key returns the original response without sending again.
- `messageId` (a UUID) is already unique per intent and stable across retries within the same job invocation — exactly what an idempotency key wants.

### Verification

1. Send 1 test message via your dashboard. Note the `telnyxMessageId` in DB.
2. Use the Telnyx dashboard to inspect the request — confirm `Idempotency-Key` header is present in request logs.
3. Force a retry path by temporarily setting `retryWithBackoff({ maxRetries: 1 })` and throwing inside `sendMessageBulkOptimized` after the API call. Confirm the second call returns the same `telnyxMessageId` from cache rather than creating a new message.

### Risk note

The SDK option name varies by version. If `idempotencyKey` doesn't work in your Telnyx SDK v2.x, the fallback is:

```js
{ headers: { 'Idempotency-Key': idempotencyKey } }
```

Run the verification step before shipping to confirm which form the SDK accepts. If neither works, drop to raw `fetch()` in `sendMessageBulkOptimized` — that's 20 lines and removes the SDK dependency on the hot path entirely (a Phase 2 win anyway).

### Rollback

Remove the `idempotencyKey` param. Behavior reverts to identical to today.

---

## Work item 4 — Replace per-group `$transaction` with a single raw VALUES UPDATE (2–4 hours)

**Why this is the perf win:** Today, after each group's Telnyx fan-out, you do `prisma.$transaction([...N message.update(), 1 contact.updateMany()])`. Prisma issues those N UPDATEs sequentially inside one open transaction, holding a pool connection for ~50–100ms per group. With 5 concurrent groups that's 5 connections held for 50–100ms each on every batch. Replacing it with one raw `UPDATE ... FROM (VALUES ...)` collapses N round trips to 1 and releases the connection ~10× faster.

### Change — `src/lib/actions/campaigns.js`

Replace **lines 1407–1469** with the following block. The structural change: collect `success` and `failure` rows into two flat arrays of `{messageId, ...fields}`, then issue one raw UPDATE per non-empty array, then one `contact.updateMany`. No more `$transaction`.

```js
// Phase 4: bulk update messages + contacts via raw VALUES (no interactive txn).
const now = new Date()
const successRows = []
const failureRows = []
const successfulContactIds = []
let groupSuccessCount = 0
let groupFailCount = 0

telnyxResults.forEach((result, index) => {
  const contact = groupContacts[index]
  const messageId = contactToMessageId.get(contact.id)
  const textForContact = contactTextMap.get(contact.id) || messageText

  if (result.status === 'fulfilled' && result.value.success) {
    groupSuccessCount++
    successfulContactIds.push(contact.id)
    const sendResult = result.value
    const status = sendResult.initialStatus || 'queued'
    const billed = status === 'sent' || status === 'delivered' || status === 'delivery_unconfirmed'
    successRows.push({
      id: messageId,
      telnyxMessageId: sendResult.telnyxMessageId || null,
      status,
      costAmount: billed && sendResult.costAmount ? parseFloat(sendResult.costAmount) : null,
      costCurrency: sendResult.costCurrency || 'USD',
      sentAt: (status === 'sent' || status === 'sending') ? now : null,
      text: textForContact,
    })
  } else {
    groupFailCount++
    const errorMessage = result.status === 'rejected'
      ? (result.reason?.message || 'Unknown send error')
      : 'Send failed'
    failureRows.push({
      id: messageId,
      status: 'sending_failed',
      failedAt: now,
      errorMessage,
    })
  }
})

// One bulk UPDATE per outcome class.
if (successRows.length > 0) {
  // Build $1, $2, ... placeholders. Prisma's $executeRaw with Prisma.sql allows safe parameterization.
  const values = successRows.map((r, i) => {
    const o = i * 7
    return `($${o + 1}::text, $${o + 2}::text, $${o + 3}::text, $${o + 4}::numeric, $${o + 5}::text, $${o + 6}::timestamp, $${o + 7}::text)`
  }).join(', ')
  const params = successRows.flatMap(r => [
    r.id,
    r.telnyxMessageId,
    r.status,
    r.costAmount,
    r.costCurrency,
    r.sentAt,
    r.text,
  ])
  await prisma.$executeRawUnsafe(
    `UPDATE messages AS m SET
       "telnyxMessageId" = v.tid,
       status            = v.status,
       "costAmount"      = v.cost,
       "costCurrency"    = v.currency,
       "sentAt"          = v.sent_at,
       text              = v.text,
       "updatedAt"       = NOW()
     FROM (VALUES ${values}) AS v(id, tid, status, cost, currency, sent_at, text)
     WHERE m.id = v.id`,
    ...params
  )
}

if (failureRows.length > 0) {
  const values = failureRows.map((r, i) => {
    const o = i * 4
    return `($${o + 1}::text, $${o + 2}::text, $${o + 3}::timestamp, $${o + 4}::text)`
  }).join(', ')
  const params = failureRows.flatMap(r => [r.id, r.status, r.failedAt, r.errorMessage])
  await prisma.$executeRawUnsafe(
    `UPDATE messages AS m SET
       status         = v.status,
       "failedAt"     = v.failed_at,
       "errorMessage" = v.err,
       "updatedAt"    = NOW()
     FROM (VALUES ${values}) AS v(id, status, failed_at, err)
     WHERE m.id = v.id`,
    ...params
  )
}

if (successfulContactIds.length > 0) {
  await prisma.contact.updateMany({
    where: { id: { in: successfulContactIds } },
    data: { lastMessageSent: now }
  })
}

const perNumberMinBatchTime = Math.ceil((groupContacts.length / (groupConfig.rateLimit || 1200)) * 60000)
return {
  successCount: groupSuccessCount,
  failCount: groupFailCount,
  groupSize: groupContacts.length,
  minBatchTime: perNumberMinBatchTime
}
```

### Why this works

- Two `UPDATE ... FROM (VALUES ...)` statements is **2 round trips per group instead of N+1**. Connection hold time drops from O(N) to O(1).
- No `$transaction` means no held interactive connection. The pool turns over faster.
- `$executeRawUnsafe` is fine here because every interpolated value is a parameterized placeholder (`$1, $2, …`) — no actual interpolation of user input. The literal strings being concatenated are only the placeholder positions.

### Risks

- **Schema column names.** Postgres column names are case-sensitive when quoted. Confirm `"telnyxMessageId"`, `"costAmount"`, etc. match the actual column names in the `messages` table. (They do per `prisma/schema.prisma` lines 318–365, but verify with `psql \d messages` after deploy.)
- **`NULL` handling in VALUES.** Postgres needs explicit type casts on the first row of a VALUES clause when columns can be NULL. The `::numeric`, `::text`, `::timestamp` casts above handle this.
- **`updatedAt`.** Prisma normally auto-bumps this on `update`. Since we're going around Prisma, the raw SQL sets it explicitly with `NOW()`.

### Verification

1. **Unit-test parity.** Run an existing campaign send with `BATCH_SIZE=5` (temporarily lower it) and compare row state in the messages table before and after across both code paths. Status, telnyxMessageId, costAmount, sentAt, text should match.
2. **Failure path.** Force a Telnyx error (invalid `from` number) and confirm the failure rows get `status='sending_failed'`, `failedAt`, and `errorMessage` populated correctly.
3. **Concurrency.** Run a 1000-contact send and watch `pg_stat_activity` during the burst — connections in `active` state should peak lower and drop faster than today.
4. **Cost.** Diff the `costAmount` column for a sample of sent messages against the Telnyx dashboard. Decimal precision is the easiest thing to break in raw SQL.

### Rollback

Revert to the `$transaction([...messageUpdates])` block. The schema doesn't change, so revert is a code-only revert.

---

## Work item 5 — Fix immediate-job recovery (30 min)

**Why:** Today, if the dyno restarts mid-send on an immediate job, the `SendJob` row stays stuck in `processing` forever. `recoverStaleSendJobs` filters with `scheduledAt: { not: null }`, which excludes immediate jobs. They never get a second chance.

### Change — `src/lib/sendJob.js`

Around **line 182–203**, broaden the recovery filter to include immediate jobs *and* give immediate jobs a longer stale window (since they tend to be larger, single-shot blasts):

```diff
 export async function recoverStaleSendJobs(staleMs = STALE_JOB_TIMEOUT_MS) {
   const staleBefore = new Date(Date.now() - staleMs)
   const result = await prisma.sendJob.updateMany({
     where: {
       status: 'processing',
-      scheduledAt: { not: null }, // only scheduler-managed jobs
       startedAt: { not: null, lte: staleBefore },
       completedAt: null
     },
     data: {
       status: 'pending',
       startedAt: null,
       errorMessage: `Recovered stale processing job at ${new Date().toISOString()}`
     }
   })

   if (result.count > 0) {
     console.warn(`Recovered ${result.count} stale send jobs`)
   }

   return result.count
 }
```

But wait — that on its own creates a problem: immediate jobs reset to `pending` with `scheduledAt: null` won't be picked up by `getPendingJobs` (which requires `scheduledAt: { not: null }` per lines 159–167). Either also broaden `getPendingJobs`, **or** (preferred) set `scheduledAt` to `now()` on recovery so the cron picks them up:

```diff
     data: {
       status: 'pending',
       startedAt: null,
+      scheduledAt: new Date(),
       errorMessage: `Recovered stale processing job at ${new Date().toISOString()}`
     }
```

Setting `scheduledAt` to now means the next cron tick of `/api/jobs/process` will see the job (since `scheduledAt <= now`) and execute it. Failed immediate jobs become effectively re-runnable as scheduled jobs.

### Why this works

- Idempotency from Work Item 3 means re-running a partially-completed job won't double-send any message that already went out — the Telnyx idempotency key on each `messageId` deduplicates.
- The `sentContactIds` `Set` is in-memory, so a recovery run starts with an empty set. The DB-level safety is the Telnyx idempotency cache (24h) plus, ideally, a future unique index on `(campaignId, contactId, direction='outbound')` (deferred to Phase 1).

### Verification

1. Kick off an immediate send of ~50 contacts. While it's running, `kill -9` the Node process (or trigger a DO redeploy).
2. Confirm the `SendJob` row shows `status='processing'`. Wait 15 minutes.
3. Hit `/api/jobs/process?secret=…` manually. Confirm the job moves to `pending → processing → completed` and no duplicates appear in the `messages` table (idempotency key protects you).

### Rollback

Restore the original `recoverStaleSendJobs`. The `scheduledAt: new Date()` write is harmless on already-recovered rows.

---

## Rollout sequence (suggested order)

These edits are independent but vary in risk. Ship in this order so you can validate each before stacking the next:

1. **Item 1 (Pool bump)** — Friday afternoon. Redeploy. Watch for `P2024` errors over the weekend. Zero code change rolls back fast.
2. **Item 5 (Immediate-job recovery)** — Monday. Operational safety net before increasing send aggressiveness.
3. **Item 3 (Idempotency keys)** — Tuesday. Validate via a test send + Telnyx dashboard inspection of headers. Idempotency must be live before Item 4 ships.
4. **Item 2 (Drop telnyxMetadata on success)** — Wednesday. Two two-line edits. Reversible.
5. **Item 4 (Raw VALUES UPDATE)** — Thursday morning, behind a feature flag. Add `USE_RAW_BULK_UPDATE=true` env var and an `if (process.env.USE_RAW_BULK_UPDATE === 'true') { …new code… } else { …old $transaction… }` guard. Ship with the flag off. Flip it on for a 50-contact test send, then 500-contact, then 5,000. Watch metrics.

Total elapsed: ~1 week with verification gates.

---

## Test plan

For each significant change, the same gate:

1. **Smoke test** — single message via the manual-fire UI. Goes out, status updates, webhook flows through.
2. **Small batch** — 50-contact campaign. All messages send, costAmount/sentAt/text on every row matches expectation, no `P2024` in logs.
3. **Medium batch** — 500-contact campaign. Sustained for ~30s. Tail logs for errors. Spot-check 10 random rows in DB against Telnyx dashboard.
4. **Production blast** — Only after items 1–4 are green twice. Watch the live DB connection chart.

After all 5 items ship, run a deliberate **3,000-contact send across 3 phone numbers** and measure end-to-end MPS using:

```sql
SELECT date_trunc('second', "sentAt") AS s, count(*)
FROM messages
WHERE "userId" = '<your-user-id>' AND direction = 'outbound' AND "sentAt" > NOW() - INTERVAL '10 minutes'
GROUP BY 1
ORDER BY 1;
```

You should see peak rows-per-second in the 15–30 range, with no `P2024` errors. If yes → Phase 0 complete, gate open for Phase 1. If no → see "Failure to launch" below.

---

## Metrics to watch (1 week post-rollout)

- **`P2024` errors per day.** Target: 0. Tolerable: <5/day during sends.
- **Avg DB connections during send.** Target: peaks under 60% of pool. Watch in DO Insights.
- **Webhook end-to-end latency.** Target: p95 < 200ms (request received → DB written). Add timing logs if needed.
- **Job stuck-in-processing count.** Run `SELECT count(*) FROM send_jobs WHERE status='processing' AND "startedAt" < NOW() - INTERVAL '15 minutes';` daily for a week. Target: 0.
- **Duplicate-send incidents.** Diff `(campaignId, contactId)` counts for outbound messages on a recent campaign. Target: 0 dupes.

---

## Failure to launch — debug ladder

If after all 5 items you still can't hit 15 MPS sustained, the next bottleneck is usually one of:

1. **DO App Platform CPU.** Tail container metrics during the send. If CPU is pegged, you need to scale the instance size, not the DB. (This is the real signal to begin Phase 2.)
2. **Telnyx soft throttling.** If you see `40010` / `40011` errors, you're hitting carrier throttles. Lower `PhoneNumber.rateLimit` to 18 and ramp.
3. **Webhook backpressure.** If incoming webhooks are timing out, the receiver is starving. Phase 1 (Redis stream offload) is the right fix, but a stopgap is to set the message-update writes in the webhook handler to fire-and-forget like the contact updates.

---

## Out of scope for Phase 0 (do not do here)

- Conversation table / message rollups — Phase 1
- Redis queue / BullMQ — Phase 2
- Postgres partitioning — Phase 4
- Read replica / dashboard caching — Phase 1
- Removing `executeManualFire` legacy path — Phase 2

If any of these creep in, they expand the blast radius and slow down ship time. Phase 0 stays tight.

---

## Definition of done

Phase 0 is complete when **all five** are true for one full week:

- [ ] `connection_limit=80&pgbouncer=true` live in production env
- [ ] `directUrl` configured and `prisma migrate status` runs clean
- [ ] A 3,000-contact send sustains ≥15 MPS aggregate with 0 `P2024` errors
- [ ] Telnyx request inspector shows `Idempotency-Key` headers on every send
- [ ] No `send_jobs` row stuck in `processing` for >15 minutes after a redeploy

When that's all true, Phase 1 (Redis + replica + caches + Conversation table) is the next move.
