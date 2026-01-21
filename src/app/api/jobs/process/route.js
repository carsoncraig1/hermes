'use server'

import { getPendingJobs } from '@/lib/sendJob'
import { processDelayedActions } from '@/lib/delayedWorkflow'
import { executeManualFire, executeDedicatedSend } from '@/lib/actions/campaigns'
import { processScheduledRedirects } from '@/lib/actions/scheduledRedirects'

/**
 * Process pending jobs and delayed workflow actions
 * This endpoint should be called periodically (e.g., via cron job)
 * 
 * GET /api/jobs/process?secret=YOUR_SECRET
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  
  // Simple secret check (in production, use proper authentication)
  if (secret !== process.env.JOB_PROCESSOR_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  try {
    // DISABLED: Automated job processing is disabled - only manual sends are allowed
    // Process delayed workflow actions
    // await processDelayedActions()
    
    // Process scheduled shortlink redirects
    // const scheduledRedirectResults = await processScheduledRedirects()
    
    // Process pending send jobs (limit to 5 at a time)
    // const pendingJobs = await getPendingJobs(5)
    
    // Return early - no automated processing
    return Response.json({
      success: true,
      message: 'Automated job processing is disabled. Only manual sends are allowed.',
      delayedActionsProcessed: false,
      scheduledRedirectsProcessed: 0,
      jobsProcessed: 0,
      scheduledRedirectResults: [],
      results: []
    })
    
    /* DISABLED CODE - Automated job processing
    const scheduledRedirectResults = await processScheduledRedirects()
    const pendingJobs = await getPendingJobs(5)
    
    const results = []
    for (const job of pendingJobs) {
      try {
        let result
        if (job.jobType === 'dedicated_send') {
          result = await executeDedicatedSend(job.campaignId, null, job.id)
        } else if (job.jobType === 'manual_fire') {
          const metadata = job.metadata || {}
          result = await executeManualFire(job.campaignId, {
            selectedTags: metadata.selectedTags || [],
            selectedSources: metadata.selectedSources || [],
            targetAllSubscribed: metadata.targetAllSubscribed || false
          })
        }
        
        if (result?.skipped) {
          results.push({ jobId: job.id, status: 'skipped', reason: result.reason })
        } else {
          results.push({ jobId: job.id, status: 'processed' })
        }
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error)
        results.push({ jobId: job.id, status: 'error', error: error.message })
      }
    }
    
    return Response.json({
      success: true,
      delayedActionsProcessed: true,
      scheduledRedirectsProcessed: scheduledRedirectResults.length,
      jobsProcessed: results.length,
      scheduledRedirectResults,
      results
    })
    */
  } catch (error) {
    console.error('Error processing jobs:', error)
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

