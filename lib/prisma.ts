// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  console.warn("⚠️ WARNING: DATABASE_URL is missing. Prisma disabled.");
}

let prisma: PrismaClient;

if (process.env.DATABASE_URL) {
  // Use globalThis trick to avoid creating new clients on hot reload
  const globalAny = global as any;

  if (!globalAny.prisma) {
    globalAny.prisma = new PrismaClient({
      log: ["warn", "error"], // safe logging
    });
  }

  prisma = globalAny.prisma;
} else {
  // Return a harmless fake client so UI does not crash
  prisma = {
    user: { count: async () => 0 },
    location: { count: async () => 0 },
    shift: { findMany: async () => [] },
  } as any;
}

export { prisma };