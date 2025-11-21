// app/api/admin/shifts/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

// Safe date parser – returns Date or undefined
function parseDate(input: string | null): Date | undefined {
  if (!input) return undefined;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

// GET /api/admin/shifts → list shifts with optional filters
export async function GET(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const employeeId = searchParams.get("employeeId"); // external name

    const where: any = {};

    // external employeeId -> internal userId
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
    console.error("Error loading shifts:", err);
    return NextResponse.json(
      { error: "Failed to load shifts" },
      { status: 500 }
    );
  }
}

// POST /api/admin/shifts → create manual shift
export async function POST(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { employeeId, locationId, clockIn, clockOut } = body;

    if (!employeeId || !clockIn) {
      return NextResponse.json(
        { error: "employeeId and clockIn are required" },
        { status: 400 }
      );
    }

    const clockInDate = parseDate(clockIn);
    if (!clockInDate) {
      return NextResponse.json(
        {
          error:
            "clockIn must be a valid datetime, e.g. 2025-01-01T08:00:00 or a valid ISO string.",
        },
        { status: 400 }
      );
    }

    let clockOutDate: Date | null = null;
    if (clockOut) {
      const parsed = parseDate(clockOut);
      if (!parsed) {
        return NextResponse.json(
          {
            error:
              "clockOut must be a valid datetime, e.g. 2025-01-01T17:00:00 or a valid ISO string.",
          },
          { status: 400 }
        );
      }
      clockOutDate = parsed;
    }

    const shift = await prisma.shift.create({
      data: {
        userId: employeeId, // map employeeId from UI -> userId in DB
        locationId: locationId || null,
        clockIn: clockInDate,
        clockOut: clockOutDate,
      },
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (err) {
    console.error("Error creating shift:", err);
    return NextResponse.json(
      { error: "Failed to create shift" },
      { status: 500 }
    );
  }
}