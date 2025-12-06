'use server';

import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { standardOptOutText: true },
    });

    return Response.json({ optOutText: user?.standardOptOutText || '' });
  } catch (error) {
    console.error('Error fetching opt-out text:', error);
    return Response.json({ error: 'Failed to fetch opt-out text' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { optOutText } = await request.json();

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { standardOptOutText: optOutText || null },
      select: { standardOptOutText: true },
    });

    return Response.json({ optOutText: user.standardOptOutText || '' });
  } catch (error) {
    console.error('Error updating opt-out text:', error);
    return Response.json({ error: 'Failed to update opt-out text' }, { status: 500 });
  }
}

