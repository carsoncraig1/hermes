-- Migration: Add bulk send optimizations
-- Run this SQL directly on your database

-- Create send_jobs table
CREATE TABLE IF NOT EXISTS "send_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "processedContacts" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "currentBatch" INTEGER NOT NULL DEFAULT 0,
    "totalBatches" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "send_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "send_jobs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "send_jobs_userId_status_idx" ON "send_jobs"("userId", "status");
CREATE INDEX IF NOT EXISTS "send_jobs_campaignId_status_idx" ON "send_jobs"("campaignId", "status");
CREATE INDEX IF NOT EXISTS "send_jobs_status_createdAt_idx" ON "send_jobs"("status", "createdAt");

-- Create delayed_workflow_actions table
CREATE TABLE IF NOT EXISTS "delayed_workflow_actions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "campaignId" INTEGER,
    "contactId" INTEGER NOT NULL,
    "workflow" JSONB NOT NULL,
    "currentNodeId" TEXT NOT NULL,
    "executeAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "delayed_workflow_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "delayed_workflow_actions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "delayed_workflow_actions_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "delayed_workflow_actions_status_executeAt_idx" ON "delayed_workflow_actions"("status", "executeAt");
CREATE INDEX IF NOT EXISTS "delayed_workflow_actions_contactId_idx" ON "delayed_workflow_actions"("contactId");
CREATE INDEX IF NOT EXISTS "delayed_workflow_actions_campaignId_idx" ON "delayed_workflow_actions"("campaignId");

-- Create rate_limit_cache table
CREATE TABLE IF NOT EXISTS "rate_limit_cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "minuteCount" INTEGER NOT NULL DEFAULT 0,
    "hourCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rate_limit_cache_userId_key" UNIQUE ("userId"),
    CONSTRAINT "rate_limit_cache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "rate_limit_cache_expiresAt_idx" ON "rate_limit_cache"("expiresAt");

