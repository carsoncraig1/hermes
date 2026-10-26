import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  const state = { rows: [], nextId: 10 };
  const contact = {
    findFirst: async ({ where }) => state.rows.find(row => row.id === where.id && row.userId === where.userId) || null,
    findMany: async ({ where }) => state.rows.filter(row => row.userId === where.userId && where.phone.in.includes(row.phone)),
    create: async ({ data }) => {
      const row = { id: state.nextId++, tags: [], ...data };
      state.rows.push(row);
      return row;
    },
    createMany: async ({ data }) => {
      for (const row of data) state.rows.push({ id: state.nextId++, tags: [], ...row });
      return { count: data.length };
    },
    update: async ({ where, data }) => {
      const row = state.rows.find(row => row.id === where.id);
      for (const [key, value] of Object.entries(data)) if (value !== undefined) row[key] = value;
      return row;
    },
  };
  const prisma = { contact, $transaction: async fn => fn(prisma) };
  return { state, prisma };
});
vi.mock('@/lib/prisma', () => ({ default: db.prisma }));
vi.mock('@/lib/auth', () => ({ auth: async () => ({ user: { id: 'tenant-a' } }) }));
import { addContact, updateContact, addContactsBatch } from './contacts';

beforeEach(() => {
  db.state.rows.length = 0;
  db.state.nextId = 10;
});

describe('contact intake phone boundaries', () => {
  it('rejects invalid adds and edits without creating or corrupting a contact', async () => {
    db.state.rows.push({ id: 1, userId: 'tenant-a', phone: '+12025550123', tags: [], subscribed: true });
    await expect(addContact({ phone: '+999 123456789' })).rejects.toThrow('Invalid phone number');
    await expect(updateContact({ id: 1, phone: null })).rejects.toThrow('Invalid phone number');
    expect(db.state.rows).toEqual([{ id: 1, userId: 'tenant-a', phone: '+12025550123', tags: [], subscribed: true }]);
  });

  it('preserves the phone when a partial update only changes subscription state', async () => {
    db.state.rows.push({ id: 1, userId: 'tenant-a', phone: '+442079460958', tags: [], subscribed: true });
    await updateContact({ id: 1, subscribed: false });
    expect(db.state.rows[0]).toMatchObject({ phone: '+442079460958', subscribed: false, unsubscribeReason: 'manual' });
  });

  it('matches canonical contacts before CSV persistence and keeps original error rows across batches', async () => {
    db.state.rows.push({ id: 1, userId: 'tenant-a', phone: '+442079460958', firstName: 'Old', tags: [] });
    const result = await addContactsBatch([
      { phone: '+44 20 7946 0958', firstName: 'Updated' },
      { phone: 'not a phone' },
      { phone: '(202) 555-0123', firstName: 'New' },
      { phone: '+1 202' },
    ], 2);
    expect(result).toMatchObject({ success: 2, failed: 2 });
    expect(result.errors.map(error => error.row)).toEqual([3, 5]);
    expect(db.state.rows.map(({ phone, firstName }) => ({ phone, firstName }))).toEqual([
      { phone: '+442079460958', firstName: 'Updated' },
      { phone: '+12025550123', firstName: 'New' },
    ]);
  });
});
