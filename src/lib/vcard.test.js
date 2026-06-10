import { describe, it, expect } from 'vitest'
import {
  buildVCard,
  buildVCardBuffer,
  deriveFullName,
  looksLikeVCard,
  defaultLabel,
  VCARD_CONTENT_TYPE,
} from '@/lib/vcard'

describe('deriveFullName', () => {
  it('prefers explicit fullName', () => {
    expect(deriveFullName({ fullName: 'Ada Lovelace', firstName: 'X' })).toBe('Ada Lovelace')
  })
  it('joins first and last', () => {
    expect(deriveFullName({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace')
  })
  it('falls back to org', () => {
    expect(deriveFullName({ org: 'Analytical Engines' })).toBe('Analytical Engines')
  })
  it('returns empty string when nothing usable', () => {
    expect(deriveFullName({})).toBe('')
  })
})

describe('buildVCard', () => {
  it('produces a well-formed 3.0 vCard', () => {
    const card = buildVCard({
      firstName: 'Ada',
      lastName: 'Lovelace',
      org: 'Analytical Engines',
      title: 'Mathematician',
      phones: ['+15551234567'],
      emails: ['ada@example.com'],
      url: 'https://example.com',
      note: 'Hello',
    })
    expect(card).toMatch(/^BEGIN:VCARD\r\n/)
    expect(card).toContain('VERSION:3.0')
    expect(card).toContain('N:Lovelace;Ada;;;')
    expect(card).toContain('FN:Ada Lovelace')
    expect(card).toContain('ORG:Analytical Engines')
    expect(card).toContain('TITLE:Mathematician')
    expect(card).toContain('TEL;TYPE=CELL:+15551234567')
    expect(card).toContain('EMAIL;TYPE=INTERNET:ada@example.com')
    expect(card).toContain('URL:https://example.com')
    expect(card).toContain('NOTE:Hello')
    expect(card.trimEnd().endsWith('END:VCARD')).toBe(true)
    expect(looksLikeVCard(card)).toBe(true)
  })

  it('uses CRLF line endings', () => {
    const card = buildVCard({ fullName: 'Test User' })
    const lines = card.split('\r\n')
    expect(lines[0]).toBe('BEGIN:VCARD')
    expect(lines[1]).toBe('VERSION:3.0')
  })

  it('escapes special characters (comma, semicolon, backslash, newline)', () => {
    const card = buildVCard({ fullName: 'Acme, Inc.; R&D', note: 'line1\nline2\\end' })
    expect(card).toContain('FN:Acme\\, Inc.\\; R&D')
    expect(card).toContain('NOTE:line1\\nline2\\\\end')
  })

  it('throws when no name/org can be derived', () => {
    expect(() => buildVCard({ note: 'orphan' })).toThrow()
  })

  it('supports structured phone/email entries with custom types', () => {
    const card = buildVCard({
      fullName: 'Multi Contact',
      phones: [{ number: '+15550001111', type: 'work' }, '+15552223333'],
      emails: [{ address: 'work@example.com', type: 'work' }],
    })
    expect(card).toContain('TEL;TYPE=WORK:+15550001111')
    expect(card).toContain('TEL;TYPE=CELL:+15552223333')
    expect(card).toContain('EMAIL;TYPE=WORK:work@example.com')
  })

  it('skips empty phone/email entries', () => {
    const card = buildVCard({ fullName: 'Sparse', phones: ['', '   '], emails: [''] })
    expect(card).not.toContain('TEL')
    expect(card).not.toContain('EMAIL')
  })

  it('folds long lines at 75 octets with space continuation', () => {
    const longNote = 'x'.repeat(200)
    const card = buildVCard({ fullName: 'Folder', note: longNote })
    for (const line of card.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75)
    }
    // Continuation lines begin with a single space
    expect(card).toMatch(/\r\n /)
  })
})

describe('buildVCardBuffer', () => {
  it('returns a UTF-8 Buffer matching buildVCard', () => {
    const data = { fullName: 'Buffer Test', phones: ['+15551112222'] }
    const buf = buildVCardBuffer(data)
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.toString('utf8')).toBe(buildVCard(data))
  })
})

describe('looksLikeVCard', () => {
  it('accepts a real vCard', () => {
    expect(looksLikeVCard('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:X\r\nEND:VCARD\r\n')).toBe(true)
  })
  it('rejects junk', () => {
    expect(looksLikeVCard('not a vcard')).toBe(false)
    expect(looksLikeVCard('')).toBe(false)
    expect(looksLikeVCard(null)).toBe(false)
  })
})

describe('defaultLabel', () => {
  it('derives from name', () => {
    expect(defaultLabel({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace')
  })
  it('falls back to a generic label', () => {
    expect(defaultLabel({})).toBe('Contact card')
  })
})

describe('constants', () => {
  it('exposes the vcard content type', () => {
    expect(VCARD_CONTENT_TYPE).toBe('text/vcard')
  })
})
