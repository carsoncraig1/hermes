/**
 * Normalize phone number to E.164 format for Telnyx.
 * Ensures phone numbers are in the format +1XXXXXXXXXX when possible.
 */
export function normalizePhoneForTelnyx(phone) {
  if (!phone) return null;

  if (phone.startsWith('+')) {
    return phone;
  }

  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && digits[0] === '1') {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11) {
    return `+${digits}`;
  }

  return phone;
}
