import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const deployTime = new Date('2026-05-19T17:16:00Z')

async function main() {
  const [recentOutbound] = await prisma.$queryRaw`
    SELECT count(*)::int AS n, max("sentAt") AS latest
    FROM messages
    WHERE direction = 'outbound' AND "sentAt" > ${deployTime}
  `

  const [processingJobs] = await prisma.$queryRaw`
    SELECT count(*)::int AS n
    FROM send_jobs
    WHERE status = 'processing' AND "completedAt" IS NULL
  `

  const recentMessagesByMinute = await prisma.$queryRaw`
    SELECT date_trunc('minute', "sentAt") AS minute, count(*)::int AS n
    FROM messages
    WHERE direction = 'outbound' AND "sentAt" > NOW() - INTERVAL '60 minutes'
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT 30
  `

  console.log('--- Query 1: outbound messages with sentAt > deploy time (17:16 UTC) ---')
  console.log(recentOutbound)
  console.log('')
  console.log('--- Query 2: SendJobs currently in processing ---')
  console.log(processingJobs)
  console.log('')
  console.log('--- Query 3: outbound messages by minute, last 60 min ---')
  for (const row of recentMessagesByMinute) {
    console.log(`  ${row.minute.toISOString()}  ${row.n}`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
