import { beforeEach, describe, expect, it, vi } from 'vitest'

const getPendingJobsMock = vi.hoisted(() => vi.fn())
const processDelayedActionsMock = vi.hoisted(() => vi.fn())
const processScheduledRedirectsMock = vi.hoisted(() => vi.fn())
const executeDedicatedSendMock = vi.hoisted(() => vi.fn())
const executeManualFireMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/sendJob', () => ({
  getPendingJobs: getPendingJobsMock
}))

vi.mock('@/lib/delayedWorkflow', () => ({
  processDelayedActions: processDelayedActionsMock
}))

vi.mock('@/lib/actions/scheduledRedirects', () => ({
  processScheduledRedirects: processScheduledRedirectsMock
}))

vi.mock('@/lib/actions/campaigns', () => ({
  executeDedicatedSend: executeDedicatedSendMock,
  executeManualFire: executeManualFireMock
}))

import { GET } from './route'

describe('/api/jobs/process route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JOB_PROCESSOR_SECRET = 'test-secret'
  })

  it('rejects unauthorized requests', async () => {
    const response = await GET({ url: 'https://example.com/api/jobs/process?secret=wrong' })

    expect(response.status).toBe(401)
  })

  it('passes queued user context into dedicated and manual job execution', async () => {
    processDelayedActionsMock.mockResolvedValueOnce(undefined)
    processScheduledRedirectsMock.mockResolvedValueOnce([])
    getPendingJobsMock.mockResolvedValueOnce([
      {
        id: 'job_dedicated',
        userId: 'user_a',
        campaignId: 10,
        jobType: 'dedicated_send'
      },
      {
        id: 'job_manual',
        userId: 'user_b',
        campaignId: 20,
        jobType: 'manual_fire',
        metadata: {
          selectedTags: ['vip'],
          selectedSources: ['webform'],
          targetAllSubscribed: false
        }
      }
    ])
    executeDedicatedSendMock.mockResolvedValueOnce({ success: true })
    executeManualFireMock.mockResolvedValueOnce({ success: true })

    const response = await GET({ url: 'https://example.com/api/jobs/process?secret=test-secret' })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(executeDedicatedSendMock).toHaveBeenCalledWith(10, null, 'job_dedicated', 'user_a')
    expect(executeManualFireMock).toHaveBeenCalledWith(
      20,
      {
        selectedTags: ['vip'],
        selectedSources: ['webform'],
        targetAllSubscribed: false
      },
      'job_manual',
      'user_b'
    )
  })
})
