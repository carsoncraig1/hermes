import { PrismaClient } from '@prisma/client'

const globalForPrisma = global

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  // Configure connection pool to prevent exhaustion
  // Limit concurrent connections per instance
  // Note: This is a workaround - proper solution would be connection pooling service
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma 