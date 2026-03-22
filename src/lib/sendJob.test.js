import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  sendJob: {
    updateMany: vi.fn(),
    findMany: vi.fn()
  }
}))

vi.mock('@/lib/prisma', () => ({
  default: prismaMock
}))

import { claimAndStartJob, getPendingJobs, recoverStaleSendJobs } from './sendJob'

describe('sendJob scheduler safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('claims a pending job atomically', async () => {
    prismaMock.sendJob.updateMany.mockResolvedValueOnce({ count: 1 })

    const claimed = await claimAndStartJob('job_1')

    expect(claimed).toBe(true)
    expect(prismaMock.sendJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job_1', status: 'pending' },
        data: expect.objectContaining({ status: 'processing' })
      })
    )
  })

  it('recovers stale processing scheduled jobs back to pending', async () => {
    prismaMock.sendJob.updateMany.mockResolvedValueOnce({ count: 2 })

    const recovered = await recoverStaleSendJobs(60_000)

    expect(recovered).toBe(2)
    expect(prismaMock.sendJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'processing',
          scheduledAt: { not: null },
          completedAt: null
        }),
        data: expect.objectContaining({
          status: 'pending',
          startedAt: null
        })
      })
    )
  })

  it('only pulls scheduled pending jobs due now', async () => {
    prismaMock.sendJob.updateMany.mockResolvedValueOnce({ count: 0 }) // recovery pass
    prismaMock.sendJob.findMany.mockResolvedValueOnce([{ id: 'job_due' }])

    const jobs = await getPendingJobs(5)

    expect(jobs).toEqual([{ id: 'job_due' }])
    expect(prismaMock.sendJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'pending',
          scheduledAt: expect.objectContaining({
            not: null,
            lte: expect.any(Date)
          })
        }),
        take: 5
      })
    )
  })
})
