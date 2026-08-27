-- Covering index for the Messages-page stats query (getMessageStats):
-- groupBy(status) + SUM(costAmount) over a user's ENTIRE outbound history.
-- Without it the cost sum heap-fetches every delivered row ever (millions for
-- high-volume accounts). With INCLUDE ("costAmount") the whole query is one
-- index-only scan.
--
-- APPLY MANUALLY (repo convention). CONCURRENTLY avoids locking the table
-- during the build but cannot run inside a transaction — run it as a single
-- standalone statement. Safe to re-run. Expect a few minutes on a large table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "messages_userId_direction_status_cost_idx"
  ON "messages"("userId", "direction", "status") INCLUDE ("costAmount");
