import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const orphanIds = [
  '40319e41-0220-45a5-a8f3-40d9c47dfcdd',
  '40319e41-0220-4bc4-add3-b2d57e2311b4',
  '40319e41-0220-45ac-bdd1-3690363f180e',
  '40319e41-0220-471f-ad2b-d1640d67e25d'
]

console.log('=== Exact-match lookup for each orphan ID ===')
for (const tlnId of orphanIds) {
  const m = await prisma.message.findFirst({
    where: { telnyxMessageId: tlnId },
    select: { id: true, status: true, direction: true, createdAt: true, sentAt: true, to: true, campaignId: true }
  })
  console.log(`  ${tlnId} -> ${m ? JSON.stringify(m) : 'NO MATCH'}`)
}

// All orphan IDs share prefix 40319e41-0220- . Check if ANY message in our DB shares that prefix.
console.log('\n=== Any messages with prefix 40319e41-0220- ? ===')
const prefMatch = await prisma.$queryRaw`
  SELECT id, "telnyxMessageId", status, direction, "createdAt", "sentAt"
  FROM messages
  WHERE "telnyxMessageId" LIKE '40319e41-0220-%'
  ORDER BY "createdAt" DESC LIMIT 10
`
console.log(`Count: ${prefMatch.length}`)
for (const r of prefMatch) console.log(' ', JSON.stringify(r))

// What about a wider 40319e41- (Telnyx's overall ID space)?
console.log('\n=== Recent messages with telnyx id prefix 40319e41- (any 4-char chunk after) ===')
const wider = await prisma.$queryRaw`
  SELECT id, "telnyxMessageId", status, direction, "createdAt", "sentAt", "campaignId"
  FROM messages
  WHERE "telnyxMessageId" LIKE '40319e41-%'
  ORDER BY "createdAt" DESC LIMIT 8
`
for (const r of wider) console.log(' ', JSON.stringify(r))

// Any INBOUND messages around the same time window (20:17-20:19 UTC)?
console.log('\n=== All messages created 2026-05-19 20:00 - 20:30 UTC ===')
const window = await prisma.$queryRaw`
  SELECT id, "telnyxMessageId", status, direction, "from", "to", "createdAt", "campaignId"
  FROM messages
  WHERE "createdAt" BETWEEN '2026-05-19T20:00:00Z' AND '2026-05-19T20:30:00Z'
  ORDER BY "createdAt" ASC
`
console.log(`Count: ${window.length}`)
for (const r of window) console.log(' ', JSON.stringify(r))

await prisma.$disconnect()
