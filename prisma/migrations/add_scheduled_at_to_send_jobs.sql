-- Migration: Add scheduledAt field to send_jobs table
-- Run this SQL directly on your database

-- Add scheduledAt column to send_jobs table
ALTER TABLE "send_jobs" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);

-- Create index for finding scheduled jobs ready to execute
CREATE INDEX IF NOT EXISTS "send_jobs_status_scheduledAt_idx" ON "send_jobs"("status", "scheduledAt");

