import { describe, it, expect } from 'vitest';
import { OCO_BASE, normalizeWebinarId, generateOCOLink, OCO_BRANDS } from './ocoLink';

describe('normalizeWebinarId', () => {
  it('strips dashes and spaces', () => {
    expect(normalizeWebinarId('878-242 07928')).toBe('87824207928');
  });

  it('returns empty string for nullish or non-digit input', () => {
    expect(normalizeWebinarId('')).toBe('');
    expect(normalizeWebinarId(null)).toBe('');
    expect(normalizeWebinarId('abc')).toBe('');
  });
});

describe('generateOCOLink', () => {
  it('returns null when no digits', () => {
    expect(generateOCOLink('', 'IFI')).toBeNull();
    expect(generateOCOLink('xyz', 'IFI')).toBeNull();
  });

  it('returns null for unknown brand', () => {
    expect(generateOCOLink('1', 'OTHER')).toBeNull();
  });

  it('builds URL with webinar_id, z=ifi for IFI, and Hermes macro query values', () => {
    const url = generateOCOLink('87824207928', 'IFI');
    expect(url).toContain(`${OCO_BASE}?`);
    expect(url).toContain('webinar_id=87824207928');
    expect(url).toContain('z=ifi');
    expect(url).toContain('fn={{firstName}}');
    expect(url).toContain('ln={{lastName}}');
    expect(url).toContain('email={{email}}');
    expect(url).toContain('ph={{phone}}');
  });

  it('adds z=ttt for TTT brand', () => {
    const url = generateOCOLink('87824207928', 'TTT');
    expect(url).toContain('z=ttt');
  });

  it('normalizes pasted webinar id before building', () => {
    const url = generateOCOLink('878-242-07928', 'IFI');
    expect(url).toContain('webinar_id=87824207928');
  });

  it('keeps braces unencoded in output (decodeURIComponent round-trip)', () => {
    const url = generateOCOLink('1', 'IFI');
    expect(url).toMatch(/\{\{firstName\}\}/);
    expect(url).not.toContain('%7B%7BfirstName%7D%7D');
  });

  it('exports both brand keys', () => {
    expect(OCO_BRANDS).toEqual(['IFI', 'TTT']);
  });
});
