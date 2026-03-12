/**
 * SMS message validation and encoding detection
 * Based on Telnyx character limits:
 * - GSM-7: 160 chars/single part, 153 chars/part for multi-part
 * - UTF-16 (UCS-2): 70 chars/single part, 67 chars/part for multi-part (BMP)
 * Any non-GSM character forces UTF-16 encoding for the entire message.
 */

// GSM-7 safe character set (Telnyx most widely supported)
// Excludes grave accent (U+0060, `). Characters ~^|{}[] require escape = 2 chars each.
const GSM7_BASIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const GSM7_PUNCT = '\n\r !"#$%&\'()*+,-./:;<=>?@[\\]^_{}|~';
const GSM7_EXTENDED = '£¥èéùìòØøÅåÆæßÉ¡ÄÖÑÜ¿äöñüà';
const GSM7_ESCAPE_CHARS = '~^|{}[]'; // Each counts as 2 chars in GSM-7

const GSM7_SET = new Set(
  (GSM7_BASIC + GSM7_PUNCT + GSM7_EXTENDED)
    .split('')
    .filter((c) => c !== '`') // Exclude grave accent
);

/**
 * Detect non-GSM characters in text
 * @param {string} text - Message text
 * @returns {{ hasNonGsm: boolean, nonGsmChars: string[], sample: string }}
 */
export function detectNonGsmCharacters(text) {
  if (!text || typeof text !== 'string') {
    return { hasNonGsm: false, nonGsmChars: [], sample: '' };
  }

  const seen = new Set();
  const nonGsmChars = [];

  for (const char of text) {
    if (!GSM7_SET.has(char) && !seen.has(char)) {
      seen.add(char);
      nonGsmChars.push(char);
    }
  }

  const sample = nonGsmChars.slice(0, 5).join('');
  return {
    hasNonGsm: nonGsmChars.length > 0,
    nonGsmChars,
    sample
  };
}

/**
 * Get SMS encoding that Telnyx will use
 * @param {string} text - Message text
 * @returns {'GSM-7' | 'UTF-16'}
 */
export function getSmsEncoding(text) {
  const { hasNonGsm } = detectNonGsmCharacters(text);
  return hasNonGsm ? 'UTF-16' : 'GSM-7';
}

/**
 * Common non-GSM to GSM replacements for auto-fix suggestion
 */
const SUGGESTED_REPLACEMENTS = {
  '\u2026': '...',   // … (ellipsis)
  '\u2018': "'",     // ' (left single quote)
  '\u2019': "'",     // ' (right single quote)
  '\u201C': '"',     // " (left double quote)
  '\u201D': '"',     // " (right double quote)
  '\u2013': '-',     // – (en dash)
  '\u2014': '-',     // — (em dash)
  '\u00A0': ' ',     // non-breaking space
};

/**
 * Get suggested replacement for non-GSM text
 * @param {string} text - Message text
 * @returns {{ hasReplacement: boolean, fixedText: string, replacedChars: string[] }}
 */
export function getSuggestedReplacement(text) {
  if (!text || typeof text !== 'string') {
    return { hasReplacement: false, fixedText: text, replacedChars: [] };
  }

  let fixedText = text;
  const replacedChars = [];

  for (const [nonGsm, replacement] of Object.entries(SUGGESTED_REPLACEMENTS)) {
    if (fixedText.includes(nonGsm)) {
      fixedText = fixedText.split(nonGsm).join(replacement);
      replacedChars.push(`${nonGsm} → ${replacement}`);
    }
  }

  // Replace any remaining non-GSM with best guess (e.g. ? for unknown)
  const { nonGsmChars } = detectNonGsmCharacters(fixedText);
  for (const char of nonGsmChars) {
    if (!SUGGESTED_REPLACEMENTS[char]) {
      // No known replacement - could replace with ? or leave as-is
      // For now we don't auto-replace unknown chars
    }
  }

  return {
    hasReplacement: replacedChars.length > 0,
    fixedText,
    replacedChars
  };
}

/**
 * Calculate SMS parts based on encoding
 * @param {string} text - Message text
 * @param {'GSM-7' | 'UTF-16'} encoding
 * @returns {number}
 */
function calculateParts(text, encoding) {
  const len = text.length;
  if (encoding === 'UTF-16') {
    // 70 chars single, 67 per part multi (134 bytes/part, 2 bytes/char BMP)
    if (len <= 70) return 1;
    return Math.ceil(len / 67);
  }
  // GSM-7: 160 single, 153 per part multi
  // Simplified: don't count escape chars as 2x for now (conservative estimate)
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

/**
 * Validate message text and calculate parts
 * @param {string} text - Message text
 * @returns {Object} - Validation result with parts count, encoding, and warnings
 */
export function validateMessage(text) {
  if (!text || typeof text !== 'string') {
    return {
      valid: false,
      error: 'Message text is required',
      parts: 0,
      characterCount: 0,
      encoding: 'GSM-7',
      encodingWarning: null,
      nonGsmChars: [],
      suggestedReplacement: null
    };
  }

  const characterCount = text.length;
  const { hasNonGsm, nonGsmChars, sample } = detectNonGsmCharacters(text);
  const encoding = hasNonGsm ? 'UTF-16' : 'GSM-7';
  const parts = calculateParts(text, encoding);

  const warnings = [];
  let encodingWarning = null;
  let suggestedReplacement = null;

  if (hasNonGsm) {
    encodingWarning =
      'Non-GSM characters (e.g. …, smart quotes) force UTF-16 encoding and increase SMS parts. Replace with ASCII equivalents (e.g. ...) to reduce cost.';
    warnings.push(encodingWarning);
    const suggestion = getSuggestedReplacement(text);
    if (suggestion.hasReplacement) {
      suggestedReplacement = suggestion.fixedText;
    }
  }

  if (parts > 1) {
    warnings.push(
      `Message will be split into ${parts} parts (${characterCount} characters)`
    );
  }
  if (characterCount > 1000) {
    warnings.push(
      'Very long messages may have higher delivery failure rates'
    );
  }

  const remainingChars =
    encoding === 'UTF-16'
      ? parts === 1
        ? 70 - characterCount
        : (67 - (characterCount % 67)) % 67
      : parts === 1
        ? 160 - characterCount
        : (153 - (characterCount % 153)) % 153;

  return {
    valid: true,
    parts,
    characterCount,
    remainingChars: remainingChars === 0 && parts > 1 ? (encoding === 'UTF-16' ? 67 : 153) : remainingChars,
    warnings,
    isConcatenated: parts > 1,
    encoding,
    encodingWarning,
    nonGsmChars,
    suggestedReplacement
  };
}
