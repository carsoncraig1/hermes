import prisma from '@/lib/prisma'
import { normalizePhoneForTelnyx } from '@/lib/phoneUtils'

// Public base URL Telnyx fetches media from. Matches the hard-coded webhook host
// used elsewhere (https://txt.cx/api/message/status); overridable via env.
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://txt.cx').replace(/\/+$/, '')

/**
 * Public URL for a stored media asset's .vcf, served by /api/media/[id]/card.vcf.
 * Telnyx (and MMS handsets) fetch this URL directly — no external storage involved.
 * @param {string} id - MediaAsset id
 * @returns {string}
 */
export function mediaPublicUrl(id) {
  return `${PUBLIC_BASE_URL}/api/media/${id}/card.vcf`
}

/**
 * Resolve the contact card configured for a given sending number.
 * The card lives on the PhoneNumber row whose number matches `fromNumber`.
 * @param {string} userId
 * @param {string} fromNumber - sender number (any format; normalized to E.164)
 * @returns {Promise<{ mediaAssetId: string, url: string } | null>}
 */
export async function getCardForFromNumber(userId, fromNumber) {
  if (!userId || !fromNumber) return null
  const normalized = normalizePhoneForTelnyx(fromNumber)
  if (!normalized) return null

  const row = await prisma.phoneNumber.findFirst({
    where: { userId, phoneNumber: normalized, mediaAssetId: { not: null } },
    select: { mediaAssetId: true },
  })
  if (!row?.mediaAssetId) return null

  return { mediaAssetId: row.mediaAssetId, url: mediaPublicUrl(row.mediaAssetId) }
}
