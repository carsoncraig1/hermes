'use server';

import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function getUserTimezone() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true }
  });

  return user?.timezone || null;
}
