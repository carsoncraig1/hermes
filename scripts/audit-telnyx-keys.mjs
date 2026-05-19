import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const users = await prisma.user.findMany({
  select: { id: true, email: true, telnyxApiKey: true, telnyxPhoneNumber: true }
})
for (const u of users) {
  const k = u.telnyxApiKey || ''
  const looksReal = k.length > 20
  console.log(`${u.id}  email=${u.email || 'n/a'}  keyLen=${k.length}  ${looksReal ? 'OK' : 'BROKEN'}  phone=${u.telnyxPhoneNumber || 'none'}`)
}
await prisma.$disconnect()
