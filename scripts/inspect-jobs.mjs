import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const processing = await prisma.$queryRaw`
    SELECT id, "campaignId", "userId", status, "scheduledAt", "createdAt", "startedAt", "completedAt", "errorMessage", "totalContacts", "processedContacts", "successCount", "failCount", "jobType"
    FROM send_jobs
    WHERE status = 'processing' AND "completedAt" IS NULL
    ORDER BY "createdAt" DESC
  `

  const pending = await prisma.$queryRaw`
    SELECT id, "campaignId", "userId", status, "scheduledAt", "createdAt", "startedAt", "completedAt", "errorMessage", "totalContacts", "processedContacts", "successCount", "failCount", "jobType"
    FROM send_jobs
    WHERE status = 'pending'
    ORDER BY "createdAt" DESC
    LIMIT 50
  `

  const recentAll = await prisma.$queryRaw`
    SELECT status, count(*)::int AS n, min("createdAt") AS oldest, max("createdAt") AS newest
    FROM send_jobs
    WHERE "createdAt" > NOW() - INTERVAL '7 days'
    GROUP BY status
    ORDER BY n DESC
  `

  const createdAfterDeploy = await prisma.$queryRaw`
    SELECT id, "campaignId", status, "scheduledAt", "createdAt", "startedAt", "errorMessage"
    FROM send_jobs
    WHERE "createdAt" > '2026-05-19T17:16:00Z'
    ORDER BY "createdAt" DESC
  `

  console.log('=== PROCESSING jobs (status=processing, completedAt=null) ===')
  for (const j of processing) {
    console.log(JSON.stringify(j, null, 2))
  }
  console.log('')
  console.log(`=== PENDING jobs (status=pending), showing ${pending.length} ===`)
  for (const j of pending) {
    console.log(JSON.stringify(j, null, 2))
  }
  console.log('')
  console.log('=== last-7-day status breakdown ===')
  console.log(recentAll)
  console.log('')
  console.log('=== Jobs created AFTER deploy (17:16 UTC) ===')
  for (const j of createdAfterDeploy) {
    console.log(JSON.stringify(j, null, 2))
  }
  console.log(`(total: ${createdAfterDeploy.length})`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
