import prisma from '@/lib/prisma';

// In-memory TTL cache mapping a Telnyx messaging profile id to the owning user.
// The Telnyx webhook handler hits this on every delivery event; without a cache
// every burst of webhooks hammers the DB pool. The mapping is effectively
// static per user (only changes when settings are updated), so a short TTL plus
// explicit invalidation on writes is plenty.

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const NEGATIVE_TTL_MS = 30 * 1000; // shorter cache for "not found" so newly-configured profiles surface quickly

const cache = new Map(); // key -> { value, expiresAt }

function setEntry(key, value, ttl) {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

function getEntry(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

export async function getUserForMessagingProfile(messagingProfileId) {
  if (!messagingProfileId) return null;

  const cached = getEntry(messagingProfileId);
  if (cached !== undefined) return cached;

  let user = await prisma.user.findFirst({
    where: { telnyxMessagingProfileId: messagingProfileId },
    select: { id: true, autoUnsubscribeOnFailure: true }
  });

  if (!user) {
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { messagingProfileId },
      select: { userId: true }
    });
    if (phoneNumber) {
      user = await prisma.user.findUnique({
        where: { id: phoneNumber.userId },
        select: { id: true, autoUnsubscribeOnFailure: true }
      });
    }
  }

  setEntry(messagingProfileId, user || null, user ? TTL_MS : NEGATIVE_TTL_MS);
  return user || null;
}

export function invalidateMessagingProfile(messagingProfileId) {
  if (!messagingProfileId) return;
  cache.delete(messagingProfileId);
}

export function invalidateAllMessagingProfiles() {
  cache.clear();
}
