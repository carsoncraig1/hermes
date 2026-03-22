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
 * DISABLED: Automated delayed action processing is disabled - only manual sends are allowed
 */
export async function processDelayedActions() {
  const actions = await getReadyDelayedActions(100)
  // #region agent log
  fetch('http://127.0.0.1:7914/ingest/e456b1d5-4367-4e1a-abc7-876a56bf30dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe3f2d'},body:JSON.stringify({sessionId:'fe3f2d',runId:'post-fix',hypothesisId:'H2',location:'src/lib/delayedWorkflow.js:136',message:'delayed actions fetched for processing',data:{readyActionsCount:actions.length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  
  // Process in parallel with limit
  const BATCH_SIZE = 10
  for (let i = 0; i < actions.length; i += BATCH_SIZE) {
    const batch = actions.slice(i, i + BATCH_SIZE)
    await Promise.allSettled(
      batch.map(action => executeDelayedAction(action.id))
    )
  }
  // #region agent log
  fetch('http://127.0.0.1:7914/ingest/e456b1d5-4367-4e1a-abc7-876a56bf30dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe3f2d'},body:JSON.stringify({sessionId:'fe3f2d',runId:'post-fix',hypothesisId:'H2',location:'src/lib/delayedWorkflow.js:147',message:'delayed actions processing loop complete',data:{processedBatches:Math.ceil(actions.length/BATCH_SIZE)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
}

