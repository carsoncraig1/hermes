import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const job = await prisma.sendJob.findUnique({ where: { id: 'cmpd1y2dy0001if0ua8wxgiee' } })
console.log('=== Job ===')
console.log(JSON.stringify(job, null, 2))

const messages = await prisma.message.findMany({
  where: { campaignId: 103 },
  orderBy: { createdAt: 'desc' },
  take: 5,
  select: {
    id: true, status: true, telnyxMessageId: true, errorMessage: true,
    failedAt: true, sentAt: true, createdAt: true, text: true, telnyxMetadata: true,
  }
})
console.log('\n=== Recent messages for campaign 103 ===')
for (const m of messages) {
  console.log(JSON.stringify(m, null, 2))
}
await prisma.$disconnect()
