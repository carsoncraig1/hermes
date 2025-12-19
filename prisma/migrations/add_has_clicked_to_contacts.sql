-- Add hasClicked field to contacts table
ALTER TABLE "contacts" ADD COLUMN "hasClicked" BOOLEAN NOT NULL DEFAULT false;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS "contacts_hasClicked_idx" ON "contacts"("hasClicked");

-- Backfill hasClicked based on existing click data
-- A contact has clicked if they have any MessageClickCode records where clicked = true
UPDATE "contacts" c
SET "hasClicked" = true
WHERE EXISTS (
  SELECT 1
  FROM "message_click_codes" mcc
  WHERE mcc."contactId" = c.id
    AND mcc."clicked" = true
);

