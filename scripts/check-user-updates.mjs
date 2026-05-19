import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const users = await prisma.user.findMany({
  select: { id: true, email: true, telnyxApiKey: true, updatedAt: true, createdAt: true }
})
for (const u of users) {
  console.log(`${u.id}  email=${u.email}  keyLen=${(u.telnyxApiKey || '').length}  updatedAt=${u.updatedAt?.toISOString()}  createdAt=${u.createdAt?.toISOString()}`)
}
await prisma.$disconnect()
