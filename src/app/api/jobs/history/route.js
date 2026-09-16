import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Scheduling History Report (read-only diagnostic)
 *
 * Answers "did scheduling actually work when we used it?" from the
 * authoritative send_jobs / scheduled redirect tables — console logs only
 * retain ~3 days, so history questions must come from the DB.
 *
 * GET /api/jobs/history?key=hermes-api-key[&days=90]
 *
 * Auth mirrors /api/revenue (per-user API key). Returns every SCHEDULED send
 * job (scheduledAt set) in the window with per-job execution lag and outcome,
 * plus scheduled-redirect history, plus a computed summary verdict.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required ("key" parameter).' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { apiKey }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '90', 10) || 90, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [jobs, redirects, delayedStats] = await Promise.all([
      prisma.sendJob.findMany({
        where: {
          userId: user.id,
          scheduledAt: { not: null },
          createdAt: { gte: since }
        },
        select: {
          id: true, jobType: true, status: true, scheduledAt: true, createdAt: true,
          startedAt: true, completedAt: true, totalContacts: true,
          successCount: true, failCount: true, errorMessage: true,
          campaign: { select: { id: true, name: true } }
        },
        orderBy: { scheduledAt: 'desc' },
        take: 200
      }),
      prisma.scheduledShortlinkRedirect.findMany({
        where: { userId: user.id, createdAt: { gte: since } },
        select: {
          id: true, status: true, scheduledAt: true, executedAt: true,
          errorMessage: true, newDestination: true,
          shortlink: { select: { id: true, nickname: true, slug: true } }
        },
        orderBy: { scheduledAt: 'desc' },
        take: 200
      }),
      prisma.delayedWorkflowAction.groupBy({
        by: ['status'],
        where: { userId: user.id, createdAt: { gte: since } },
        _count: true
      })
    ]);

    const lagSeconds = (scheduled, started) =>
      scheduled && started ? Math.round((new Date(started) - new Date(scheduled)) / 1000) : null;

    const jobRows = jobs.map((j) => ({
      jobId: j.id,
      campaign: j.campaign?.name || null,
      jobType: j.jobType,
      status: j.status,
      scheduledAt: j.scheduledAt,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
      startLagSeconds: lagSeconds(j.scheduledAt, j.startedAt),
      totalContacts: j.totalContacts,
      successCount: j.successCount,
      failCount: j.failCount,
      errorMessage: j.errorMessage
    }));

    const now = Date.now();
    const summary = {
      windowDays: days,
      scheduledJobs: jobRows.length,
      completed: jobRows.filter((j) => j.status === 'completed').length,
      failed: jobRows.filter((j) => j.status === 'failed').length,
      stillPendingFuture: jobRows.filter((j) => j.status === 'pending' && new Date(j.scheduledAt).getTime() > now).length,
      // The smoking gun for a dead cron: due jobs nobody ever picked up
      overdueNeverStarted: jobRows.filter((j) => j.status === 'pending' && new Date(j.scheduledAt).getTime() <= now - 10 * 60 * 1000).length,
      startedWithin2Min: jobRows.filter((j) => j.startLagSeconds !== null && j.startLagSeconds >= 0 && j.startLagSeconds <= 120).length,
      redirectsScheduled: redirects.length,
      redirectsCompleted: redirects.filter((r) => r.status === 'completed').length,
      delayedWorkflowActions: Object.fromEntries(delayedStats.map((s) => [s.status, s._count]))
    };

    return NextResponse.json({ summary, scheduledSendJobs: jobRows, scheduledRedirects: redirects });
  } catch (error) {
    console.error('[jobs-history] ERROR:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
