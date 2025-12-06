import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { apiKey: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If user doesn't have an API key yet, generate one
    if (!user.apiKey) {
      const crypto = await import('crypto');
      const newApiKey = `hermes_${crypto.randomBytes(32).toString('hex')}`;
      
      await prisma.user.update({
        where: { id: session.user.id },
        data: { apiKey: newApiKey }
      });

      return NextResponse.json({ apiKey: newApiKey });
    }

    return NextResponse.json({ apiKey: user.apiKey });
  } catch (error) {
    console.error('Error fetching API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

