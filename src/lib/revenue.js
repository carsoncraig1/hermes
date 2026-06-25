import prisma from '@/lib/prisma';
import crypto from 'crypto';

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

/**
 * Hash a clicker's phone number for privacy-preserving identification on the
 * destination side. Strips to digits only (drops the leading "+", spaces, dashes)
 * so the hashed value is digits-with-country-code (e.g. "15551234567"), then
 * SHA-256 (lowercase hex). No salt, so the same phone always produces the same
 * hash — allowing external systems (e.g. Meta advanced matching) to match it.
 * @param {string} phone - Phone number (E.164 as stored, e.g. "+15551234567")
 * @returns {string|null} - Lowercase hex SHA-256 digest, or null if no digits
 */
export function hashPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, ''); // e.g. "+15551234567" -> "15551234567"
  if (!digits) return null;
  return crypto.createHash('sha256').update(digits).digest('hex');
}

/**
 * Append phone_hash parameter to a destination URL
 * @param {string} destination - Destination URL (may already include hrms)
 * @param {string} phoneHash - Hashed phone number
 * @returns {string} - Destination URL with phone_hash parameter
 */
export function appendPhoneHashToUrl(destination, phoneHash) {
  if (!destination || !phoneHash) return destination;

  try {
    const url = new URL(destination);
    url.searchParams.set('phone_hash', phoneHash);
    return url.toString();
  } catch (error) {
    // If URL parsing fails, append as query string
    const separator = destination.includes('?') ? '&' : '?';
    return `${destination}${separator}phone_hash=${encodeURIComponent(phoneHash)}`;
  }
}

