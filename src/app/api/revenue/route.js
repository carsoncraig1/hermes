import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { serverLog } from '@/lib/serverLogger';

/**
 * Helper function to get user ID from API key
 */
async function getUserIdFromApiKey(apiKey) {
  if (!apiKey) return null;
  
  const user = await prisma.user.findUnique({
    where: { apiKey },
    select: { id: true }
  });
  
  return user?.id || null;
}

/**
 * Revenue Tracking API Endpoint
 * 
 * Accepts revenue events from external tracking systems via GET request with query parameters
 * GET /api/revenue?hrms=xxx&payout=29.99&key=hermes-api-key
 * 
 * Query Parameters:
 * - hrms: Required - Tracking parameter from shortlink URL
 * - payout: Required - Revenue amount (positive number)
 * - currency: Optional - Currency code (default: "USD")
 * - key: Required - Hermes API key for authentication
 * - metadata: Optional - Additional tracking data as JSON string
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const hrms = searchParams.get('hrms');
    const payout = searchParams.get('payout');
    const currency = searchParams.get('currency') || 'USD';
    const apiKey = searchParams.get('key');
    const metadataParam = searchParams.get('metadata');
    
    // Validate API key
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required. Include your hermes-api-key as the "key" parameter.' },
        { status: 401 }
      );
    }
    
    // Get user ID from API key
    const userId = await getUserIdFromApiKey(apiKey);
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!hrms) {
      return NextResponse.json(
        { error: 'hrms parameter is required' },
        { status: 400 }
      );
    }

    if (!payout) {
      return NextResponse.json(
        { error: 'payout parameter is required' },
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

    // Parse metadata if provided
    let metadata = {};
    if (metadataParam) {
      try {
        metadata = JSON.parse(decodeURIComponent(metadataParam));
      } catch (e) {
        // If metadata parsing fails, ignore it
        metadata = {};
      }
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

    // Verify the shortlink click belongs to the user associated with the API key
    if (shortlinkClick.shortlink.userId !== userId) {
      return NextResponse.json(
        { error: 'Invalid hrms parameter. Shortlink click does not belong to your account.' },
        { status: 403 }
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

    // Log revenue event
    await serverLog(
      `Revenue event recorded: $${payoutAmount} ${currency}`,
      'info',
      {
        revenueEventId: revenueEvent.id,
        hrms,
        shortlinkId: shortlinkClick.shortlinkId,
        campaignId: shortlinkClick.shortlink.campaignId,
        payout: payoutAmount,
        currency
      },
      userId
    ).catch(err => console.error('Error logging revenue event:', err));

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

// Note: The GET method above handles revenue event recording via query parameters
// For internal revenue event queries, use a separate endpoint or admin interface

