import { describe, it, expect } from 'vitest';
import {
  expandShortlinkDestinationMacros,
  MACRO_KEY_ALLOWLIST,
  destinationTemplateUsesMacros,
  destinationHasUnresolvedMacroSyntax,
} from './shortlinkDestinationMacros';

describe('expandShortlinkDestinationMacros', () => {
  const contact = {
    id: 42,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '+1 (555) 010-00',
    source: 'fb',
    age: '31',
  };

  it('returns destination unchanged when expand is false', () => {
    const dest = 'https://x.com/?n={{firstName}}';
    expect(
      expandShortlinkDestinationMacros(dest, contact, { expand: false })
    ).toBe(dest);
  });

  it('replaces allowlisted keys and URL-encodes values', () => {
    const out = expandShortlinkDestinationMacros(
      'https://x.com/?fn={{firstName}}&ph={{phone}}',
      contact,
      { expand: true }
    );
    expect(out).toBe(
      `https://x.com/?fn=${encodeURIComponent('Jane')}&ph=${encodeURIComponent('+1 (555) 010-00')}`
    );
  });

  it('builds fullName from first and last', () => {
    expect(
      expandShortlinkDestinationMacros('https://x.com/?n={{fullName}}', contact)
    ).toBe(`https://x.com/?n=${encodeURIComponent('Jane Doe')}`);
  });

  it('stringifies id', () => {
    expect(expandShortlinkDestinationMacros('https://x.com/{{id}}', contact)).toBe(
      `https://x.com/${encodeURIComponent('42')}`
    );
  });

  it('uses empty string for missing optional fields', () => {
    const sparse = { id: 1, phone: '+1000' };
    expect(
      expandShortlinkDestinationMacros(
        'https://x.com/?a={{firstName}}&b={{lastName}}',
        sparse
      )
    ).toBe('https://x.com/?a=&b=');
  });

  it('leaves unknown {{tokens}} unchanged', () => {
    const dest = 'https://x.com/?x={{unknown}}&y={{firstName}}';
    expect(expandShortlinkDestinationMacros(dest, contact)).toBe(
      `https://x.com/?x={{unknown}}&y=${encodeURIComponent('Jane')}`
    );
  });

  it('handles null contact with empty expansions for known keys', () => {
    expect(
      expandShortlinkDestinationMacros('https://x.com/?p={{phone}}&f={{firstName}}', null)
    ).toBe('https://x.com/?p=&f=');
  });

  it('returns empty string for empty destination', () => {
    expect(expandShortlinkDestinationMacros('', contact)).toBe('');
  });

  it('documents allowlisted keys (regression guard)', () => {
    expect(MACRO_KEY_ALLOWLIST.has('firstName')).toBe(true);
    expect(MACRO_KEY_ALLOWLIST.has('tags')).toBe(false);
  });

  it('destinationTemplateUsesMacros detects placeholders', () => {
    expect(destinationTemplateUsesMacros('https://x.com/?a={{firstName}}')).toBe(true);
    expect(destinationTemplateUsesMacros('https://x.com/')).toBe(false);
  });

  it('destinationHasUnresolvedMacroSyntax after partial expansion', () => {
    expect(destinationHasUnresolvedMacroSyntax('https://x.com/{{unknown}}')).toBe(true);
    expect(destinationHasUnresolvedMacroSyntax('https://x.com/?n=Jane')).toBe(false);
  });
});
