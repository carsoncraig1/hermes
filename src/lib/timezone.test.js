import { describe, it, expect } from 'vitest';
import {
  formatDateTimeInTimeZone,
  isValidTimeZone,
  zonedDateTimeToUtcDate
} from './timezone';

describe('timezone utilities', () => {
  it('validates IANA timezone values', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('Not/A_Real_Timezone')).toBe(false);
  });

  it('converts wall-clock time in timezone to UTC date', () => {
    const utcDate = zonedDateTimeToUtcDate('2026-03-10T09:30', 'America/New_York');
    expect(utcDate).not.toBeNull();
    expect(utcDate.toISOString()).toBe('2026-03-10T13:30:00.000Z');
  });

  it('formats a UTC timestamp in the selected timezone', () => {
    const formatted = formatDateTimeInTimeZone('2026-03-10T13:30:00.000Z', 'America/New_York');
    expect(formatted).toContain('9:30');
  });
});
