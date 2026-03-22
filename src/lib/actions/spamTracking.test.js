import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  spamFilterEvent: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  message: {
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
}));

const authMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  default: prismaMock,
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

import { getSpamRateAnalyticsForUser, trackSpamFilterEvent } from './spamTracking';

describe('spamTracking actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks spam event and ignores duplicate idempotent inserts', async () => {
    prismaMock.spamFilterEvent.create.mockResolvedValueOnce({ id: 1 });

    const created = await trackSpamFilterEvent({
      userId: 'user_1',
      providerMessageId: 'msg_1',
      toNumber: '+15555550100',
      occurredAt: '2026-03-22T10:00:00.000Z',
    });

    expect(created).toEqual({ id: 1 });

    const duplicateError = new Error('duplicate');
    duplicateError.code = 'P2002';
    prismaMock.spamFilterEvent.create.mockRejectedValueOnce(duplicateError);

    const duplicate = await trackSpamFilterEvent({
      userId: 'user_1',
      providerMessageId: 'msg_1',
      toNumber: '+15555550100',
      occurredAt: '2026-03-22T10:00:00.000Z',
    });

    expect(duplicate).toBeNull();
  });

  it('returns grouped spam analytics by campaign, sender, and day', async () => {
    prismaMock.spamFilterEvent.findMany.mockResolvedValueOnce([
      {
        id: 1,
        campaignId: 81,
        fromNumber: '+10000000001',
        toNumber: '+15555550100',
        occurredAt: '2026-03-22T10:00:00.000Z',
        campaign: { id: 81, name: 'carsontest' },
      },
      {
        id: 2,
        campaignId: 81,
        fromNumber: '+10000000001',
        toNumber: '+15555550101',
        occurredAt: '2026-03-22T12:00:00.000Z',
        campaign: { id: 81, name: 'carsontest' },
      },
    ]);
    prismaMock.message.count.mockResolvedValueOnce(10);
    prismaMock.message.groupBy
      .mockResolvedValueOnce([{ campaignId: 81, _count: 5 }])
      .mockResolvedValueOnce([{ from: '+10000000001', _count: 8 }]);
    prismaMock.message.findMany.mockResolvedValueOnce([
      { createdAt: '2026-03-22T09:00:00.000Z' },
      { createdAt: '2026-03-22T09:30:00.000Z' },
      { createdAt: '2026-03-22T11:00:00.000Z' },
    ]);

    const result = await getSpamRateAnalyticsForUser('user_1', 'today', 10);

    expect(result.summary.spamCount).toBe(2);
    expect(result.summary.outboundCount).toBe(10);
    expect(result.byCampaign[0]).toMatchObject({
      campaignId: 81,
      campaignName: 'carsontest',
      spamCount: 2,
      outboundCount: 5,
    });
    expect(result.bySender[0]).toMatchObject({
      senderNumber: '+10000000001',
      spamCount: 2,
      outboundCount: 8,
    });
    expect(result.byDay[0]).toMatchObject({
      day: '2026-03-22',
      spamCount: 2,
      outboundCount: 3,
    });
  });
});
