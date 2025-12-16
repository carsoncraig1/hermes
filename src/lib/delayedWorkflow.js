'use server'

import prisma from '@/lib/prisma'
import { executeWorkflow } from '@/lib/workflow/executor'

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
 * Execute a delayed workflow action
 * @param {string} actionId - Action ID
 */
export async function executeDelayedAction(actionId) {
  const action = await prisma.delayedWorkflowAction.findUnique({
    where: { id: actionId },
    include: { contact: true }
  })
  
  if (!action || action.status !== 'pending') {
    return
  }
  
  // Mark as processing
  await prisma.delayedWorkflowAction.update({
    where: { id: actionId },
    data: { status: 'processing' }
  })
  
  try {
    // Find the node to execute
    const workflow = action.workflow
    const node = workflow.nodes?.find(n => n.id === action.currentNodeId)
    
    if (!node) {
      throw new Error(`Node ${action.currentNodeId} not found in workflow`)
    }
    
    // Execute from this node onwards
    // We need to modify the workflow to start from this node
    // For now, we'll execute the full workflow but this could be optimized
    await executeWorkflow(
      workflow,
      action.contact,
      action.userId,
      action.campaignId
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

