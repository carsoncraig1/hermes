/**
 * Error parsing utilities for Telnyx message delivery failures
 * Detects invalid phone numbers and other delivery issues from error messages
 */

/**
 * Keywords that indicate a carrier-level opt-out or block
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
  'already blocked',
];

/**
 * Keywords that indicate landline/non-routable/non-SMS-capable numbers
 */
const LANDLINE_OR_NON_ROUTABLE_KEYWORDS = [
  'landline',
  'fixed line',
  'non-routable',
  'non routable',
  'not routable',
  'non-routable wireless',
  'not sms capable',
  'sms not supported',
  'no sms',
  'text not supported',
  'wireless number is not routable',
];

/**
 * Keywords that indicate permanent invalid or unreachable destinations
 */
const INVALID_NUMBER_KEYWORDS = [
  'invalid number',
  'invalid destination',
  'invalid recipient',
  'destination number was deemed invalid',
  'destination phone number was deemed invalid',
  'number not found',
  'number disconnected',
  'number unreachable',
  'cannot be reached',
  'disconnected',
  'not in service',
  'out of service',
  'no longer in service',
  'unreachable destination',
  'undeliverable',
  'carrier rejected',
  'recipient carrier did not accept',
  'rejected by carrier',
];

/**
 * Keywords that indicate temporary issues (should NOT auto-unsubscribe)
 */
const TEMPORARY_ERROR_KEYWORDS = [
  'temporary',
  'spam filter',
  'blocked as spam - temporary',
  'retry',
  'rate limit',
  'timeout',
  'congestion',
  'busy',
  'temporarily unavailable',
  'temporary unavailable',
  'try again',
  'try later',
  'please retry',
];

/**
 * Build normalized searchable text from provider errors.
 * Includes structured fields so code-only errors are still classified.
 * @param {string|Array|Object} errorMessage
 * @returns {string}
 */
function buildErrorText(errorMessage) {
  if (!errorMessage) return '';

  if (Array.isArray(errorMessage)) {
    return errorMessage
      .map((e) => {
        if (typeof e === 'object' && e !== null) {
          return [
            e.code,
            e.detail,
            e.title,
            e.message,
            e.reason,
            e.description,
          ]
            .filter(Boolean)
            .join(' ');
        }
        return String(e);
      })
      .join(' ')
      .toLowerCase();
  }

  if (typeof errorMessage === 'object') {
    return [
      errorMessage.code,
      errorMessage.detail,
      errorMessage.title,
      errorMessage.message,
      errorMessage.reason,
      errorMessage.description,
      JSON.stringify(errorMessage),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  return String(errorMessage).toLowerCase();
}

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

  const errorText = buildErrorText(errorMessage);

  // Telnyx code 40002 is provider spam filtering and explicitly temporary.
  // Never treat this as a permanent unsubscribe condition.
  const hasTemporarySpamFilterCode = errorText.includes('40002');
  if (hasTemporarySpamFilterCode) {
    return {
      isInvalidNumber: false,
      isCarrierOptOut: false,
      isTemporary: true,
      reason: 'temporary_error',
      confidence: 'high'
    };
  }

  // Check for carrier-level opt-out
  const isCarrierOptOut = CARRIER_OPT_OUT_KEYWORDS.some((keyword) =>
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

  // Explicit classification for landline/non-routable numbers
  const isLandlineOrNonRoutable = LANDLINE_OR_NON_ROUTABLE_KEYWORDS.some(
    (keyword) => errorText.includes(keyword)
  );

  if (isLandlineOrNonRoutable) {
    return {
      isInvalidNumber: true,
      isCarrierOptOut: false,
      isTemporary: false,
      reason: 'landline_or_non_routable',
      confidence: 'high'
    };
  }

  // Check for invalid number keywords
  const matchingKeywords = INVALID_NUMBER_KEYWORDS.filter((keyword) =>
    errorText.includes(keyword)
  );

  // 40310 is treated as hard invalid destination (Telnyx invalid "to" address)
  const hasHardInvalidCode = errorText.includes('40310');
  if (matchingKeywords.length > 0 || hasHardInvalidCode) {
    const confidence =
      hasHardInvalidCode || matchingKeywords.length >= 2
        ? 'high'
        : matchingKeywords.length === 1
          ? 'medium'
          : 'low';

    return {
      isInvalidNumber: true,
      isCarrierOptOut: false,
      isTemporary: false,
      reason: 'invalid_number',
      confidence,
      matchedKeywords: matchingKeywords
    };
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

  return {
    isInvalidNumber: false,
    isCarrierOptOut: false,
    isTemporary: false,
    reason: null,
    confidence: 'low'
  };
}

/**
 * Determine permanent unsubscribe reason from delivery error details.
 * @param {string|Array|Object} errorMessage - Error message payload
 * @returns {string|null} - Canonical reason or null for non-permanent failures
 */
export function getPermanentUnsubscribeReason(errorMessage) {
  const parsed = parseDeliveryError(errorMessage);
  if (parsed.isInvalidNumber && !parsed.isTemporary) {
    return parsed.reason || 'permanent_delivery_failure';
  }
  return null;
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

  return getPermanentUnsubscribeReason(errorMessage);
}

