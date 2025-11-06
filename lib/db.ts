import { PrismaClient } from "@prisma/client";

// Lazily instantiate PrismaClient to avoid creating the client at module
// evaluation time (which can cause issues during Next/Vercel build-time
// collection). We keep a global cache so we don't create multiple clients
// during hot-reload in development.

type PrismaClientType = PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prismaClient?: PrismaClientType;
};

function getPrismaClient() {
  if (!globalForPrisma.prismaClient) {
    globalForPrisma.prismaClient = new PrismaClient();
  }
  return globalForPrisma.prismaClient;
}

// Export a proxy that will create the real PrismaClient on first access.
// This preserves the existing `import { prisma } from '@/lib/db'` usage
// across the codebase while preventing immediate instantiation during
// module evaluation.
export const prisma = new Proxy({} as PrismaClientType, {
  get(_target, prop: string | symbol) {
    const client = getPrismaClient();
    // @ts-ignore - forward access to the real client
    const value = client[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
  set(_target, prop: string | symbol, value) {
    const client = getPrismaClient();
    // @ts-ignore
    client[prop] = value;
    return true;
  },
  has(_target, prop: string | symbol) {
    const client = getPrismaClient();
    // @ts-ignore
    return prop in client;
  },
}) as PrismaClientType;

// In dev, store on global to avoid multiple instances during HMR
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaClient = getPrismaClient();
}
