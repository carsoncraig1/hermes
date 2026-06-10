-- Restructure .vcf/MMS media:
--   * media stored in-DB (served from /api/media/[id]/card.vcf) instead of S3
--   * card configured per phone number (phone_numbers.mediaAssetId)
--   * campaigns get an attachVcf toggle instead of a direct media asset
-- media_assets is empty at this point, so dropping/adding NOT NULL columns is safe.

-- media_assets: replace S3 url/filename with in-DB content
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS "content" TEXT NOT NULL DEFAULT '';
ALTER TABLE media_assets ALTER COLUMN "content" DROP DEFAULT;
ALTER TABLE media_assets DROP COLUMN IF EXISTS "url";
ALTER TABLE media_assets DROP COLUMN IF EXISTS "filename";

-- phone_numbers: attach an optional contact card per sending number
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS "mediaAssetId" TEXT;

CREATE INDEX IF NOT EXISTS "phone_numbers_mediaAssetId_idx"
  ON phone_numbers ("mediaAssetId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'phone_numbers_mediaAssetId_fkey') THEN
    ALTER TABLE phone_numbers
      ADD CONSTRAINT "phone_numbers_mediaAssetId_fkey"
      FOREIGN KEY ("mediaAssetId") REFERENCES media_assets("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- campaigns: drop the direct media link, add the attach toggle
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_mediaAssetId_fkey') THEN
    ALTER TABLE campaigns DROP CONSTRAINT "campaigns_mediaAssetId_fkey";
  END IF;
END $$;
DROP INDEX IF EXISTS "campaigns_mediaAssetId_idx";
ALTER TABLE campaigns DROP COLUMN IF EXISTS "mediaAssetId";
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "attachVcf" BOOLEAN NOT NULL DEFAULT false;

-- messages.mediaAssetId / mediaUrls are unchanged (kept for send history).
