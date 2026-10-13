import { describe, it, expect, vi, beforeEach } from 'vitest';
const db = vi.hoisted(() => ({ shortlink: {findMany: vi.fn()}, messageClickCode: { createMany: vi.fn() } }));
vi.mock('@/lib/prisma', () => ({default:db}));
import {createMessageClickCodes, createMessageClickCodesBatch} from './messageClickCodes';
beforeEach(() => { vi.clearAllMocks(); db.shortlink.findMany.mockResolvedValue([{id:1},{id:2}]); db.messageClickCode.createMany.mockResolvedValue({count:4}); });
describe('all recipient link producers share dynamic click-code resolution', () => {
  it('single-send/journey producer retains recipient and tenant for every link', async () => {
    const result = await createMessageClickCodes('msg-test', '{{SHORTLINK:1}} and {{SHORTLINK:2}}', 3, 'tenant-a');
    expect(result.codes).toHaveLength(2);
    for (const row of result.codes) expect(row).toMatchObject({contactId:3,userId:'tenant-a',messageId:'msg-test'});
    expect(result.modifiedText.match(/https:\/\/txt\.cx\/[a-zA-Z0-9]{6}/g)).toHaveLength(2);
    expect(result.modifiedText).not.toContain('phone='); // runtime enrichment, not frozen recipient URL
    expect(db.shortlink.findMany.mock.calls[0][0].where.userId).toBe('tenant-a');
  });
  it('broadcast producer generates independent codes for multiple links and recipients', async () => {
    const result = await createMessageClickCodesBatch('{{SHORTLINK:1}} {{SHORTLINK:2}}', [{contactId:3,messageId:'a'},{contactId:4,messageId:'b'}], 'tenant-a');
    const rows = db.messageClickCode.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map(r => r.code)).size).toBe(4);
    expect(rows.filter(r => r.contactId===3)).toHaveLength(2);
    expect(rows.filter(r => r.contactId===4)).toHaveLength(2);
    expect(result.size).toBe(2);
    for (const row of rows) expect(result.get(row.contactId)).toContain('https://txt.cx/'+row.code);
  });
});
