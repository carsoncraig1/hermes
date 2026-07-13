# Daily Cost Sync — Spec Doc (Alternative B)

**Feature:** Deliver SMS click costs to the external platform (Maxcom) via a **daily batch sync**
instead of the real-time per-click pull scoped in `CLICK_COST_ATTRIBUTION_SCOPE.md` (Alternative A).
This doc exists so the two designs can be compared and one chosen. It is a competing design, not
an addition.

**Hard requirement carried over from stakeholder input:** click-level attribution must survive.
"Hermes spent $X yesterday" as a single traffic-source number is explicitly NOT acceptable — spend
must be distributable across Maxcom's own kept clicks so campaign-level cost, copy-variant cost in
split tests, and per-click ROI all remain computable.

---

## 1. Concept

Once a day, spend and click data flow from Hermes to Maxcom in bulk. Maxcom applies its own bot
filtering (as it already does), keeps its own notion of unique real clicks, and joins cost onto
those clicks using `hrms` as the shared key — the same key already used for revenue postbacks.

Two variants, differing in **who does the click-level allocation**:

- **Variant B1 — Hermes reports, Maxcom allocates.** Hermes exposes grouped spend totals +
  a click manifest; Maxcom divides spend across its own kept clicks.
- **Variant B2 — Maxcom submits kept clicks, Hermes allocates.** Maxcom posts the day's kept
  `hrms` list; Hermes computes per-click costs and returns them, click by click.

Both preserve click-level attribution. B1 is less Hermes work and more Maxcom logic; B2 keeps the
allocation math in one place (Hermes) at the cost of a slightly richer integration.

---

## 2. Shared foundation (built in either variant — identical to Alternative A's step 1)

- `Campaign.totalCost Decimal(12,4)` — running campaign spend, fed by the CalNux/Telnyx cost
  postback with the **null→value counting guard** (each message's cost counted exactly once
  despite webhook retries and multi-event delivery; decrement on value→null).
- Nightly reconcile in the existing cron processor: recompute `totalCost = SUM(Message.costAmount)`
  per active campaign, self-healing any counter drift within 24h.
- Backfill script for existing campaigns.
- The **lenient click-time bot gate** from Alternative A §6 is still strongly recommended
  regardless of sync design: it exists to stop scanners from burning one-shot click codes and
  stealing `hrms` from real humans — a revenue-attribution bug that exists today, independent of
  cost. Without it, many of Maxcom's real visitors arrive with no `hrms` and can't be joined to
  anything in either variant.

---

## 3. Variant B1 — report endpoint, Maxcom allocates

### Endpoint

`GET /api/cost-report?date=YYYY-MM-DD&key=<hermes-api-key>` (UTC date bucket; auth mirrors
`/api/revenue`). Also accepts `campaign_id` to scope, and `since=<ISO>` for catch-up after missed
days.

### Response

```json
{
  "date": "2026-07-12",
  "generated_at": "2026-07-13T06:00:02Z",
  "spend": [
    {
      "campaign_id": 42,
      "campaign_name": "July Webinar Push",
      "shortlink_id": 310,
      "shortlink_nickname": "copy-A",
      "messages_costed": 9950,
      "cost": 81.5900,
      "currency": "USD",
      "cumulative_cost": 312.4400
    }
  ],
  "clicks": [
    {
      "hrms": "hrms_xxx",
      "campaign_id": 42,
      "shortlink_id": 310,
      "clicked_at": "2026-07-12T14:02:11Z",
      "bot_verdict": "human"
    }
  ]
}
```

- **`spend` rows are grouped by campaign × shortlink.** Shortlink is the copy-variant dimension:
  split-test copies use distinct shortlinks, so per-variant cost falls out of this grouping.
  Message→shortlink linkage comes via `MessageClickCode` (a message's cost is assigned to the
  shortlink(s) its click codes point at; multi-link messages split cost evenly across their
  links — rare, documented caveat).
- **`clicks` is the hrms manifest** for the date — every hrms-bearing click Hermes recorded,
  with its campaign/shortlink linkage and Hermes's bot verdict (informational; Maxcom's own
  filter remains its truth).
- `cumulative_cost` (campaign-to-date, as of report generation) is included so Maxcom can do
  cumulative recomputation (see §5) without summing historical reports.

### Maxcom-side allocation (their logic, documented here as the contract's intent)

For each campaign (or campaign × shortlink) each day:

```
cpc = cumulative_cost ÷ COUNT(Maxcom's kept clicks to date for that group)
```

and restate the cost on each of its kept clicks to `cpc`. Joining is by `hrms` from the manifest
(or from the landing URL they already capture).

### Hermes build for B1

Report endpoint + the shared foundation. **No per-click attribution state in Hermes at all** —
no `costAttributed`, no frozen deltas, no idempotency machinery. Roughly 1.5–2 days total
including the shared foundation.

---

## 4. Variant B2 — Maxcom submits kept clicks, Hermes allocates

### Endpoint

`POST /api/cost-sync` with `{ "key": "...", "date": "2026-07-12", "kept_hrms": ["hrms_a", "hrms_b", ...] }`
(batched, e.g. ≤5,000 per call — comfortably above real daily click volume).

### Behavior

1. Validate ownership of every hrms (per-user API key, same as `/api/revenue`).
2. Mark submitted clicks as **platform-confirmed** (`ShortlinkClick.platformConfirmedAt`).
3. Per campaign, recompute allocation over **all platform-confirmed clicks to date**:
   `per_click_cost = totalCost ÷ confirmedClicks` and return the full restated set for affected
   campaigns:

```json
{
  "date": "2026-07-12",
  "allocations": [
    { "hrms": "hrms_a", "campaign_id": 42, "shortlink_id": 310,
      "per_click_cost": 0.4120, "restated": false },
    { "hrms": "hrms_prev1", "campaign_id": 42, "shortlink_id": 310,
      "per_click_cost": 0.4120, "restated": true }
  ],
  "campaign_totals": [
    { "campaign_id": 42, "total_cost": 312.4400, "confirmed_clicks": 758,
      "unallocated": 0.0 }
  ]
}
```

- Even-split per confirmed click (not delta-based): with the confirmed set known, even division
  is exact, and every day's sync restates prior clicks so `per_click_cost × confirmed_clicks`
  always equals campaign spend to date. `restated: true` flags rows Maxcom must update in place.
- Idempotent: re-submitting the same hrms set returns the same allocations.

### Hermes build for B2

Shared foundation + confirmation field + allocation logic + endpoint + tests. ~2.5 days —
comparable to Alternative A.

---

## 5. The structural cost of daily sync: restatement

This is the honest trade-off against Alternative A, and the thing the deciding agent must weigh:

**Spend and clicks for one campaign do not land on the same day.** Spend posts within seconds of
sending; clicks trail for 1–3+ days. Any daily-bucketed division ("Monday's spend ÷ Monday's
clicks") systematically overstates CPC on send day and assigns $0 to trailing clicks. Correct
blended CPC therefore requires **cumulative recomputation** — every sync, the per-click cost of
*previously synced clicks changes* and must be restated in Maxcom's records.

- In **B1**, that restatement logic and its correctness burden live entirely in Maxcom.
- In **B2**, Hermes computes it, but Maxcom must still support *updating* cost on clicks it
  already stored (`restated: true` rows).
- In **Alternative A**, restatement never happens: each click's delta is frozen at pull time and
  the *sum* self-corrects instead of individual values. If Maxcom cannot mutate cost on stored
  clicks, Alternative A is the only correct option.

Other deltas vs Alternative A:

| | A — real-time pull | B1 — daily report | B2 — daily submit |
|---|---|---|---|
| Click-level attribution | ✅ frozen delta per click | ✅ via Maxcom division | ✅ via Hermes allocation |
| Per-click values | lumpy deltas (sum-correct) | smooth (restated) | smooth (restated) |
| Requires Maxcom to mutate stored click costs | no | yes | yes |
| Bot disagreement risk | none (pull = confirmation) | none (Maxcom divides over own clicks) | none (Maxcom submits own clicks) |
| Cost data freshness | seconds | up to 24h | up to 24h |
| Split-test / copy-variant cost | via campaign grouping at pull + Maxcom's own dims | ✅ campaign × shortlink grouping built-in | ✅ same |
| Maxcom integration | 1 GET per kept click (real-time) | 1 GET per day + division/restate logic | 1 POST per day + restate handling |
| Hermes effort | ~2.5–3 days | ~1.5–2 days | ~2.5 days |
| Failure mode | pulls stop → spend pools (recoverable, monitored) | a missed day → `since=` catch-up | missed day → next submit self-corrects |

Note on per-click smoothness: A's raw deltas are lumpy by design and must be summed, never read
row-by-row; B1/B2 produce smooth equal per-click costs, which read naturally in per-click reports
but only stay correct because of restatement. If Maxcom reporting reads individual click costs
directly, B's smooth values are genuinely nicer — *if* restatement is supported.

---

## 6. Settlement & finality

- A campaign's spend is effectively final within minutes of its last send (cost postbacks arrive
  in seconds; stragglers within hours). Clicks trail longer.
- Recommend a **7-day restatement window**: after 7 days from a campaign's last click, its
  allocation is frozen and no longer restated. Bounds Maxcom's mutation window.
- Late revenue postbacks are unaffected — revenue and cost pipelines stay independent, joined on
  `hrms` in Maxcom.

## 7. Testing (either variant)

- Vitest units for: counting guard, reconcile, report grouping math (message→shortlink cost
  assignment, multi-link split), B2 allocation + restatement set, idempotent re-submit.
- Fixture-replayed webhook double-fires → spend counted once.
- Cross-check invariant in tests and in a nightly assertion log:
  `SUM(per-click allocations) + unallocated == campaign totalCost`.

## 8. Open questions for the deciding agent

1. **Can Maxcom update cost on already-ingested clicks?** This is the fork: no → Alternative A.
   Yes → B1/B2 viable and their smooth per-click values are arguably better for reporting.
2. Is 24h cost latency acceptable for how spend/ROI decisions are made intraday?
3. B1 vs B2: does Maxcom prefer to own allocation math (B1) or ship its kept-click list and
   receive finished numbers (B2)?
4. Split tests: confirm copy variants always map to distinct shortlinks (the grouping dimension
   this spec relies on). If variants share a shortlink, Hermes needs a message-text/variant
   dimension instead — small addition, but changes the report schema.
5. Timezone for the daily bucket (spec assumes UTC).
