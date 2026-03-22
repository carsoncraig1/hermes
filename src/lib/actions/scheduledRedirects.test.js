import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  scheduledShortlinkRedirect: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn()
  },
  shortlink: {
    update: vi.fn()
  }
}))

vi.mock('@/lib/prisma', () => ({
  default: prismaMock
}))

import { processScheduledRedirects } from './scheduledRedirects'

describe('scheduledRedirects scheduler safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('processes claimed redirects and marks completion', async () => {
    prismaMock.scheduledShortlinkRedirect.findMany.mockResolvedValueOnce([
      {
        id: 1,
        shortlinkId: 9,
        newDestination: 'https://example.com/new',
        shortlink: { id: 9, destination: 'https://old.example', nickname: 'promo', slug: 'abc' }
      }
    ])
    prismaMock.scheduledShortlinkRedirect.updateMany.mockResolvedValueOnce({ count: 1 })
    prismaMock.shortlink.update.mockResolvedValueOnce({})
    prismaMock.scheduledShortlinkRedirect.update.mockResolvedValueOnce({})

    const results = await processScheduledRedirects()

    expect(results).toEqual([{ id: 1, shortlinkId: 9, status: 'completed' }])
    expect(prismaMock.scheduledShortlinkRedirect.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, status: 'pending' },
        data: { status: 'processing' }
      })
    )
    expect(prismaMock.shortlink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 9 },
        data: { destination: 'https://example.com/new' }
      })
    )
  })

  it('skips redirects already claimed by another worker', async () => {
    prismaMock.scheduledShortlinkRedirect.findMany.mockResolvedValueOnce([
      {
        id: 2,
        shortlinkId: 4,
        newDestination: 'https://example.com/other',
        shortlink: { id: 4, destination: 'https://old.example', nickname: null, slug: 'xyz' }
      }
    ])
    prismaMock.scheduledShortlinkRedirect.updateMany.mockResolvedValueOnce({ count: 0 })

    const results = await processScheduledRedirects()

    expect(results).toEqual([])
    expect(prismaMock.shortlink.update).not.toHaveBeenCalled()
    expect(prismaMock.scheduledShortlinkRedirect.update).not.toHaveBeenCalled()
  })
})
