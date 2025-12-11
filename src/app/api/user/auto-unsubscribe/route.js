import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

/**
 * GET - Fetch user's auto-unsubscribe on failure setting
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { autoUnsubscribeOnFailure: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      autoUnsubscribeOnFailure: user.autoUnsubscribeOnFailure ?? true // Default to true
    });
  } catch (error) {
    console.error('Error fetching auto-unsubscribe setting:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update user's auto-unsubscribe on failure setting
 */
export async function PUT(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { autoUnsubscribeOnFailure } = body;

    if (typeof autoUnsubscribeOnFailure !== 'boolean') {
      return NextResponse.json(
        { error: 'autoUnsubscribeOnFailure must be a boolean' },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { autoUnsubscribeOnFailure },
      select: { autoUnsubscribeOnFailure: true }
    });

    return NextResponse.json({
      success: true,
      autoUnsubscribeOnFailure: user.autoUnsubscribeOnFailure
    });
  } catch (error) {
    console.error('Error updating auto-unsubscribe setting:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

