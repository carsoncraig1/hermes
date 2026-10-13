import { describe, it, expect, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({
  contact: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
  shortlink: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
  messageClickCode: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
  shortlinkClick: { create: vi.fn().mockResolvedValue({}) },
  lookup: vi.fn(), opened: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ default: { ...mocks, $transaction: async fn => fn(mocks) } }));
vi.mock('@/lib/messageClickCodes', () => ({ lookupMessageClickCode: mocks.lookup, markCodeAsClicked: vi.fn(), markCodeAsOpened: mocks.opened }));
vi.mock('next/navigation', () => ({ redirect: (url) => { throw Object.assign(new Error('redirect'), { digest: 'NEXT_REDIRECT', url }); } }));
import { GET } from './route';
import { hashPhone } from '@/lib/revenue';
const destination = 'https://example.com/visit?email_hash=keep&x=a%2Bb#part';
let shortlink;
beforeEach(() => {
  vi.clearAllMocks();
  shortlink = { id: 1, userId: 'tenant-a', destination, enabled: true, clicks: 0 };
  mocks.lookup.mockResolvedValue({ id: 2, contactId: 3, messageId: 'msg-test', shortlink });
  mocks.contact.findFirst.mockResolvedValue({ id: 3, phone: '+1 (202) 555-0123' });
  mocks.shortlink.findUnique.mockResolvedValue({ ...shortlink, clicks: 1 });
  mocks.messageClickCode.findUnique.mockResolvedValue({ id: 2, contactId: 3, clicked: false });
});
async function invoke(ua = 'test-human', slug = 'testAB') {
  try { return await GET(new Request('https://txt.cx/'+slug, { headers: {'user-agent': ua} }), { params: { slug } }); }
  catch (e) { if (e.digest === 'NEXT_REDIRECT') return new URL(e.url); throw e; }
}
describe('recipient redirect', () => {
  it.each([false, true])('keeps phone in recipient OG navigation, repeat=%s', async (repeat) => {
    shortlink.ogEnabled = true; shortlink.ogImage = '/test.png';
    mocks.messageClickCode.findUnique.mockResolvedValue({id:2,contactId:3,clicked:repeat});
    const response = await invoke();
    const html = await response.text();
    expect(html).toContain('phone=12025550123');
    expect(html).toContain('phone_hash='+hashPhone('+1 (202) 555-0123'));
  });
  it('does not add identity to bot previews', async () => {
    const u = await invoke('TelegramBot');
    expect(u.toString()).toBe(destination);
    expect(mocks.contact.findFirst).not.toHaveBeenCalled();
    expect(mocks.shortlinkClick.create).not.toHaveBeenCalled();
  });
  it('does not invent a recipient for legacy links', async () => {
    const u = await invoke('test-human', 'abc');
    expect(u.toString()).toBe(destination);
    expect(mocks.contact.findFirst).not.toHaveBeenCalled();
  });
  it.each([null, { id: 3, phone: '' }, {id:3,phone:'unknown'}])('omits identity for absent phone or tenant-isolated contact %s', async contact => {
    mocks.contact.findFirst.mockResolvedValue(contact);
    const u = await invoke();
    expect(u.searchParams.has('phone')).toBe(false);
    expect(u.searchParams.has('phone_hash')).toBe(false);
  });
  it('does not enrich unknown codes', async () => {
    mocks.lookup.mockResolvedValue(null);
    const u = await invoke();
    expect(u.searchParams.has('phone')).toBe(false);
    expect(mocks.contact.findFirst).not.toHaveBeenCalled();
  });
  it('enriches repeat clicks without creating another click or HRMS', async () => {
    mocks.messageClickCode.findUnique.mockResolvedValue({id:2,contactId:3,clicked:true});
    const u = await invoke();
    expect(u.searchParams.get('phone')).toBe('12025550123');
    expect(u.searchParams.get('phone_hash')).toBe(hashPhone('+1 (202) 555-0123'));
    expect(u.searchParams.has('hrms')).toBe(false);
    expect(mocks.shortlinkClick.create).not.toHaveBeenCalled();
    expect(mocks.messageClickCode.update).not.toHaveBeenCalled();
  });
  it('enriches the first click without changing attribution fields', async () => {
    const u = await invoke();
    expect(u.searchParams.get('phone')).toBe('12025550123');
    expect(u.searchParams.get('phone_hash')).toBe(hashPhone('+1 (202) 555-0123'));
    expect(u.searchParams.get('hrms')).toMatch(/^hrms_/);
    expect(u.searchParams.get('email_hash')).toBe('keep');
    expect(u.searchParams.get('x')).toBe('a+b');
    expect(u.hash).toBe('#part');
    expect(mocks.shortlinkClick.create).toHaveBeenCalledTimes(1);
    expect(mocks.contact.findFirst.mock.calls[0][0].where).toEqual({id:3,userId:'tenant-a'});
  });
});
