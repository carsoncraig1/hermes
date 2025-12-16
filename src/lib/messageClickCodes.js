import prisma from '@/lib/prisma';
import crypto from 'crypto';

// Base62 character set: 0-9, A-Z, a-z (62 characters total)
const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Generate a random base62 code of specified length
 * @param {number} length - Length of code (default: 5)
 * @returns {string} - Random base62 code
 */
function generateBase62Code(length = 5) {
  let code = '';
  for (let i = 0; i < length; i++) {
    // Use crypto.randomBytes for better compatibility
    const randomBytes = crypto.randomBytes(1);
    const randomIndex = randomBytes[0] % BASE62_CHARS.length;
    code += BASE62_CHARS[randomIndex];
  }
  return code;
}

/**
 * Generate a unique click code for message tracking
 * Checks for collisions and retries if needed
 * @param {number} maxRetries - Maximum number of retry attempts (default: 10)
 * @returns {Promise<string>} - Unique 5-6 character code
 */
export async function generateUniqueClickCode(maxRetries = 10) {
  let attempts = 0;
  let code = '';
  
  while (attempts < maxRetries) {
    // Use 5 chars for most cases, 6 chars if we hit collisions
    const codeLength = attempts < 5 ? 5 : 6;
    code = generateBase62Code(codeLength);
    
    // Check if code already exists
    const existing = await prisma.messageClickCode.findUnique({
      where: { code },
      select: { id: true }
    });
    
    if (!existing) {
      return code;
    }
    
    attempts++;
  }
  
  // If we still have collisions after max retries, use timestamp + random
  const timestamp = Date.now().toString(36);
  const random = generateBase62Code(3);
  return `${timestamp.slice(-3)}${random}`;
}

/**
 * Extract shortlink references from message text
 * Looks for shortlink markers: {{SHORTLINK:ID}} or txt.cx/shortlink-ID
 * @param {string} messageText - Message text to parse
 * @returns {Array<{shortlinkId: number, fullUrl: string, index: number}>} - Array of shortlink objects
 */
export function extractShortlinksFromText(messageText) {
  if (!messageText) return [];
  
  const shortlinks = [];
  
  // Pattern 1: {{SHORTLINK:123}} marker format
  const markerRegex = /\{\{SHORTLINK:(\d+)\}\}/g;
  let match;
  while ((match = markerRegex.exec(messageText)) !== null) {
    const shortlinkId = parseInt(match[1], 10);
    shortlinks.push({
      shortlinkId,
      fullUrl: match[0],
      index: match.index,
      type: 'marker'
    });
  }
  
  // Pattern 2: txt.cx/shortlink-123 format (legacy support)
  const urlRegex = /https:\/\/txt\.cx\/shortlink-(\d+)/g;
  while ((match = urlRegex.exec(messageText)) !== null) {
    const shortlinkId = parseInt(match[1], 10);
    shortlinks.push({
      shortlinkId,
      fullUrl: match[0],
      index: match.index,
      type: 'url'
    });
  }
  
  return shortlinks;
}

/**
 * Create MessageClickCode records for all shortlinks in a message
 * @param {string} messageId - Message ID
 * @param {string} messageText - Original message text
 * @param {number} contactId - Contact ID
 * @param {string} userId - User ID
 * @returns {Promise<{codes: Array, modifiedText: string}>} - Created codes and modified message text
 */
export async function createMessageClickCodes(messageId, messageText, contactId, userId) {
  if (!messageText || !messageId) {
    return { codes: [], modifiedText: messageText };
  }
  
  const shortlinkRefs = extractShortlinksFromText(messageText);
  if (shortlinkRefs.length === 0) {
    return { codes: [], modifiedText: messageText };
  }
  
  // Get all shortlink IDs and verify they belong to this user
  const shortlinkIds = [...new Set(shortlinkRefs.map(s => s.shortlinkId))];
  const shortlinkRecords = await prisma.shortlink.findMany({
    where: {
      userId,
      id: { in: shortlinkIds }
    },
    select: {
      id: true,
      enabled: true
    }
  });
  
  // Create a map of shortlink ID to verify ownership
  const validShortlinkIds = new Set(shortlinkRecords.map(s => s.id));
  
  // Calculate expiration date (30 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  
  // Create codes for each shortlink in the message
  const codes = [];
  let modifiedText = messageText;
  
  // Process in reverse order to maintain correct indices when replacing
  for (let i = shortlinkRefs.length - 1; i >= 0; i--) {
    const shortlinkRef = shortlinkRefs[i];
    const shortlinkId = shortlinkRef.shortlinkId;
    
    if (!validShortlinkIds.has(shortlinkId)) {
      console.warn(`Shortlink with ID ${shortlinkId} not found or not owned by user ${userId}`);
      continue;
    }
    
    // Generate unique code
    const code = await generateUniqueClickCode();
    
    // Create MessageClickCode record
    const messageClickCode = await prisma.messageClickCode.create({
      data: {
        code,
        shortlinkId,
        messageId,
        contactId,
        userId,
        expiresAt
      }
    });
    
    codes.push(messageClickCode);
    
    // Replace marker/URL in message text with code-only URL
    // Format: txt.cx/CODE
    const newUrl = `https://txt.cx/${code}`;
    modifiedText = modifiedText.substring(0, shortlinkRef.index) + 
                   newUrl + 
                   modifiedText.substring(shortlinkRef.index + shortlinkRef.fullUrl.length);
  }
  
  return { codes, modifiedText };
}

/**
 * Lookup MessageClickCode by code
 * @param {string} code - Click code to lookup
 * @returns {Promise<MessageClickCode|null>} - MessageClickCode record or null
 */
export async function lookupMessageClickCode(code) {
  if (!code) return null;
  
  const messageClickCode = await prisma.messageClickCode.findUnique({
    where: { code },
    include: {
      shortlink: {
        select: {
          id: true,
          destination: true,
          nickname: true,
          enabled: true,
          ogEnabled: true,
          ogImage: true,
          ogTitle: true,
          ogDescription: true,
          clicks: true,
          opens: true
        }
      },
      message: {
        select: {
          id: true,
          contactId: true,
          campaignId: true
        }
      }
    }
  });
  
  // Check if code has expired
  if (messageClickCode && new Date() > messageClickCode.expiresAt) {
    // Code expired, but we'll still return it for tracking purposes
    // The cleanup job will delete it later
    return messageClickCode;
  }
  
  return messageClickCode;
}

/**
 * Mark a MessageClickCode as clicked
 * @param {string} code - Click code
 * @returns {Promise<void>}
 */
export async function markCodeAsClicked(code) {
  await prisma.messageClickCode.update({
    where: { code },
    data: {
      clicked: true,
      clickedAt: new Date()
    }
  });
}

/**
 * Mark a MessageClickCode as opened (preview fetched by bot)
 * @param {string} code - Click code
 * @returns {Promise<void>}
 */
export async function markCodeAsOpened(code) {
  await prisma.messageClickCode.update({
    where: { code },
    data: {
      opened: true,
      openedAt: new Date()
    }
  });
}

/**
 * Cleanup expired MessageClickCodes (older than 30 days)
 * @param {number} daysOld - Delete codes older than this many days (default: 30)
 * @returns {Promise<number>} - Number of codes deleted
 */
export async function cleanupExpiredClickCodes(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await prisma.messageClickCode.deleteMany({
    where: {
      expiresAt: {
        lt: cutoffDate
      }
    }
  });
  
  return result.count;
}

