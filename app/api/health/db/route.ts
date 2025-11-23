// app/api/health/db/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Test DB connection
    await prisma.user.count();
    return NextResponse.json({ healthy: true });
  } catch (err) {
    return NextResponse.json(
      { healthy: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}