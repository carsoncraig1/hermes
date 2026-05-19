import { PrismaClient } from '@prisma/client'
import { Telnyx } from 'telnyx'

const prisma = new PrismaClient()

// Get the same user that just failed
const user = await prisma.user.findUnique({
  where: { id: 'cmirzyw620000mo0rje9fd1o6' },
  select: { id: true, telnyxApiKey: true }
})

if (!user?.telnyxApiKey) {
  console.log('User has no telnyxApiKey')
  process.exit(1)
}

console.log('Key first/last chars:', user.telnyxApiKey.slice(0, 6) + '...' + user.telnyxApiKey.slice(-4))
console.log('Key length:', user.telnyxApiKey.length)

const client = new Telnyx(user.telnyxApiKey)
console.log('typeof client.getApiField:', typeof client.getApiField)

const auth = client.getApiField?.('auth')
console.log('auth value (preview):', auth ? auth.slice(0, 10) + '...' + auth.slice(-4) : auth)
console.log('starts with "Bearer "?', auth?.startsWith?.('Bearer '))

await prisma.$disconnect()
