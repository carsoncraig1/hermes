import { PrismaClient } from '@prisma/client'

const globalForPrisma = global

// Configure connection pool explicitly for high-throughput bulk sends
//
// CONNECTION POOL SIZING FOR BULK SMS:
// - Bulk sends do 20 messages in parallel
// - Each message needs 3-5 DB operations (create, update, etc.)
// - Recommended: connection_limit = 50-100 for bulk sending
//
// DATABASE_URL PARAMS (append to connection string):
// - connection_limit=50    : Max connections from Prisma to pooler
// - pool_timeout=30        : Seconds to wait for a connection (increase for bulk)
// - connect_timeout=30     : Seconds to wait for initial connection
//
// IF YOU SEE P2024 ERRORS ("Timed out fetching a new connection"):
// 1. Bump pool_timeout from 10 -> 30 to absorb webhook bursts
// 2. Confirm hot-path queries are indexed (see prisma/migrations/
//    add_messaging_profile_indexes.sql for the Telnyx webhook lookup)
// 3. Avoid awaiting fire-and-forget side effects on the request path
//
// DIGITALOCEAN POOLER (port 25061):
// - Transaction mode allows many client connections to share few backend connections
// - 22 backend connections can support 100+ client connections in transaction mode
// - Example: postgresql://user:pass@host:25061/db?sslmode=require&connection_limit=50&pool_timeout=30
//
// DIRECT CONNECTION (port 25060):
// - Each client connection = 1 backend connection
// - Limited by your database plan (e.g., 22 connections)
// - Only use for migrations or if pooler isn't working

const connectionUrl = process.env.DATABASE_URL || ''

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: connectionUrl
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma