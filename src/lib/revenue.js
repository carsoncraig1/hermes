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

