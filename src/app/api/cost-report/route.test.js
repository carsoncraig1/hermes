import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUniqueUserMock = vi.hoisted(() => vi.fn())
const queryRawMock = vi.hoisted(() => vi.fn())
const findManyShortlinkMock = vi.hoisted(() => vi.fn())
const findManyCampaignMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: findUniqueUserMock },
    $queryRaw: queryRawMock,
    shortlink: { findMany: findManyShortlinkMock },
    campaign: { findMany: findManyCampaignMock }
  }
}))

import { GET, parseDateRange } from './route'

describe('parseDateRange', () => {
  const params = (q) => new URL(`https://x.test/?${q}`).searchParams

  it('defaults to yesterday UTC', () => {
    const now = new Date('2026-07-14T10:00:00Z')
    const r = parseDateRange(params(''), now)
    expect(r.start).toBe('2026-07-13')
    expect(r.end).toBe('2026-07-13')
  })

  it('accepts a single date', () => {
    const r = parseDateRange(params('date=2026-07-01'))
    expect(r.start).toBe('2026-07-01')
    expect(r.end).toBe('2026-07-01')
    expect(r.endTsExclusive.toISOString()).toBe('2026-07-02T00:00:00.000Z')
  })

  it('accepts an inclusive start/end range', () => {
    const r = parseDateRange(params('start=2026-07-01&end=2026-07-03'))
    expect(r.startTs.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(r.endTsExclusive.toISOString()).toBe('2026-07-04T00:00:00.000Z')
  })

  it('rejects malformed and inverted ranges', () => {
    expect(parseDateRange(params('date=07/01/2026')).error).toBeTruthy()
    expect(parseDateRange(params('start=2026-07-03')).error).toBeTruthy()
    expect(parseDateRange(params('start=2026-07-03&end=2026-07-01')).error).toBeTruthy()
  })
})

describe('/api/cost-report route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects requests without an API key', async () => {
    const res = await GET({ url: 'https://x.test/api/cost-report' })
    expect(res.status).toBe(401)
  })

  it('rejects invalid API keys', async () => {
    findUniqueUserMock.mockResolvedValueOnce(null)
    const res = await GET({ url: 'https://x.test/api/cost-report?key=bad' })
    expect(res.status).toBe(401)
  })

  it('rejects malformed dates', async () => {
    findUniqueUserMock.mockResolvedValueOnce({ id: 'user_a' })
    const res = await GET({ url: 'https://x.test/api/cost-report?key=k&date=nope' })
    expect(res.status).toBe(400)
  })

  it('returns per-send rows enriched with shortlink + campaign names', async () => {
    findUniqueUserMock.mockResolvedValueOnce({ id: 'user_a' })
    queryRawMock
      .mockResolvedValueOnce([
        { send_id: 150, date: '2026-07-13', message_count: 100, billed_count: 98, parts: 100, total_cost: 1.23 }
      ])
      .mockResolvedValueOnce([
        { campaign_id: 7, date: '2026-07-13', message_count: 5, billed_count: 5, total_cost: 0.05 }
      ])
    findManyShortlinkMock.mockResolvedValueOnce([
      { id: 150, nickname: 'JLL', campaign: { id: 3, name: 'JLL Blast' } }
    ])
    findManyCampaignMock.mockResolvedValueOnce([{ id: 7, name: 'Welcome Flow' }])

    const res = await GET({ url: 'https://x.test/api/cost-report?key=k&date=2026-07-13' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rows).toEqual([
      {
        send_id: 150,
        date: '2026-07-13',
        message_count: 100,
        billed_count: 98,
        parts: 100,
        total_cost: 1.23,
        nickname: 'JLL',
        campaign_id: 3,
        campaign_name: 'JLL Blast'
      }
    ])
    expect(body.unattributed).toEqual([
      {
        campaign_id: 7,
        campaign_name: 'Welcome Flow',
        date: '2026-07-13',
        message_count: 5,
        billed_count: 5,
        total_cost: 0.05
      }
    ])
    expect(body.currency).toBe('USD')
  })
})
