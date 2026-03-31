-- Migration: Add phone number revolver tables/columns
-- NOTE: This file is created but not applied automatically.

CREATE TABLE IF NOT EXISTS "phone_numbers" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "friendlyName" TEXT,
  "type" TEXT NOT NULL DEFAULT 'toll_free',
  "messagingProfileId" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "acceptingNewLeads" BOOLEAN NOT NULL DEFAULT true,
  "rateLimit" INTEGER NOT NULL DEFAULT 1200,
  "currentMonthMessages" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "phone_numbers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "contacts"
  ADD COLUMN IF NOT EXISTS "assignedPhoneNumberId" INTEGER;

ALTER TABLE "contacts"
  DROP CONSTRAINT IF EXISTS "contacts_assignedPhoneNumberId_fkey";

ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_assignedPhoneNumberId_fkey"
  FOREIGN KEY ("assignedPhoneNumberId")
  REFERENCES "phone_numbers"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "phone_numbers_userId_phoneNumber_key"
  ON "phone_numbers"("userId", "phoneNumber");

CREATE INDEX IF NOT EXISTS "phone_numbers_userId_enabled_idx"
  ON "phone_numbers"("userId", "enabled");

CREATE INDEX IF NOT EXISTS "phone_numbers_userId_acceptingNewLeads_idx"
  ON "phone_numbers"("userId", "acceptingNewLeads");
