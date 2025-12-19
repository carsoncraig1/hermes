/**
 * Error parsing utilities for Telnyx message delivery failures
 * Detects invalid phone numbers and other delivery issues from error messages
 */

/**
 * Keywords that indicate an invalid or unreachable phone number
 */
const INVALID_NUMBER_KEYWORDS = [
  'invalid',
  'unreachable',
  'undeliverable',
  'not found',
  'disconnected',
  'not in service',
  'out of service',
  'no longer in service',
  'cannot be reached',
  'invalid number',
  'invalid destination',
  'invalid recipient',
  'number not found',
  'number disconnected',
  'number unreachable',
  'carrier rejected',
  'rejected by carrier',
  'blocked',
  'block rule',
  'block',
  'opt-out',
  'opt out',
  'do not contact',
  'dnc', // Do Not Call
  'blacklist',
  'blacklisted',
];

/**
 * Keywords that indicate carrier-level opt-out or blocking
 */
const CARRIER_OPT_OUT_KEYWORDS = [
  'opt-out',
  'opt out',
  'do not contact',
  'dnc',
  'blacklist',
  'blacklisted',
  'carrier opt-out',
  'carrier blocked',
  'block rule',
  'blocked',
];

/**
 * Keywords that indicate temporary issues (should NOT auto-unsubscribe)
 */
const TEMPORARY_ERROR_KEYWORDS = [
  'temporary',
  'retry',
  'timeout',
  'network',
  'congestion',
  'busy',
  'unavailable',
  'try again',
  'later',
];

/**
 * Parse error message to determine if it indicates an invalid/unreachable number
 * @param {string|Array} errorMessage - Error message or array of error objects
 * @returns {Object} - Parsed error information
 */
export function parseDeliveryError(errorMessage) {
  if (!errorMessage) {
    return {
      isInvalidNumber: false,
      isCarrierOptOut: false,
      isTemporary: false,
      reason: null,
      confidence: 'low'
    };
  }

  // Handle array of error objects (from Telnyx webhook)
  let errorText = '';
  if (Array.isArray(errorMessage)) {
    errorText = errorMessage
      .map(e => e.detail || e.title || e.message || String(e))
      .join(' ')
      .toLowerCase();
  } else if (typeof errorMessage === 'object') {
    errorText = (errorMessage.detail || errorMessage.title || errorMessage.message || JSON.stringify(errorMessage)).toLowerCase();
  } else {
    errorText = String(errorMessage).toLowerCase();
  }

  // Check for temporary errors first (these should NOT trigger unsubscribe)
  const isTemporary = TEMPORARY_ERROR_KEYWORDS.some(keyword => 
    errorText.includes(keyword)
  );

  if (isTemporary) {
    return {
      isInvalidNumber: false,
      isCarrierOptOut: false,
      isTemporary: true,
      reason: 'temporary_error',
      confidence: 'high'
    };
  }

  // Check for carrier-level opt-out
  const isCarrierOptOut = CARRIER_OPT_OUT_KEYWORDS.some(keyword => 
    errorText.includes(keyword)
  );

  if (isCarrierOptOut) {
    return {
      isInvalidNumber: true, // Treat as invalid for unsubscribe purposes
      isCarrierOptOut: true,
      isTemporary: false,
      reason: 'carrier_opt_out',
      confidence: 'high'
    };
  }

  // Check for invalid number keywords
  const matchingKeywords = INVALID_NUMBER_KEYWORDS.filter(keyword => 
    errorText.includes(keyword)
  );

  if (matchingKeywords.length > 0) {
    // Higher confidence if multiple keywords match
    const confidence = matchingKeywords.length >= 2 ? 'high' : 
                      matchingKeywords.length === 1 ? 'medium' : 'low';
    
    return {
      isInvalidNumber: true,
      isCarrierOptOut: false,
      isTemporary: false,
      reason: 'invalid_number',
      confidence,
      matchedKeywords: matchingKeywords
    };
  }

  return {
    isInvalidNumber: false,
    isCarrierOptOut: false,
    isTemporary: false,
    reason: null,
    confidence: 'low'
  };
}

/**
 * Determine unsubscribe reason based on error parsing
 * @param {string} status - Message status (sending_failed, delivery_failed, etc.)
 * @param {string|Array} errorMessage - Error message
 * @returns {string|null} - Unsubscribe reason or null if should not unsubscribe
 */
export function getUnsubscribeReason(status, errorMessage) {
  // Only unsubscribe on specific failure statuses
  if (status !== 'sending_failed' && status !== 'delivery_failed') {
    return null;
  }

  const parsed = parseDeliveryError(errorMessage);
  
  if (parsed.isInvalidNumber && !parsed.isTemporary) {
    if (parsed.isCarrierOptOut) {
      return 'carrier_opt_out';
    }
    return parsed.reason || 'delivery_failed';
  }

  return null;
}

