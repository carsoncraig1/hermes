import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
vi.mock('@/lib/prisma', () => ({ default: {} }));
import { hashPhone, appendPhoneHashToUrl, appendRecipientIdentityToUrl } from './revenue';

const fixturePhone = '+1 (202) 555-0123';
const fixtureHash = '980239b79aee5c456445907b92af495ac97767f6d9ac081ad3a564344ae7fb9a';

describe('fallback query contract', () => {
  it.each(['/offer', 'offer', '', '//example.com/offer', 'https://example.com/offer', 'http://[invalid', 'not a URL'])('preserves destination prefix and query semantics: %s', (prefix) => {
    const destination = `${prefix}?x=a%2Bb&x=two+words&phone=old&phone=older&phone_hash=old&phone_hash=older#frag?untouched`;
    const result = appendRecipientIdentityToUrl(destination, fixturePhone);
    expect(result.slice(0, result.indexOf('?'))).toBe(prefix);
    const params = new URLSearchParams(result.slice(result.indexOf('?') + 1, result.indexOf('#')));
    expect(params.getAll('phone')).toEqual(['12025550123']);
    expect(params.getAll('phone_hash')).toEqual([fixtureHash]);
    expect(params.getAll('x')).toEqual(['a+b', 'two words']);
    expect(result.slice(result.indexOf('#'))).toBe('#frag?untouched');
    expect(appendRecipientIdentityToUrl(result, fixturePhone)).toBe(result);
  });
  it.each(['/offer', 'offer?x=1#frag', '?x=1#frag', '//example.com/offer#frag'])('enriches bare and relative forms: %s', (destination) => {
    const result = appendRecipientIdentityToUrl(destination, fixturePhone);
    const parsed = new URL(result, 'https://example.com');
    expect(parsed.searchParams.get('phone')).toBe('12025550123');
    expect(parsed.searchParams.get('phone_hash')).toBe(fixtureHash);
    expect(parsed.hash).toBe(destination.includes('#') ? '#frag' : '');
  });
  it.each([null, undefined, '', false, 0])('keeps falsy destinations unchanged: %s', (destination) => {
    expect(appendRecipientIdentityToUrl(destination, fixturePhone)).toBe(destination);
  });
  it.each([null, undefined, '', false, 0])('keeps the URL unchanged with no phone: %s', (phone) => {
    expect(appendRecipientIdentityToUrl('/offer?x=1#frag', phone)).toBe('/offer?x=1#frag');
  });
  it('preserves unsupported phone hashing without adding raw identity', () => {
    const result = appendRecipientIdentityToUrl('/offer#frag', '2025550123');
    const parsed = new URL(result, 'https://example.com');
    expect(parsed.searchParams.get('phone_hash')).toBe(hashPhone('2025550123'));
    expect(parsed.searchParams.has('phone')).toBe(false);
    expect(parsed.hash).toBe('#frag');
  });
  it('encodes fallback hash values as query data, not URL syntax', () => {
    const result = appendPhoneHashToUrl('/offer?x=1#frag', 'a+b &?#');
    const parsed = new URL(result, 'https://example.com');
    expect(parsed.searchParams.get('phone_hash')).toBe('a+b &?#');
    expect(parsed.searchParams.get('x')).toBe('1');
    expect(parsed.hash).toBe('#frag');
  });
});

describe('recipient identity URL', () => {
  it('puts both identities before the fragment on relative destinations', () => {
    const result = appendRecipientIdentityToUrl('/offer?x=1#part', '+1 (202) 555-0123');
    const parsed = new URL(result, 'https://example.com');
    expect(parsed.searchParams.get('phone')).toBe('12025550123');
    expect(parsed.searchParams.get('phone_hash')).toBe('980239b79aee5c456445907b92af495ac97767f6d9ac081ad3a564344ae7fb9a');
    expect(parsed.searchParams.get('x')).toBe('1');
    expect(parsed.hash).toBe('#part');
    expect(result.startsWith('/offer?')).toBe(true);
  });
  it.each([null, undefined, '', 'no digits', '2025550123', '+1 012 155 0123', '12025550123ext9', 12025550123])('does not invent raw identity for unsupported input %s', (phone) => {
    const u = new URL(appendRecipientIdentityToUrl('https://example.com/path#part', phone));
    expect(u.searchParams.has('phone')).toBe(false);
    if (!phone || phone === 'no digits') expect(u.searchParams.has('phone_hash')).toBe(false);
  });
  it('is idempotent and replaces duplicate identity keys without dropping other duplicate keys', () => {
    const dest = 'https://example.com/?phone=old&phone=older&phone_hash=old&phone_hash=older&x=1&x=2#frag';
    const once = appendRecipientIdentityToUrl(dest, '+12025550123');
    expect(appendRecipientIdentityToUrl(once, '+12025550123')).toBe(once);
    const u = new URL(once);
    expect(u.searchParams.getAll('phone')).toEqual(['12025550123']);
    expect(u.searchParams.getAll('phone_hash')).toEqual([hashPhone('+12025550123')]);
    expect(u.searchParams.getAll('x')).toEqual(['1', '2']);
    expect(u.hash).toBe('#frag');
  });
  it('preserves the established digits-only SHA256 contract', () => {
    expect(hashPhone('+1 (202) 555-0123')).toBe(crypto.createHash('sha256').update('12025550123').digest('hex'));
    expect(hashPhone('')).toBeNull();
    expect(hashPhone('no digits')).toBeNull();
  });
  it('adds canonical raw phone alongside the unchanged phone hash', () => {
    const u = new URL(appendRecipientIdentityToUrl('https://example.com/visit?hrms=test&email_hash=unchanged&x=a%2Bb#section', '+1 (202) 555-0123'));
    expect(u.searchParams.get('phone')).toBe('12025550123');
    expect(u.searchParams.get('phone_hash')).toBe(hashPhone('+1 (202) 555-0123'));
    expect(u.searchParams.get('hrms')).toBe('test');
    expect(u.searchParams.get('email_hash')).toBe('unchanged');
    expect(u.searchParams.get('x')).toBe('a+b');
    expect(u.hash).toBe('#section');
  });
});
