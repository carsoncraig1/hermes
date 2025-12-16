import { PrismaClient } from '@prisma/client'

const globalForPrisma = global

// Configure connection pool explicitly to prevent exhaustion
// Connection pool settings via DATABASE_URL query params or explicit config
const connectionUrl = process.env.DATABASE_URL || ''
const hasPoolConfig = connectionUrl.includes('connection_limit') || connectionUrl.includes('pool_timeout')

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: connectionUrl
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  // Connection pool configuration
  // Defaults: connection_limit=10, pool_timeout=10s
  // For production, configure via DATABASE_URL:
  // postgresql://user:pass@host/db?connection_limit=20&pool_timeout=20
  // Or use a connection pooler like PgBouncer
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma 