import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  sendJob: {
    updateMany: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn()
  }
}))

vi.mock('@/lib/prisma', () => ({
  default: prismaMock
}))

import { claimAndStartJob, getPendingJobs, recoverStaleSendJobs, createSendJob, findActiveSendJobForCampaign } from './sendJob'

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

  it('treats a unique-index violation on claim as "not claimed" (no concurrent send)', async () => {
    prismaMock.sendJob.updateMany.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }))

    const claimed = await claimAndStartJob('job_1')

    expect(claimed).toBe(false)
  })

  it('refuses to create a second active send for a campaign (unique index -> ACTIVE_SEND_EXISTS)', async () => {
    prismaMock.sendJob.create.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }))

    await expect(
      createSendJob({ userId: 'u', campaignId: 152, jobType: 'dedicated_send', totalContacts: 1, totalBatches: 1, startImmediately: true })
    ).rejects.toMatchObject({ code: 'ACTIVE_SEND_EXISTS' })
  })

  it('finds an in-flight (pending/processing) send for a campaign', async () => {
    prismaMock.sendJob.findFirst.mockResolvedValueOnce({ id: 'job_x', status: 'processing', jobType: 'dedicated_send', createdAt: new Date(0) })

    const active = await findActiveSendJobForCampaign(152)

    expect(active).toMatchObject({ id: 'job_x', status: 'processing' })
    expect(prismaMock.sendJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaignId: 152, status: { in: ['pending', 'processing'] } }
      })
    )
  })

  it('fails stalled processing jobs terminally (heartbeat-based) and never re-queues them', async () => {
    prismaMock.sendJob.updateMany.mockResolvedValueOnce({ count: 2 })

    const recovered = await recoverStaleSendJobs(60_000)

    expect(recovered).toBe(2)
    expect(prismaMock.sendJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'processing',
          scheduledAt: { not: null },
          completedAt: null,
          // staleness must be measured by the heartbeat, not startedAt, so a
          // healthy long-running send is never recovered out from under itself
          updatedAt: { lte: expect.any(Date) }
        }),
        data: expect.objectContaining({
          status: 'failed'
        })
      })
    )
    // must NOT flip back to pending (that is what caused duplicate re-sends)
    const dataArg = prismaMock.sendJob.updateMany.mock.calls[0][0].data
    expect(dataArg.status).not.toBe('pending')
    expect(dataArg).not.toHaveProperty('startedAt')
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
