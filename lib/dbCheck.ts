// lib/dbCheck.ts
import { prisma } from "./prisma";

export async function verifyDbConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    console.error("DB connectivity check failed:", err);
    return false;
  }
}