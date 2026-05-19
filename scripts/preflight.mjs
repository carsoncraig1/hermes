import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const [pending] = await prisma.$queryRaw`SELECT count(*)::int AS n FROM send_jobs WHERE status='pending'`
const [processing] = await prisma.$queryRaw`SELECT count(*)::int AS n FROM send_jobs WHERE status='processing' AND "completedAt" IS NULL`
console.log(`pending: ${pending.n}`)
console.log(`processing (active): ${processing.n}`)
await prisma.$disconnect()
