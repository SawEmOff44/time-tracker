// app/api/shifts/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

// ---------------------- GET /api/shifts ----------------------
// List shifts with optional filters: ?employee=...&location=...&adhocOnly=true
export async function GET(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const employeeFilter = searchParams.get("employee") ?? "";
    const locationFilter = searchParams.get("location") ?? "";
    const adhocOnly = searchParams.get("adhocOnly") === "true";

    const where: any = {};

    if (employeeFilter.trim()) {
      where.user = {
        OR: [
          {
            name: {
              contains: employeeFilter.trim(),
              mode: "insensitive",
            },
          },
          {
            employeeCode: {
              contains: employeeFilter.trim(),
              mode: "insensitive",
            },
          },
        ],
      };
    }

    if (locationFilter.trim()) {
      where.location = {
        name: {
          contains: locationFilter.trim(),
          mode: "insensitive",
        },
      };
    }

    if (adhocOnly) {
      // Treat any location with code "ADHOC" as adhoc
      where.location = {
        ...(where.location || {}),
        code: "ADHOC",
      };
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        user: true,
        location: true,
      },
      orderBy: {
        clockIn: "desc",
      },
    });

    return NextResponse.json(shifts);
  } catch (err) {
    console.error("Error fetching shifts:", err);
    return NextResponse.json(
      { error: "Failed to load shifts" },
      { status: 500 }
    );
  }
}

// ---------------------- POST /api/shifts ----------------------
// Create manual shift
export async function POST(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const {
    userId,
    employeeId, // legacy name from earlier UI – support both
    locationId,
    clockIn,
    clockOut,
  } = body;

  const finalUserId = userId ?? employeeId;

  if (!finalUserId || !clockIn) {
    return NextResponse.json(
      { error: "employeeId and clockIn are required" },
      { status: 400 }
    );
  }

  const clockInDate = new Date(clockIn);
  if (Number.isNaN(clockInDate.getTime())) {
    return NextResponse.json(
      { error: "Invalid clockIn datetime" },
      { status: 400 }
    );
  }

  let clockOutDate: Date | null = null;
  if (clockOut) {
    const tmp = new Date(clockOut);
    if (Number.isNaN(tmp.getTime())) {
      return NextResponse.json(
        { error: "Invalid clockOut datetime" },
        { status: 400 }
      );
    }
    clockOutDate = tmp;
  }

  try {
    const shift = await prisma.shift.create({
      data: {
        userId: finalUserId,
        locationId: locationId || null,
        clockIn: clockInDate,
        clockOut: clockOutDate,
        // GPS + adhoc fields are handled by /api/clock, not manual entry
      },
      include: {
        user: true,
        location: true,
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