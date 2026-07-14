import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Always create a new client if the cached one doesn't have all models
// (this handles hot-reload after schema changes in dev)
let client = globalForPrisma.prisma;

if (!client || !(client as unknown as { modelProvider?: unknown }).modelProvider) {
  client = new PrismaClient({
    log: ['error', 'warn'],
  });
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }
}

export const db = client;
