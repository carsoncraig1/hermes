import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { isValidTimeZone } from '@/lib/timezone';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true }
    });

    return NextResponse.json({ timezone: user?.timezone || '' });
  } catch (error) {
    console.error('Error fetching timezone setting:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const timezone = body?.timezone?.trim();

    if (!timezone || !isValidTimeZone(timezone)) {
      return NextResponse.json(
        { error: 'Please provide a valid IANA timezone (e.g., America/New_York)' },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { timezone },
      select: { timezone: true }
    });

    return NextResponse.json({ success: true, timezone: user.timezone || '' });
  } catch (error) {
    console.error('Error updating timezone setting:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
