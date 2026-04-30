-- Indexes to fix Prisma connection pool exhaustion on Telnyx webhook bursts.
-- Without these, /api/message/status does sequential scans on `users` and
-- `phone_numbers` for every webhook event.
--
-- Use CONCURRENTLY so this can be applied against the live DB without locking
-- writes. Run each statement individually (psql), not inside a transaction.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_telnyxMessagingProfileId_idx"
  ON "users"("telnyxMessagingProfileId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "phone_numbers_messagingProfileId_idx"
  ON "phone_numbers"("messagingProfileId");
