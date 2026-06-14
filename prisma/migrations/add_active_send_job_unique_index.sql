-- Migration: enforce at most ONE actively-sending job per campaign.
-- Run this SQL directly on your database.
--
-- Background: the campaign_execution_locks table was dropped
-- (remove_campaign_locks.sql), leaving nothing to stop a campaign from being
-- sent twice. On 2026-06-14 a dedicated send was fired again while the first was
-- still running, blasting the full ~39.6k audience a second time. This partial
-- unique index makes that impossible: a second job can never reach 'processing'
-- for a campaign that already has one. The app catches the resulting unique
-- violation (P2002) and skips the duplicate send.
--
-- Safe to apply when no job is currently 'processing' (no conflicting rows).

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_active_send_per_campaign"
  ON "send_jobs" ("campaignId")
  WHERE "status" = 'processing';
