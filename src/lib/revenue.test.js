import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
vi.mock('@/lib/prisma', () => ({ default: {} }));
import { hashPhone, appendRecipientIdentityToUrl } from './revenue';

describe('recipient identity URL', () => {
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
