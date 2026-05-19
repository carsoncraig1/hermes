import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const before = await prisma.$queryRaw`
    SELECT id, "campaignId", status, "successCount", "failCount", "totalContacts"
    FROM send_jobs
    WHERE status = 'processing' AND "completedAt" IS NULL
    ORDER BY "createdAt" DESC
  `
  console.log(`Found ${before.length} stuck 'processing' rows. Cancelling...`)

  const result = await prisma.sendJob.updateMany({
    where: { status: 'processing', completedAt: null },
    data: {
      status: 'cancelled',
      completedAt: new Date(),
      errorMessage: 'Cancelled after 2026-05-19 misfire incident. Original startedAt during incident window.'
    }
  })

  console.log(`Updated ${result.count} rows.`)

  const after = await prisma.$queryRaw`
    SELECT id, "campaignId", status, "completedAt", "errorMessage"
    FROM send_jobs
    WHERE id IN (${prisma.$queryRaw.constructor})
  `

  const stillProcessing = await prisma.$queryRaw`
    SELECT count(*)::int AS n FROM send_jobs WHERE status='processing' AND "completedAt" IS NULL
  `
  const pending = await prisma.$queryRaw`
    SELECT count(*)::int AS n FROM send_jobs WHERE status='pending'
  `

  console.log('\nPost-cancel state:')
  console.log(`  processing (completedAt IS NULL): ${stillProcessing[0].n}`)
  console.log(`  pending:                          ${pending[0].n}`)

  const sample = await prisma.$queryRaw`
    SELECT id, "campaignId", status, "completedAt", "errorMessage"
    FROM send_jobs
    WHERE "errorMessage" LIKE 'Cancelled after 2026-05-19 misfire incident%'
    ORDER BY "completedAt" DESC
  `
  console.log(`\nCancelled rows (${sample.length}):`)
  for (const r of sample) {
    console.log(`  job=${r.id} campaign=${r.campaignId} status=${r.status} completedAt=${r.completedAt.toISOString()}`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
