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
 * @returns {Promise<Object>} - Created job
 */
export async function createSendJob({
  userId,
  campaignId,
  jobType, // 'dedicated_send' or 'manual_fire'
  totalContacts,
  totalBatches,
  metadata = {},
  scheduledAt = null
}) {
  return await prisma.sendJob.create({
    data: {
      userId,
      campaignId,
      jobType,
      status: 'pending',
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
 * Mark job as started
 * @param {string} jobId - Job ID
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
 * Get pending jobs for processing
 * Only returns jobs that are ready to execute (scheduledAt is null or scheduledAt <= now)
 * @param {number} limit - Maximum number of jobs to return
 * @returns {Promise<Array>} - Array of pending jobs ready to execute
 */
export async function getPendingJobs(limit = 10) {
  const now = new Date()
  return await prisma.sendJob.findMany({
    where: {
      status: 'pending',
      OR: [
        { scheduledAt: null }, // Immediate jobs
        { scheduledAt: { lte: now } } // Scheduled jobs ready to execute
      ]
    },
    orderBy: [
      { scheduledAt: 'asc' }, // Process scheduled jobs in order
      { createdAt: 'asc' } // Then immediate jobs by creation time
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

