-- Durable per-day cache for /api/cost-report (rev 8).
-- A settled UTC day's cost slice is immutable: compute once, persist forever.
-- Replaces the per-container in-memory report cache, which was lost on every
-- deploy/restart and forced 100-230s recomputes of heavy historical days
-- (the recurring statement-timeout errors on the early-July backfill windows).
CREATE TABLE IF NOT EXISTS "cost_report_days" (
  "id" SERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "day" VARCHAR(10) NOT NULL,
  "body" JSONB NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "cost_report_days_userId_day_key"
  ON "cost_report_days"("userId", "day");
