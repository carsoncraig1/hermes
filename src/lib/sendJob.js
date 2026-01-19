'use server'

import prisma from '@/lib/prisma'

/**
 * Create a new send job
 * @param {Object} params - Job parameters
 * @param {string} params.userId - User ID
 * @param {number} params.campaignId - Campaign ID
 * @param {string} params.jobType - 'dedicated_send' or 'manual_fire'
 * @param {number} params.totalContacts - Total number of contacts
 * @param {number} params.totalBatches - Total number of batches
 * @param {Object} params.metadata - Additional job data
 * @param {Date|string|null} params.scheduledAt - Optional scheduled execution time
 * @param {boolean} params.startImmediately - If true, create with 'processing' status (prevents cron pickup)
 * @returns {Promise<Object>} - Created job
 */
export async function createSendJob({
  userId,
  campaignId,
  jobType, // 'dedicated_send' or 'manual_fire'
  totalContacts,
  totalBatches,
  metadata = {},
  scheduledAt = null,
  startImmediately = false
}) {
  return await prisma.sendJob.create({
    data: {
      userId,
      campaignId,
      jobType,
      // If startImmediately, create as 'processing' to prevent cron job from picking it up
      status: startImmediately ? 'processing' : 'pending',
      startedAt: startImmediately ? new Date() : null,
      totalContacts,
      totalBatches,
      metadata,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null
    }
  })
}

/**
 * Update job progress
 * @param {string} jobId - Job ID
 * @param {Object} updates - Progress updates
 */
export async function updateSendJobProgress(jobId, updates) {
  await prisma.sendJob.update({
    where: { id: jobId },
    data: {
      ...updates,
      updatedAt: new Date()
    }
  })
}

/**
 * Atomically claim and start a job
 * Uses updateMany with status check to prevent race conditions
 * @param {string} jobId - Job ID
 * @returns {Promise<boolean>} - True if job was successfully claimed, false if already claimed
 */
export async function claimAndStartJob(jobId) {
  // Atomically update only if status is still 'pending'
  // This prevents two processes from both claiming the same job
  const result = await prisma.sendJob.updateMany({
    where: {
      id: jobId,
      status: 'pending' // Only claim if still pending
    },
    data: {
      status: 'processing',
      startedAt: new Date()
    }
  })
  
  // If count is 0, the job was already claimed by another process
  return result.count > 0
}

/**
 * Mark job as started (legacy - prefer claimAndStartJob for race-condition safety)
 * @param {string} jobId - Job ID
 * @deprecated Use claimAndStartJob instead for atomic claiming
 */
export async function startSendJob(jobId) {
  await prisma.sendJob.update({
    where: { id: jobId },
    data: {
      status: 'processing',
      startedAt: new Date()
    }
  })
}

/**
 * Mark job as completed
 * @param {string} jobId - Job ID
 * @param {Object} results - Final results
 */
export async function completeSendJob(jobId, results) {
  await prisma.sendJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      processedContacts: results.processedContacts || 0,
      successCount: results.successCount || 0,
      failCount: results.failCount || 0,
      completedAt: new Date()
    }
  })
}

/**
 * Mark job as failed
 * @param {string} jobId - Job ID
 * @param {string} errorMessage - Error message
 */
export async function failSendJob(jobId, errorMessage) {
  await prisma.sendJob.update({
    where: { id: jobId },
    data: {
      status: 'failed',
      errorMessage,
      completedAt: new Date()
    }
  })
}

/**
 * Get job by ID
 * @param {string} jobId - Job ID
 * @returns {Promise<Object|null>} - Job or null
 */
export async function getSendJob(jobId) {
  return await prisma.sendJob.findUnique({
    where: { id: jobId }
  })
}

/**
 * Get pending SCHEDULED jobs for processing by the cron job processor
 * 
 * IMPORTANT: Only returns jobs with a scheduledAt time that has passed.
 * Immediate jobs (scheduledAt: null) are NOT returned here because they are
 * executed directly by the caller and should never be picked up by the cron.
 * 
 * @param {number} limit - Maximum number of jobs to return
 * @returns {Promise<Array>} - Array of scheduled jobs ready to execute
 */
export async function getPendingJobs(limit = 10) {
  const now = new Date()
  return await prisma.sendJob.findMany({
    where: {
      status: 'pending',
      // ONLY scheduled jobs - immediate jobs (scheduledAt: null) are executed directly
      // and should never be picked up by the cron processor
      scheduledAt: {
        not: null,
        lte: now
      }
    },
    orderBy: [
      { scheduledAt: 'asc' }, // Process scheduled jobs in order
      { createdAt: 'asc' }
    ],
    take: limit
  })
}

/**
 * Resume a job (change status from failed to pending)
 * @param {string} jobId - Job ID
 */
export async function resumeSendJob(jobId) {
  await prisma.sendJob.update({
    where: { id: jobId },
    data: {
      status: 'pending',
      errorMessage: null
    }
  })
}

