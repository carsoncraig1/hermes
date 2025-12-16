-- Migration: Remove campaign execution locks table
-- Run this SQL directly on your database to clean up the campaign lock system

-- Drop the campaign_execution_locks table if it exists
DROP TABLE IF EXISTS "campaign_execution_locks";

