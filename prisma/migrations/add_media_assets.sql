-- Media assets for MMS (e.g. .vcf contact cards) that Telnyx fetches by public URL.
-- Column identifiers are quoted camelCase to match this schema's convention
-- (only SpamFilterEvent uses @map/snake_case; Message/Campaign/User use camelCase columns).

CREATE TABLE IF NOT EXISTS media_assets (
  "id"          TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "kind"        TEXT NOT NULL DEFAULT 'vcard',
  "contentType" TEXT NOT NULL,
  "url"         TEXT NOT NULL,
  "filename"    TEXT NOT NULL,
  "sizeBytes"   INTEGER NOT NULL,
  "label"       TEXT,
  "source"      TEXT NOT NULL DEFAULT 'generated',
  "vcardData"   JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "media_assets_userId_createdAt_idx"
  ON media_assets ("userId", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_assets_userId_fkey') THEN
    ALTER TABLE media_assets
      ADD CONSTRAINT "media_assets_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES users("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Link messages to the attached media asset, plus a JSON snapshot of the URLs
-- actually sent (kept so history survives deletion of the underlying asset).
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS "mediaAssetId" TEXT,
  ADD COLUMN IF NOT EXISTS "mediaUrls"    JSONB;

CREATE INDEX IF NOT EXISTS "messages_mediaAssetId_idx"
  ON messages ("mediaAssetId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_mediaAssetId_fkey') THEN
    ALTER TABLE messages
      ADD CONSTRAINT "messages_mediaAssetId_fkey"
      FOREIGN KEY ("mediaAssetId") REFERENCES media_assets("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Attach an optional media asset to a campaign (sent with every message in the campaign).
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS "mediaAssetId" TEXT;

CREATE INDEX IF NOT EXISTS "campaigns_mediaAssetId_idx"
  ON campaigns ("mediaAssetId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_mediaAssetId_fkey') THEN
    ALTER TABLE campaigns
      ADD CONSTRAINT "campaigns_mediaAssetId_fkey"
      FOREIGN KEY ("mediaAssetId") REFERENCES media_assets("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
