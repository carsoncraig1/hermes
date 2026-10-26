import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

/**
 * Canonical storage/provider format: +<country code><national number>.
 * International input requires an explicit + country code. Bare 10-digit and
 * 11-digit 1-prefixed numbers retain the existing NANP default.
 * Checks recognized calling codes and possible lengths, not number ownership.
 */
export function normalizePhoneNumber(phone) {
  if (typeof phone !== 'string') return null;
  const value = phone.trim();
  if (!/^\+?[\d\s().-]+$/.test(value)) return null;

  const digits = value.replace(/\D/g, '');
  let international;
  if (value.startsWith('+')) {
    international = `+${digits}`;
  } else if (digits.length === 10) {
    international = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    international = `+${digits}`;
  } else {
    return null;
  }

  const parsed = parsePhoneNumberFromString(international);
  return parsed?.isPossible() ? parsed.number : null;
}
