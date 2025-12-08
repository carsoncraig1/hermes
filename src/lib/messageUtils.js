/**
 * Validate message text and calculate parts
 * SMS: 160 characters per part (GSM-7 encoding)
 * For longer messages, they're automatically concatenated
 * @param {string} text - Message text
 * @returns {Object} - Validation result with parts count and warnings
 */
export function validateMessage(text) {
  if (!text || typeof text !== 'string') {
    return {
      valid: false,
      error: 'Message text is required',
      parts: 0,
      characterCount: 0
    };
  }

  const characterCount = text.length;
  const parts = Math.ceil(characterCount / 160);
  const remainingChars = characterCount % 160;
  
  const warnings = [];
  if (parts > 1) {
    warnings.push(`Message will be split into ${parts} parts (${characterCount} characters)`);
  }
  if (characterCount > 1000) {
    warnings.push('Very long messages may have higher delivery failure rates');
  }

  return {
    valid: true,
    parts,
    characterCount,
    remainingChars: remainingChars === 0 ? 160 : remainingChars,
    warnings,
    isConcatenated: parts > 1
  };
}
