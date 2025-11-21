// app/api/shifts/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Safe date parser – returns Date or undefined
function parseDate(input: string | null): Date | undefined {
  if (!input) return undefined;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

// GET /api/shifts → public-facing list, optional filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const employeeId = searchParams.get("employeeId"); // external name

    const where: any = {};

    // Map external employeeId → internal userId
    if (employeeId) {
      where.userId = employeeId;
    }

    const fromDate = parseDate(fromParam);
    const toDate = parseDate(toParam);

    if (fromDate || toDate) {
      where.clockIn = {};
      if (fromDate) where.clockIn.gte = fromDate;
      if (toDate) where.clockIn.lte = toDate;
    }

    const shifts = await prisma.shift.findMany({
      where,
      orderBy: { clockIn: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json(shifts);
  } catch (err) {
    console.error("Error loading public shifts:", err);
    return NextResponse.json(
      { error: "Failed to load shifts" },
      { status: 500 }
    );
  }
}