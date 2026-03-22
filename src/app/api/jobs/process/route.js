'use server'

import { getPendingJobs } from '@/lib/sendJob'
import { processDelayedActions } from '@/lib/delayedWorkflow'
import { executeManualFire, executeDedicatedSend } from '@/lib/actions/campaigns'
import { processScheduledRedirects } from '@/lib/actions/scheduledRedirects'
import prisma from '@/lib/prisma'

/**
 * Process pending jobs and delayed workflow actions
 * This endpoint should be called periodically (e.g., via cron job)
 * 
 * GET /api/jobs/process?secret=YOUR_SECRET
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const isAuthorized = secret === process.env.JOB_PROCESSOR_SECRET
  
  // #region agent log
  fetch('http://127.0.0.1:7914/ingest/e456b1d5-4367-4e1a-abc7-876a56bf30dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe3f2d'},body:JSON.stringify({sessionId:'fe3f2d',runId:'pre-fix',hypothesisId:'H1',location:'src/app/api/jobs/process/route.js:19',message:'process endpoint hit',data:{hasSecret:Boolean(secret),hasEnvSecret:Boolean(process.env.JOB_PROCESSOR_SECRET)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  // #region agent log
  fetch('http://127.0.0.1:7914/ingest/e456b1d5-4367-4e1a-abc7-876a56bf30dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe3f2d'},body:JSON.stringify({sessionId:'fe3f2d',runId:'pre-fix',hypothesisId:'H1',location:'src/app/api/jobs/process/route.js:22',message:'secret authorization evaluated',data:{isAuthorized},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  
  // Simple secret check (in production, use proper authentication)
  if (!isAuthorized) {
    // #region agent log
    fetch('http://127.0.0.1:7914/ingest/e456b1d5-4367-4e1a-abc7-876a56bf30dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe3f2d'},body:JSON.stringify({sessionId:'fe3f2d',runId:'pre-fix',hypothesisId:'H1',location:'src/app/api/jobs/process/route.js:28',message:'request rejected as unauthorized',data:{reason:'secret mismatch'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return new Response('Unauthorized', { status: 401 })
  }
  
  try {
    const now = new Date()
    const [readyDelayedActionsCount, readyScheduledRedirectsCount, readySendJobsCount] = await Promise.all([
      prisma.delayedWorkflowAction.count({
        where: {
          status: 'pending',
          executeAt: { lte: now }
        }
      }),
      prisma.scheduledShortlinkRedirect.count({
        where: {
          status: 'pending',
          scheduledAt: { lte: now }
        }
      }),
      prisma.sendJob.count({
        where: {
          status: 'pending',
          scheduledAt: {
            not: null,
            lte: now
          }
        }
      })
    ])
    
    // #region agent log
    fetch('http://127.0.0.1:7914/ingest/e456b1d5-4367-4e1a-abc7-876a56bf30dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe3f2d'},body:JSON.stringify({sessionId:'fe3f2d',runId:'pre-fix',hypothesisId:'H3-H4',location:'src/app/api/jobs/process/route.js:57',message:'ready work inventory snapshot',data:{readyDelayedActionsCount,readyScheduledRedirectsCount,readySendJobsCount},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    
    await processDelayedActions()
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
    
    // #region agent log
    fetch('http://127.0.0.1:7914/ingest/e456b1d5-4367-4e1a-abc7-876a56bf30dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe3f2d'},body:JSON.stringify({sessionId:'fe3f2d',runId:'post-fix',hypothesisId:'H2',location:'src/app/api/jobs/process/route.js:95',message:'automation processing completed',data:{delayedActionsProcessed:true,scheduledRedirectsProcessed:scheduledRedirectResults.length,jobsProcessed:results.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return Response.json({
      success: true,
      delayedActionsProcessed: true,
      scheduledRedirectsProcessed: scheduledRedirectResults.length,
      jobsProcessed: results.length,
      scheduledRedirectResults,
      results
    })
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7914/ingest/e456b1d5-4367-4e1a-abc7-876a56bf30dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe3f2d'},body:JSON.stringify({sessionId:'fe3f2d',runId:'pre-fix',hypothesisId:'H5',location:'src/app/api/jobs/process/route.js:115',message:'process route threw error',data:{errorMessage:error?.message||'unknown'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.error('Error processing jobs:', error)
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

