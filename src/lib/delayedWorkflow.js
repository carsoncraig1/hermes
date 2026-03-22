'use server'

import prisma from '@/lib/prisma'
import { executeWorkflow } from '@/lib/workflow/executor'

const STALE_DELAYED_ACTION_TIMEOUT_MS = 15 * 60 * 1000

/**
 * Schedule a delayed workflow action
 * @param {Object} params - Action parameters
 * @returns {Promise<Object>} - Created delayed action
 */
export async function scheduleDelayedWorkflowAction({
  userId,
  campaignId,
  contactId,
  workflow,
  currentNodeId,
  delayMs
}) {
  const executeAt = new Date(Date.now() + delayMs)
  
  return await prisma.delayedWorkflowAction.create({
    data: {
      userId,
      campaignId,
      contactId,
      workflow,
      currentNodeId,
      executeAt,
      status: 'pending'
    }
  })
}

/**
 * Get actions ready to execute (executeAt <= now)
 * @param {number} limit - Maximum number of actions to return
 * @returns {Promise<Array>} - Array of actions ready to execute
 */
export async function getReadyDelayedActions(limit = 100) {
  await recoverStaleDelayedActions()
  const now = new Date()
  
  return await prisma.delayedWorkflowAction.findMany({
    where: {
      status: 'pending',
      executeAt: { lte: now }
    },
    orderBy: {
      executeAt: 'asc'
    },
    take: limit,
    include: {
      contact: true
    }
  })
}

/**
 * Recover stale delayed actions stuck in processing
 * @param {number} staleMs - Maximum processing age before recovery
 * @returns {Promise<number>} - Number of actions recovered
 */
export async function recoverStaleDelayedActions(staleMs = STALE_DELAYED_ACTION_TIMEOUT_MS) {
  const staleBefore = new Date(Date.now() - staleMs)
  const result = await prisma.delayedWorkflowAction.updateMany({
    where: {
      status: 'processing',
      updatedAt: { lte: staleBefore }
    },
    data: {
      status: 'pending',
      errorMessage: `Recovered stale processing action at ${new Date().toISOString()}`,
      retryCount: { increment: 1 }
    }
  })

  if (result.count > 0) {
    console.warn(`Recovered ${result.count} stale delayed actions`)
  }

  return result.count
}

/**
 * Execute a delayed workflow action
 * Uses atomic claiming to prevent race conditions with concurrent processors
 * @param {string} actionId - Action ID
 */
export async function executeDelayedAction(actionId) {
  // ATOMIC: Try to claim the action - only updates if status is still 'pending'
  // This prevents two concurrent processors from both executing the same action
  const claimResult = await prisma.delayedWorkflowAction.updateMany({
    where: {
      id: actionId,
      status: 'pending' // Only claim if still pending
    },
    data: { status: 'processing' }
  })
  
  // If count is 0, action was already claimed by another process
  if (claimResult.count === 0) {
    console.log(`Delayed action ${actionId} already claimed by another process, skipping`)
    return
  }
  
  // Now fetch the action details (we know it's ours)
  const action = await prisma.delayedWorkflowAction.findUnique({
    where: { id: actionId },
    include: { contact: true }
  })
  
  if (!action) {
    console.log(`Delayed action ${actionId} not found after claiming`)
    return
  }
  
  try {
    // Find the node to execute
    const workflow = action.workflow
    const node = workflow.nodes?.find(n => n.id === action.currentNodeId)
    
    if (!node) {
      throw new Error(`Node ${action.currentNodeId} not found in workflow`)
    }
    
    // Resume from the delayed target node (do not replay trigger/previous nodes)
    await executeWorkflow(
      workflow,
      action.contact,
      action.userId,
      action.campaignId,
      { startNodeId: action.currentNodeId }
    )
    
    // Mark as completed
    await prisma.delayedWorkflowAction.update({
      where: { id: actionId },
      data: { status: 'completed' }
    })
  } catch (error) {
    // Mark as failed
    await prisma.delayedWorkflowAction.update({
      where: { id: actionId },
      data: {
        status: 'failed',
        errorMessage: error.message,
        retryCount: { increment: 1 }
      }
    })
    throw error
  }
}

/**
 * Process all ready delayed actions (should be called periodically)
 */
export async function processDelayedActions() {
  const actions = await getReadyDelayedActions(100)
  
  // Process in parallel with limit
  const BATCH_SIZE = 10
  for (let i = 0; i < actions.length; i += BATCH_SIZE) {
    const batch = actions.slice(i, i + BATCH_SIZE)
    await Promise.allSettled(
      batch.map(action => executeDelayedAction(action.id))
    )
  }
}

