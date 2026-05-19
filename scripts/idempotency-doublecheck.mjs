import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Verify the two test sends from 20:19:31 wrote correct rows with unique messageIds + Telnyx IDs.
const job = await prisma.sendJob.findUnique({ where: { id: 'cmpd2tn800001e60t07vo66t3' } })
console.log('=== Test job ===')
console.log(`status=${job?.status} sent=${job?.successCount} fail=${job?.failCount}`)

const msgs = await prisma.message.findMany({
  where: { campaignId: 104 },
  orderBy: { createdAt: 'desc' },
  take: 4,
  select: { id: true, telnyxMessageId: true, status: true, sentAt: true, createdAt: true, errorMessage: true }
})
console.log('\n=== Last 4 messages for campaign 104 ===')
for (const m of msgs) {
  console.log(`  msgId=${m.id}  tlnId=${m.telnyxMessageId}  status=${m.status}  errorMessage=${m.errorMessage || '-'}`)
}

// Sanity: the messageId we store IS what we use as the Idempotency-Key.
const recentIds = new Set(msgs.map(m => m.id))
console.log('\n=== Uniqueness check ===')
console.log(`Distinct messageIds: ${recentIds.size} / Returned rows: ${msgs.length}`)

await prisma.$disconnect()
