import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  delayedWorkflowAction: {
    updateMany: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  }
}))

const executeWorkflowMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  default: prismaMock
}))

vi.mock('@/lib/workflow/executor', () => ({
  executeWorkflow: executeWorkflowMock
}))

import { executeDelayedAction, getReadyDelayedActions, recoverStaleDelayedActions } from './delayedWorkflow'

describe('delayedWorkflow scheduler safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resumes delayed action from saved node instead of replaying trigger', async () => {
    prismaMock.delayedWorkflowAction.updateMany.mockResolvedValueOnce({ count: 1 })
    prismaMock.delayedWorkflowAction.findUnique.mockResolvedValueOnce({
      id: 'action_1',
      userId: 'user_1',
      campaignId: 7,
      currentNodeId: 'node_delay_target',
      workflow: { nodes: [{ id: 'node_delay_target', type: 'action' }], edges: [] },
      contact: { id: 10, phone: '+15555550100' }
    })
    executeWorkflowMock.mockResolvedValueOnce(undefined)
    prismaMock.delayedWorkflowAction.update.mockResolvedValueOnce({})

    await executeDelayedAction('action_1')

    expect(executeWorkflowMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ id: 10 }),
      'user_1',
      7,
      { startNodeId: 'node_delay_target' }
    )
    expect(prismaMock.delayedWorkflowAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'action_1' },
        data: { status: 'completed' }
      })
    )
  })

  it('skips execution if another worker already claimed action', async () => {
    prismaMock.delayedWorkflowAction.updateMany.mockResolvedValueOnce({ count: 0 })

    await executeDelayedAction('action_claimed_elsewhere')

    expect(executeWorkflowMock).not.toHaveBeenCalled()
    expect(prismaMock.delayedWorkflowAction.findUnique).not.toHaveBeenCalled()
  })

  it('recovers stale delayed actions and reloads ready pending actions', async () => {
    prismaMock.delayedWorkflowAction.updateMany.mockResolvedValueOnce({ count: 1 }) // recovery
    prismaMock.delayedWorkflowAction.findMany.mockResolvedValueOnce([{ id: 'ready_1' }])

    const actions = await getReadyDelayedActions(25)

    expect(actions).toEqual([{ id: 'ready_1' }])
    expect(prismaMock.delayedWorkflowAction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'pending',
          executeAt: expect.objectContaining({ lte: expect.any(Date) })
        }),
        take: 25
      })
    )
  })

  it('marks old processing actions as pending again', async () => {
    prismaMock.delayedWorkflowAction.updateMany.mockResolvedValueOnce({ count: 3 })

    const recovered = await recoverStaleDelayedActions(120_000)

    expect(recovered).toBe(3)
    expect(prismaMock.delayedWorkflowAction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'processing' }),
        data: expect.objectContaining({
          status: 'pending',
          retryCount: { increment: 1 }
        })
      })
    )
  })
})
