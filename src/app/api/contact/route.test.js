import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  const state = { rows: [] };
  return {
    state,
    contact: {
      findFirst: async ({ where }) => state.rows.find(row =>
        row.userId === where.userId &&
        (where.phone === undefined || row.phone === where.phone) &&
        (where.id === undefined || (typeof where.id === 'object' ? row.id !== where.id.not : row.id === where.id))) || null,
      update: async ({ where, data }) => {
        const row = state.rows.find(row => row.id === where.id);
        for (const [key, value] of Object.entries(data)) if (value !== undefined) row[key] = value;
        return row;
      },
    },
  };
});
vi.mock('@/lib/prisma', () => ({ default: { contact: db.contact } }));
vi.mock('@/lib/auth', () => ({ auth: async () => ({ user: { id: 'tenant-a' } }) }));
vi.mock('@/lib/workflow/executor', () => ({ triggerWorkflowsForContact: vi.fn() }));
import { POST, PUT } from './route';
const request = data => new Request('http://localhost/api/contact', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data),
});

beforeEach(() => {
  db.state.rows = [
    { id: 1, userId: 'tenant-a', phone: '+442079460958', firstName: 'Old', email: 'keep@example.com', clickid: [], tags: [], assignedPhoneNumberId: 9 },
    { id: 2, userId: 'tenant-b', phone: '+442079460958', firstName: 'Unrelated', clickid: [], tags: [], assignedPhoneNumberId: 9 },
  ];
});

describe('contact API canonical identity', () => {
  it('updates the existing international contact within its tenant rather than treating formatted input as a new identity', async () => {
    const response = await POST(request({ phone: '+44 (20) 7946-0958', firstName: 'Updated' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: 1, phone: '+442079460958', firstName: 'Updated', email: 'keep@example.com' });
    expect(db.state.rows[1].firstName).toBe('Unrelated');
  });

  it.each([['POST', POST], ['PUT', PUT]])('%s rejects a supplied invalid phone without changing stored contact data', async (_name, handler) => {
    const response = await handler(request({ id: 1, phone: '+999 123456789', firstName: 'Corrupted' }));
    expect(response.status).toBe(400);
    expect(db.state.rows[0]).toMatchObject({ phone: '+442079460958', firstName: 'Old' });
  });
});
