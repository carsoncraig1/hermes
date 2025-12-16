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
  // Using DigitalOcean connection pooler (port 25061) with 22 backend connections
  // Transaction pooling mode: connections released after each transaction
  // This allows efficient connection reuse - Prisma can use up to connection_limit
  // Set connection_limit=20 in DATABASE_URL to max out the pooler (leaving 2 for overhead)
  // Example: postgresql://user:pass@host:25061/hermes-executor?sslmode=require&connection_limit=20&pool_timeout=20
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma 