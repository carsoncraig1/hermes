# Click Cost Attribution — Scope Doc

**Feature:** Deliver blended campaign cost-per-click to the external platform via a pull-based
attribution endpoint, keyed by `hrms`, with the platform's bot filter as the single source of
truth for which clicks are real.

**Status:** Scoped — pending platform-side agreement on the integration contract (§8).

---

## 1. Problem

The external platform needs the SMS cost associated with each click. Requirements and constraints
discovered during scoping:

- The number they need is **blended CPC** (campaign spend ÷ real clicks), not per-message cost.
- Blended CPC is a moving target: spend keeps accruing while the campaign sends, and clicks trail
  for hours or days. It cannot be computed correctly at click time.
- Click data is heavily bot-polluted (observed: 18,620 recorded clicks vs ~252 real). The platform
  already runs its own bot filter page as the first redirect destination; that filter is the most
  accurate classifier in the pipeline and is **not changing**.
- A cost value attached to the redirect URL is write-once. If a URL-attached cost lands on a click
  the platform's filter later discards, that spend silently vanishes from their totals. At a 74:1
  bot ratio, URL-attached cost is not viable.

## 2. Design summary — attribution on pull

Cost is **not** attached to the redirect URL at all. Instead:

1. Hermes maintains a running spend counter per campaign (`Campaign.totalCost`), fed by the
   existing CalNux/Telnyx cost postback.
2. Clicks redirect to the platform's bot filter page carrying `hrms` (and `phone_hash`), as today.
3. When the platform's filter passes a visitor as human, the platform's backend calls
   `GET /api/click-cost?hrms=...&key=...`.
4. Hermes computes the **incremental spend delta** at that moment —
   `delta = totalCost − costAttributed` — freezes it onto that click, advances the campaign's
   attributed counters, and returns it.

Recipient-specific real-click redirects automatically add `phone` and `phone_hash`
when the recipient has a normalizable number; destination URL tokens are not required.
Storage uses international E.164 (`+` plus country code and national digits), not
US-only `+1`. The URL's unhashed `phone` is the canonical stored number without `+`;
`phone_hash` is unsalted SHA-256 of those exact digits, encoded as lowercase hex.
For example, `+442079460958` sends `phone=442079460958` and hashes `442079460958`.
Bare 10-digit NANP input retains the default country code `1`. Missing or invalid
numbers contribute neither identity parameter. Bot previews and generic legacy
shortlinks do not receive recipient identity parameters.
See [Phone normalization](PHONE_NORMALIZATION.md) for validation, all intake paths,
and non-destructive historical-data backfill instructions.

### Why delta semantics

Each pulled click receives the spend accrued since the previous pulled click. Therefore, on the
platform's side, `SUM(cost_delta)` across a campaign's clicks always equals campaign spend as of
the latest pull, and `SUM(cost_delta) ÷ COUNT(clicks)` is exactly the true blended CPC — computed
over **only the clicks their filter passed**, continuously self-adjusting as the campaign runs.

Properties that fall out of this design for free:

- **Bot-proof:** a delta can never land on a click the platform discards, because the platform
  only pulls for clicks it kept. Disagreement between filters is structurally impossible.
- **Loss-proof:** clicks that are never pulled (bots, drop-offs) leave their spend in the pool;
  the next pulled click sweeps it. No spend is ever lost or double-counted.
- **Order-independent:** pulls may arrive in any order relative to clicks; the math doesn't care.
- **Late-spend-tolerant:** spend that lands after a pull is simply swept by the next pull.

Known accepted imperfection: spend accruing after the **final** pull of a campaign is never
attributed (slight undercount). Costs post within seconds of send while clicks trail for
hours/days, so late pulls sweep nearly everything; the residue is small and always an
*under*count, never a misattribution.

## 3. Data model changes (`prisma/schema.prisma` + migration SQL)

Following the repo convention of plain SQL files in `prisma/migrations/`
(`add_click_cost_attribution.sql`).

**`Campaign`** (new fields):

| Field | Type | Purpose |
|---|---|---|
| `totalCost` | `Decimal(12,4) @default(0)` | Running campaign SMS spend, webhook-fed |
| `costAttributed` | `Decimal(12,4) @default(0)` | Spend already handed out via pulls |
| `attributedClicks` | `Int @default(0)` | Count of pulled (attributed) clicks |
| `costReconciledAt` | `DateTime?` | Last drift-reconcile timestamp |

Invariant: `0 ≤ costAttributed ≤ totalCost` at all times (enforced by transaction logic;
repaired by reconcile if violated by drift).

**`ShortlinkClick`** (new fields):

| Field | Type | Purpose |
|---|---|---|
| `attributedCost` | `Decimal(12,4)?` | Frozen delta returned to the platform (null = not yet pulled) |
| `costAttributedAt` | `DateTime?` | When the pull happened |
| `botVerdict` | `String?` | `human` / `bot` / `uncertain` — click-time server-side verdict |
| `botSignals` | `Json?` | Raw signals for auditing/tuning (UA class, secondsFromSend, etc.) |

## 4. Spend counter — webhook changes (`src/app/api/message/status/route.js`, `src/lib/actions/messages.js`)

`Campaign.totalCost` must count each message's cost **exactly once**, despite webhook retries
(`meta.attempt`) and multi-event delivery (`sent` → `finalized`, both may carry cost).

- Increment `totalCost` only when `Message.costAmount` transitions **null → value**, inside the
  same transaction as the message update (`updateMessageRecord` and the recipient-fallback path
  both go through this guard).
- When an already-counted cost is nulled (message later reports `delivery_failed`), decrement by
  the previously stored amount in the same transaction.
- Messages without `campaignId` (conversational sends) are ignored — they're not campaign spend.

### Nightly reconcile (insurance)

New function wired into the existing cron processor (`/api/jobs/process`):
for campaigns active in the last 7 days where `costReconciledAt` is null or > 24h old, recompute

```
totalCost      = SUM(Message.costAmount)        WHERE campaignId = X
costAttributed = SUM(ShortlinkClick.attributedCost) via campaign's shortlinks
attributedClicks = COUNT(same)
```

and overwrite the counters. Any counting bug self-heals within 24h instead of compounding.
Batch-limited per run; stamps `costReconciledAt`.

## 5. The pull endpoint — `GET /api/click-cost` (new: `src/app/api/click-cost/route.js`)

Mirrors `/api/revenue` in auth and shape (API key → user lookup, hrms → click lookup,
ownership check).

**Request:** `GET /api/click-cost?hrms=<hrms>&key=<hermes-api-key>`

**Attribution transaction (first pull for an hrms):**

1. Look up `ShortlinkClick` by `hrms` (unique), join shortlink → campaign. Verify
   `shortlink.userId` matches the API key's user (403 otherwise).
2. Guarded sweep — atomic claim via conditional update
   (`updateMany WHERE id = ? AND attributedCost IS NULL`); zero rows affected means another
   request won the race → fall through to the idempotent read path.
3. Inside one transaction: read campaign counters, compute
   `delta = totalCost − costAttributed` (clamped ≥ 0), write `attributedCost = delta` +
   `costAttributedAt` on the click, increment `costAttributed` by `delta` and
   `attributedClicks` by 1.
4. `serverLog` the attribution (same pattern as revenue events).

**Idempotency (critical):** repeat pulls for the same `hrms` return the **frozen** stored
`attributedCost`, never a fresh delta. Platform retries, replays, and double-fires are safe by
construction.

**Response `200`:**

```json
{
  "success": true,
  "hrms": "hrms_xxx",
  "cost_delta": 0.4120,
  "currency": "USD",
  "already_attributed": false,
  "attributed_at": "2026-07-08T14:02:11Z",
  "campaign": { "id": 42 },
  "blended_cpc": 0.3981,
  "campaign_total_cost": 100.3200,
  "campaign_attributed_clicks": 252
}
```

`cost_delta` is the attribution-grade value (sum these). `blended_cpc`
(`totalCost ÷ attributedClicks`, post-increment) is an informational snapshot for display —
documented as such so nobody sums it.

**Errors:** `401` missing/invalid key · `400` missing hrms · `404` unknown hrms ·
`403` hrms not owned by key's user · `200` with `cost_delta: null, reason: "no_campaign"` when
the click's shortlink has no campaign (nothing to attribute against).

## 6. Click-time bot gate — lenient, hrms-protecting (`src/app/[slug]/route.js`)

The pull design removes any need for Hermes-side filtering for **cost** accuracy. But a lenient
server-side gate is still required for the **hrms pipeline**: click codes are one-shot, and today
a bot scanning the link burns the code and takes the hrms — the real human then arrives on the
"repeat" path with no hrms, making them invisible to the platform (no revenue postback, no cost
pull possible).

- **Signals (server-side only, no interstitial, no added latency):**
  - *Time-from-send* — primary signal. Seconds between `Message.sentAt` and the click; carrier
    and security scanners hit within seconds, humans take minutes. Threshold constant
    (initial: < 10s → bot-leaning), tunable.
  - Expanded UA blocklist (current list only catches social preview bots).
  - Header sanity (e.g. missing `Accept-Language`).
- **Verdict `bot`:** bare redirect to the destination (platform filter page absorbs it as
  today) — **no code burn, no ShortlinkClick, no hrms, no click count.** Never an error page
  (carrier scanners receiving errors risks deliverability).
- **Verdict `human`/`uncertain`:** normal first-click path — burn code, create click + hrms,
  redirect decorated with `hrms` + `phone_hash`.
- Every created click stores `botVerdict` + `botSignals` for post-rollout tuning against the
  platform's ground truth.
- Bias: **lenient.** A false "bot" verdict here costs a real human their hrms (lost revenue +
  cost attribution), while a false "human" verdict costs nothing — the platform's filter
  discards them and they're simply never pulled. Only clear bots get gated.

## 7. Backfill & rollout

**Backfill script** (`scripts/backfill-campaign-costs.mjs`, one-off):

- `totalCost = SUM(Message.costAmount)` per campaign.
- `costAttributed = totalCost` — **the pool starts empty.** Historical spend is never
  attributed; only post-deploy spend flows to the platform. (Alternative — dumping all
  historical spend onto the first pulled click — is explicitly rejected.)
- `attributedClicks = 0`.

**Rollout order** (each step independently shippable, no behavior change until step 3):

1. Schema + webhook counting guard + reconcile job + backfill. Validate for a day:
   `totalCost` tracks `SUM(costAmount)` per campaign.
2. `/api/click-cost` endpoint live. Platform integrates against a test campaign; validate
   `SUM(cost_delta)` ≈ campaign spend and idempotent retries.
3. Bot gate on. Expect recorded click counts to drop toward reality — communicate this before
   it happens so the drop isn't mistaken for breakage.
4. 48h validation per campaign: `totalCost − costAttributed` (the unattributed pool) should be
   small and shrinking whenever pulls are flowing. A pool that grows unbounded while clicks
   exist = platform stopped pulling → alert via serverLog/console.

## 8. Platform integration contract (needs their sign-off)

- **When to call:** once per visitor their filter passes, using the `hrms` from the landing URL.
- **Endpoint:** `GET https://txt.cx/api/click-cost?hrms=...&key=<their-hermes-api-key>` —
  same auth scheme as the revenue postback they already send.
- **Semantics:** first call freezes and returns the click's cost; retries safe (same value,
  `already_attributed: true`). Sum `cost_delta` per campaign for total spend; per-click values
  are lumpy by design (first click after a quiet period sweeps accrued spend) — display
  `blended_cpc` to humans, never raw deltas.
- **Their retry policy:** recommend 3 retries with backoff on 5xx/timeout; treat `404` as
  "no cost available" (e.g. legacy link), not an error.
- **Open questions for them:** staging endpoint/key for integration testing; expected call
  volume (trivial at ~hundreds of real clicks/day); whether they want `phone_hash` echoed in
  the response for join convenience.

## 9. Testing

- **Unit (vitest, following existing `src/lib/*.test.js` convention):**
  - Delta computation + clamping, idempotent re-pull, no-campaign path (extracted into
    `src/lib/clickCostAttribution.js` so logic is testable apart from the route).
  - Webhook null→value / value→null counting guard.
  - Bot scoring pure functions (time-from-send thresholds, UA classes).
  - Reconcile recomputation.
- **Race check:** concurrent pulls for one hrms → exactly one attribution (conditional-update
  guard), second caller gets frozen value.
- **Manual:** replayed webhook fixtures (duplicate `finalized` events) → `totalCost` counted
  once.

## 10. Effort & risk

| Piece | Effort |
|---|---|
| Schema + migration + backfill | 0.5 day |
| Webhook counting guard + reconcile job | 0.5 day |
| `/api/click-cost` endpoint + attribution lib + tests | 1 day |
| Click-time bot gate + signal logging | 0.5–1 day |
| **Total (Hermes side)** | **~2.5–3 days** |

Platform-side coordination (contract sign-off, their one API call, joint staging test) is the
schedule long pole and can proceed in parallel after step 2.

**Top risks:** (1) platform never integrates the pull → pool accumulates, nobody gets cost data;
mitigated by pool monitoring and the fact that nothing else regresses. (2) Webhook double-count →
self-heals ≤ 24h via reconcile. (3) Bot gate false positives → lenient bias + signal logging +
tune against platform ground truth.
