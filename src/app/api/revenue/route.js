import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Revenue Tracking API Endpoint
 * 
 * Accepts revenue events from external tracking systems
 * POST /api/revenue
 * 
 * Body:
 * {
 *   "hrms": "hrms_userId_shortlinkId_timestamp_random",
 *   "payout": 29.99,
 *   "currency": "USD" (optional, defaults to USD),
 *   "metadata": {} (optional, additional tracking data)
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { hrms, payout, currency = 'USD', metadata = {} } = body;

    // Validate required fields
    if (!hrms) {
      return NextResponse.json(
        { error: 'hrms parameter is required' },
        { status: 400 }
      );
    }

    if (payout === undefined || payout === null) {
      return NextResponse.json(
        { error: 'payout amount is required' },
        { status: 400 }
      );
    }

    // Validate payout is a number
    const payoutAmount = parseFloat(payout);
    if (isNaN(payoutAmount) || payoutAmount < 0) {
      return NextResponse.json(
        { error: 'payout must be a valid positive number' },
        { status: 400 }
      );
    }

    // Find shortlink click by hrms (unique HRMS per click)
    const shortlinkClick = await prisma.shortlinkClick.findUnique({
      where: { hrms },
      include: {
        shortlink: {
          include: {
            campaign: {
              select: {
                id: true,
                userId: true
              }
            }
          }
        }
      }
    });

    if (!shortlinkClick) {
      return NextResponse.json(
        { error: 'Invalid hrms parameter. Shortlink click not found.' },
        { status: 404 }
      );
    }

    // Create revenue event with new system (includes shortlinkClickId)
    const revenueEvent = await prisma.revenueEvent.create({
      data: {
        userId: shortlinkClick.shortlink.userId,
        hrms,
        shortlinkId: shortlinkClick.shortlinkId,
        shortlinkClickId: shortlinkClick.id,
        campaignId: shortlinkClick.shortlink.campaignId,
        payout: payoutAmount,
        currency,
        metadata: metadata || {}
      }
    });

    // Update campaign total revenue if campaign exists
    if (shortlinkClick.shortlink.campaignId) {
      await prisma.campaign.update({
        where: { id: shortlinkClick.shortlink.campaignId },
        data: {
          totalRevenue: {
            increment: payoutAmount
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      revenueEvent: {
        id: revenueEvent.id,
        hrms: revenueEvent.hrms,
        payout: revenueEvent.payout,
        currency: revenueEvent.currency,
        createdAt: revenueEvent.createdAt
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error recording revenue:', error);
    return NextResponse.json(
      { error: 'Failed to record revenue event', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get revenue events (for internal use)
 * GET /api/revenue?hrms=xxx or ?campaignId=xxx or ?shortlinkId=xxx
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const hrms = searchParams.get('hrms');
    const campaignId = searchParams.get('campaignId');
    const shortlinkId = searchParams.get('shortlinkId');

    const where = {};
    if (hrms) where.hrms = hrms;
    if (campaignId) where.campaignId = parseInt(campaignId, 10);
    if (shortlinkId) where.shortlinkId = parseInt(shortlinkId, 10);

    const revenueEvents = await prisma.revenueEvent.findMany({
      where,
      include: {
        campaign: {
          select: {
            id: true,
            name: true
          }
        },
        shortlink: {
          select: {
            id: true,
            slug: true,
            nickname: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100
    });

    return NextResponse.json({
      success: true,
      revenueEvents
    });

  } catch (error) {
    console.error('Error fetching revenue events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue events', details: error.message },
      { status: 500 }
    );
  }
}

