import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUniqueUserMock = vi.hoisted(() => vi.fn())
const queryRawMock = vi.hoisted(() => vi.fn())
const executeRawMock = vi.hoisted(() => vi.fn())
const findManyShortlinkMock = vi.hoisted(() => vi.fn())
const findManyCampaignMock = vi.hoisted(() => vi.fn())
const costReportDayFindManyMock = vi.hoisted(() => vi.fn())
const costReportDayUpsertMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: findUniqueUserMock },
    $queryRaw: queryRawMock,
    $executeRaw: executeRawMock,
    $transaction: (ops) => Promise.all(ops),
    shortlink: { findMany: findManyShortlinkMock },
    campaign: { findMany: findManyCampaignMock },
    costReportDay: { findMany: costReportDayFindManyMock, upsert: costReportDayUpsertMock }
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
    costReportDayFindManyMock.mockResolvedValue([])
    costReportDayUpsertMock.mockResolvedValue({})
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
    queryRawMock.mockResolvedValueOnce([
      // combined single-scan rows: (send_id, campaign_id, date) grain
      { send_id: 150, campaign_id: 3, date: '2026-07-13', message_count: 60, billed_count: 59, parts: 60, total_cost: 1.0 },
      { send_id: 150, campaign_id: null, date: '2026-07-13', message_count: 40, billed_count: 39, parts: 40, total_cost: 0.23 },
      { send_id: null, campaign_id: 7, date: '2026-07-13', message_count: 5, billed_count: 5, parts: 5, total_cost: 0.05 },
      { send_id: null, campaign_id: 8, date: '2026-07-13', message_count: 9, billed_count: 0, parts: 9, total_cost: 0 }
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
        message_count: 100, // 60 + 40 collapsed across campaign split
        billed_count: 98,
        parts: 100,
        total_cost: 1.23,
        nickname: 'JLL',
        campaign_id: 3,
        campaign_name: 'JLL Blast'
      }
    ])
    // zero-cost link-less rows (campaign 8) must NOT appear in unattributed
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

  it('persists a computed settled day to the durable cache', async () => {
    findUniqueUserMock.mockResolvedValueOnce({ id: 'user_a' })
    const dayRows = [
      { send_id: 9, campaign_id: 1, date: '2026-07-13', message_count: 2, billed_count: 2, parts: 2, total_cost: 0.02 }
    ]
    queryRawMock.mockResolvedValueOnce(dayRows)
    findManyShortlinkMock.mockResolvedValueOnce([])
    findManyCampaignMock.mockResolvedValueOnce([])

    const res = await GET({ url: 'https://x.test/api/cost-report?key=k&date=2026-07-13' })
    expect(res.status).toBe(200)
    expect(costReportDayUpsertMock).toHaveBeenCalledTimes(1)
    expect(costReportDayUpsertMock.mock.calls[0][0]).toMatchObject({
      where: { userId_day: { userId: 'user_a', day: '2026-07-13' } },
      create: { userId: 'user_a', day: '2026-07-13', body: { rows: dayRows } }
    })
  })

  it('serves a cached settled day without running the day query', async () => {
    findUniqueUserMock.mockResolvedValueOnce({ id: 'user_a' })
    costReportDayFindManyMock.mockResolvedValueOnce([
      {
        day: '2026-07-13',
        body: {
          rows: [
            { send_id: 150, campaign_id: 3, date: '2026-07-13', message_count: 10, billed_count: 10, parts: 10, total_cost: 0.10 }
          ]
        }
      }
    ])
    findManyShortlinkMock.mockResolvedValueOnce([
      { id: 150, nickname: 'JLL', campaign: { id: 3, name: 'JLL Blast' } }
    ])
    findManyCampaignMock.mockResolvedValueOnce([])

    const res = await GET({ url: 'https://x.test/api/cost-report?key=k&date=2026-07-13' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rows).toHaveLength(1)
    expect(body.rows[0].total_cost).toBe(0.10)
    expect(queryRawMock).not.toHaveBeenCalled()
    expect(costReportDayUpsertMock).not.toHaveBeenCalled()
  })

  it('recomputes cached days when refresh=1 and overwrites the cache', async () => {
    findUniqueUserMock.mockResolvedValueOnce({ id: 'user_a' })
    queryRawMock.mockResolvedValueOnce([
      { send_id: 150, campaign_id: 3, date: '2026-07-13', message_count: 11, billed_count: 11, parts: 11, total_cost: 0.11 }
    ])
    findManyShortlinkMock.mockResolvedValueOnce([])
    findManyCampaignMock.mockResolvedValueOnce([])

    const res = await GET({ url: 'https://x.test/api/cost-report?key=k&date=2026-07-13&refresh=1' })
    expect(res.status).toBe(200)
    expect(costReportDayFindManyMock).not.toHaveBeenCalled()
    expect(queryRawMock).toHaveBeenCalledTimes(1)
    expect(costReportDayUpsertMock).toHaveBeenCalledTimes(1)
  })

  it('does not durably cache an unsettled (current) day', async () => {
    findUniqueUserMock.mockResolvedValueOnce({ id: 'user_a' })
    const today = new Date().toISOString().slice(0, 10)
    // no shortlink/campaign findMany mocks: empty day rows -> name lookups skipped
    // (queuing unconsumed mockResolvedValueOnce values here would leak into later tests)
    queryRawMock.mockResolvedValueOnce([])

    const res = await GET({ url: `https://x.test/api/cost-report?key=k&date=${today}` })
    expect(res.status).toBe(200)
    expect(costReportDayFindManyMock).not.toHaveBeenCalled() // no settled days to look up
    expect(costReportDayUpsertMock).not.toHaveBeenCalled()
  })

  it('falls back to sub-day chunks when the day query hits the statement timeout', async () => {
    findUniqueUserMock.mockResolvedValueOnce({ id: 'user_a' })
    const timeoutError = Object.assign(new Error('canceling statement due to statement timeout'), {
      code: 'P2010',
      meta: { code: '57014' }
    })
    // full-day attempt times out, then 6 chunk queries succeed
    queryRawMock.mockRejectedValueOnce(timeoutError)
    for (let i = 0; i < 6; i++) {
      queryRawMock.mockResolvedValueOnce(
        i < 2
          ? [{ send_id: 150, campaign_id: 3, date: '2026-07-07', message_count: 10, billed_count: 10, parts: 10, total_cost: 0.10 }]
          : []
      )
    }
    findManyShortlinkMock.mockResolvedValueOnce([
      { id: 150, nickname: 'JLL', campaign: { id: 3, name: 'JLL Blast' } }
    ])
    findManyCampaignMock.mockResolvedValueOnce([])

    const res = await GET({ url: 'https://x.test/api/cost-report?key=k&date=2026-07-07' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(queryRawMock).toHaveBeenCalledTimes(7) // 1 failed full-day + 6 chunks
    // chunk rows merged: 2 chunks x 10 messages collapse into one day row
    expect(body.rows).toEqual([
      {
        send_id: 150,
        date: '2026-07-07',
        message_count: 20,
        billed_count: 20,
        parts: 20,
        total_cost: 0.2,
        nickname: 'JLL',
        campaign_id: 3,
        campaign_name: 'JLL Blast'
      }
    ])
    // merged chunk rows are what gets durably cached
    expect(costReportDayUpsertMock).toHaveBeenCalledTimes(1)
    expect(costReportDayUpsertMock.mock.calls[0][0].create.body.rows).toHaveLength(2)
  })

  it('does not chunk on non-timeout errors', async () => {
    findUniqueUserMock.mockResolvedValueOnce({ id: 'user_a' })
    queryRawMock.mockRejectedValueOnce(Object.assign(new Error('connection refused'), { code: 'P1001' }))

    const res = await GET({ url: 'https://x.test/api/cost-report?key=k&date=2026-07-07' })
    expect(res.status).toBe(500)
    expect(queryRawMock).toHaveBeenCalledTimes(1)
    expect(costReportDayUpsertMock).not.toHaveBeenCalled()
  })

  it('mixes cached and computed days across a multi-day window', async () => {
    findUniqueUserMock.mockResolvedValueOnce({ id: 'user_a' })
    costReportDayFindManyMock.mockResolvedValueOnce([
      {
        day: '2026-07-13',
        body: {
          rows: [{ send_id: 150, campaign_id: 3, date: '2026-07-13', message_count: 5, billed_count: 5, parts: 5, total_cost: 0.05 }]
        }
      }
    ])
    // only the uncached day (2026-07-14) hits the DB
    queryRawMock.mockResolvedValueOnce([
      { send_id: 150, campaign_id: 3, date: '2026-07-14', message_count: 7, billed_count: 7, parts: 7, total_cost: 0.07 }
    ])
    findManyShortlinkMock.mockResolvedValueOnce([
      { id: 150, nickname: 'JLL', campaign: { id: 3, name: 'JLL Blast' } }
    ])
    findManyCampaignMock.mockResolvedValueOnce([])

    const res = await GET({ url: 'https://x.test/api/cost-report?key=k&start=2026-07-13&end=2026-07-14' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(queryRawMock).toHaveBeenCalledTimes(1)
    expect(costReportDayUpsertMock).toHaveBeenCalledTimes(1) // only the computed day
    expect(body.rows.map((r) => r.date).sort()).toEqual(['2026-07-13', '2026-07-14'])
  })
})
