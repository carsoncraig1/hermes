import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { normalizePhoneNumber } from '@/lib/phoneUtils';

/**
 * Generate a unique hrms (Hermes Revenue Tracking) parameter
 * Format: hrms_{userId}_{shortlinkId}_{timestamp}_{random}
 * @param {string} userId - User ID
 * @param {number} shortlinkId - Shortlink ID
 * @returns {string} - Unique hrms value
 */
export function generateHrms(userId, shortlinkId) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex'); // Increased randomness for uniqueness
  return `hrms_${userId.slice(0, 8)}_${shortlinkId}_${timestamp}_${random}`;
}

/**
 * Create a new click record with unique HRMS for a shortlink
 * Each click gets its own unique HRMS for proper revenue attribution
 * @param {number} shortlinkId - Shortlink ID
 * @param {string} messageId - Optional message ID that contained this shortlink
 * @param {number} contactId - Optional contact ID who clicked
 * @param {number} messageClickCodeId - Optional MessageClickCode ID
 * @param {string} userAgent - Optional user agent string
 * @param {string} ipAddress - Optional IP address
 * @param {string} referrer - Optional referrer URL
 * @returns {Promise<string>} - Unique hrms value for this click
 */
export async function createClickWithHrms(
  shortlinkId,
  messageId = null,
  contactId = null,
  messageClickCodeId = null,
  userAgent = null,
  ipAddress = null,
  referrer = null
) {
  const shortlink = await prisma.shortlink.findUnique({
    where: { id: shortlinkId },
    select: { userId: true, campaignId: true }
  });

  if (!shortlink) {
    throw new Error('Shortlink not found');
  }

  // Generate unique HRMS for this specific click
  const hrms = generateHrms(shortlink.userId, shortlinkId);

  // Create click record with unique HRMS and message/contact tracking
  await prisma.shortlinkClick.create({
    data: {
      shortlinkId,
      messageId,
      messageClickCodeId,
      hrms,
      userAgent,
      ipAddress,
      referrer
    }
  });

  return hrms;
}

/**
 * Append hrms parameter to a destination URL
 * @param {string} destination - Original destination URL
 * @param {string} hrms - hrms tracking parameter
 * @returns {string} - Destination URL with hrms parameter
 */
export function appendHrmsToUrl(destination, hrms) {
  if (!destination || !hrms) return destination;

  try {
    const url = new URL(destination);
    url.searchParams.set('hrms', hrms);
    return url.toString();
  } catch (error) {
    // If URL parsing fails, append as query string
    const separator = destination.includes('?') ? '&' : '?';
    return `${destination}${separator}hrms=${encodeURIComponent(hrms)}`;
  }
}

function normalizePhoneDigits(phone) {
  return normalizePhoneNumber(phone)?.slice(1) || null;
}

function hashNormalizedPhone(digits) {
  return digits ? crypto.createHash('sha256').update(digits).digest('hex') : null;
}

/**
 * Hash a clicker's phone number for privacy-preserving identification on the
 * destination side. Normalizes to international E.164, then removes the "+".
 * SHA-256 (lowercase hex), with no salt, lets external systems match the phone.
 * @param {string} phone - International phone, or a national NANP phone
 * @returns {string|null} - Lowercase hex SHA-256 digest, or null for invalid input
 */
export function hashPhone(phone) {
  return hashNormalizedPhone(normalizePhoneDigits(phone));
}

/** Add the recipient's raw phone alongside its normalized phone hash. */
export function appendRecipientIdentityToUrl(destination, phone) {
  const digits = normalizePhoneDigits(phone);
  if (!destination || !digits) return destination;
  const enriched = appendPhoneHashToUrl(destination, hashNormalizedPhone(digits));
  try {
    const url = new URL(enriched);
    url.searchParams.set('phone', digits);
    return url.toString();
  } catch {
    return setFallbackQueryParam(enriched, 'phone', digits);
  }
}

// Preserve relative paths, protocol-relative hosts and malformed destination
// text without resolving against a different host. Query data precedes fragments.
function setFallbackQueryParam(destination, key, value) {
  const fragmentIndex = destination.indexOf('#');
  const fragment = fragmentIndex < 0 ? '' : destination.slice(fragmentIndex);
  const beforeFragment = fragmentIndex < 0 ? destination : destination.slice(0, fragmentIndex);
  const queryIndex = beforeFragment.indexOf('?');
  const path = queryIndex < 0 ? beforeFragment : beforeFragment.slice(0, queryIndex);
  const params = new URLSearchParams(queryIndex < 0 ? '' : beforeFragment.slice(queryIndex + 1));
  params.set(key, value);
  return `${path}?${params.toString()}${fragment}`;
}

export function appendPhoneHashToUrl(destination, phoneHash) {
  if (!destination || !phoneHash) return destination;

  try {
    const url = new URL(destination);
    url.searchParams.set('phone_hash', phoneHash);
    return url.toString();
  } catch (error) {
    return setFallbackQueryParam(destination, 'phone_hash', phoneHash);
  }
}

