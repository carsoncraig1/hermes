'use server'

import prisma from '@/lib/prisma'

const STALE_JOB_TIMEOUT_MS = 15 * 60 * 1000

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
  try {
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
  } catch (err) {
    // The partial unique index `uniq_active_send_per_campaign` (one 'processing'
    // job per campaign) rejected this insert: a send for this campaign is already
    // running. Surface a typed error so callers skip instead of starting a second
    // full-audience blast (the duplicate-send incident root cause).
    if (err?.code === 'P2002') {
      const conflict = new Error('ACTIVE_SEND_EXISTS')
      conflict.code = 'ACTIVE_SEND_EXISTS'
      throw conflict
    }
    throw err
  }
}

/**
 * Find the in-flight send job for a campaign, if any. At most one job per
 * campaign may be actively sending ('processing') at a time — enforced here and
 * by the `uniq_active_send_per_campaign` partial unique index. A 'pending'
 * (scheduled, not yet running) job is also returned so callers can avoid
 * stacking immediate sends on top of a queued one.
 * @param {number} campaignId
 * @returns {Promise<{id: string, status: string, jobType: string, createdAt: Date}|null>}
 */
export async function findActiveSendJobForCampaign(campaignId) {
  return await prisma.sendJob.findFirst({
    where: { campaignId, status: { in: ['pending', 'processing'] } },
    select: { id: true, status: true, jobType: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
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
  try {
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
  } catch (err) {
    // The partial unique index rejected the transition to 'processing' because
    // another job for this campaign is already sending. Treat as "not claimed"
    // so this job stays pending rather than starting a concurrent duplicate send.
    if (err?.code === 'P2002') return false
    throw err
  }
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
  await recoverStaleSendJobs()
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
 * Fail send jobs whose worker has died mid-send.
 *
 * Staleness is measured by the job HEARTBEAT (`updatedAt`, refreshed every batch
 * by updateSendJobProgress) — NOT by `startedAt`. A large send legitimately runs
 * for far longer than staleMs; as long as it keeps making progress it is healthy
 * and must never be touched. Keying off `startedAt` is what caused duplicate
 * sends: a healthy 30+ minute job looked "stale" after staleMs and got re-run.
 *
 * A stalled job is marked terminal `failed`. It is NEVER flipped back to
 * `pending`, because sends are not resumable — re-running restarts from the first
 * contact and re-sends every message already delivered (Telnyx idempotency keys
 * differ across executions). Failing safe and surfacing the job for a deliberate
 * `resumeSendJob` is the only correct behavior for billed messaging.
 *
 * @param {number} staleMs - Heartbeat age (ms) with no progress before a job is considered dead
 * @returns {Promise<number>} - Number of jobs failed
 */
export async function recoverStaleSendJobs(staleMs = STALE_JOB_TIMEOUT_MS) {
  const staleBefore = new Date(Date.now() - staleMs)
  const result = await prisma.sendJob.updateMany({
    where: {
      status: 'processing',
      scheduledAt: { not: null }, // only scheduler-managed jobs
      startedAt: { not: null },
      updatedAt: { lte: staleBefore }, // heartbeat: no progress for staleMs => worker is dead
      completedAt: null
    },
    data: {
      status: 'failed',
      errorMessage: `Send worker stalled with no progress for ${Math.round(staleMs / 60000)}m; failed at ${new Date().toISOString()} to prevent duplicate sends. Resume manually if it was incomplete.`
    }
  })

  if (result.count > 0) {
    console.warn(`Failed ${result.count} stalled send job(s) to prevent duplicate re-sends`)
  }

  return result.count
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

