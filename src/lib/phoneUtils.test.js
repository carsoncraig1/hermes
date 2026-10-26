import { describe, expect, it } from 'vitest';
import { normalizePhoneNumber } from './phoneUtils';

describe('canonical phone normalization', () => {
  it.each([
    ['2025550123', '+12025550123'],
    ['(202) 555-0123', '+12025550123'],
    ['12025550123', '+12025550123'],
    [' +1 (202) 555-0123 ', '+12025550123'],
    ['(555) 123-4567', '+15551234567'],
    ['+44 20 7946 0958', '+442079460958'],
    ['+61 (2) 9374-4000', '+61293744000'],
    ['+91 98765 43210', '+919876543210'],
    ['+65 6123 4567', '+6561234567'],
    ['+39 02 36618 300', '+390236618300'],
  ])('normalizes %s to %s without changing its country code', (input, canonical) => {
    expect(normalizePhoneNumber(input)).toBe(canonical);
    expect(normalizePhoneNumber(canonical)).toBe(canonical);
  });

  it.each([
    null, undefined, false, 12025550123, '', ' ', 'no digits',
    '+999 123456789', '+1 202 555', '+12025550123456789',
    '442079460958', '020 7946 0958', '+1 202 555 0123 ext 4',
    'call +1 202 555 0123', '1+2025550123', '++12025550123',
  ])('rejects malformed, impossible, or ambiguous input: %s', input => {
    expect(normalizePhoneNumber(input)).toBeNull();
  });
});
