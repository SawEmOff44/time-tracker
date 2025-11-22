// app/api/shifts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

// GET /api/shifts
// Optional query params: from, to, userId, locationId, adhocOnly=true
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const userId = searchParams.get("userId");
    const locationId = searchParams.get("locationId");
    const adhocOnly = searchParams.get("adhocOnly") === "true";

    const where: any = {};

    if (from) {
      where.clockIn = {
        ...(where.clockIn ?? {}),
        gte: new Date(from),
      };
    }

    if (to) {
      where.clockIn = {
        ...(where.clockIn ?? {}),
        lte: new Date(to),
        ...(where.clockIn ?? {}),
      };
    }

    if (userId) {
      where.userId = userId;
    }

    if (locationId) {
      where.locationId = locationId;
    }

    if (adhocOnly) {
      const adhoc = await prisma.location.findFirst({
        where: { code: "ADHOC" },
      });
      if (!adhoc) {
        return NextResponse.json([]);
      }
      where.locationId = adhoc.id;
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
    console.error("Error fetching shifts:", err);
    return NextResponse.json(
      { error: "Failed to fetch shifts" },
      { status: 500 }
    );
  }
}

// POST /api/shifts
// Used by admin to create manual shifts
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

    const { userId, locationId, clockIn, clockOut } = body as {
      userId?: string;
      locationId?: string;
      clockIn?: string;
      clockOut?: string | null;
    };

    if (!userId || !locationId || !clockIn) {
      return NextResponse.json(
        { error: "userId, locationId, and clockIn are required" },
        { status: 400 }
      );
    }

    const clockInDate = new Date(clockIn);
    if (isNaN(clockInDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid clockIn date/time" },
        { status: 400 }
      );
    }

    let clockOutDate: Date | null = null;
    if (clockOut) {
      const parsed = new Date(clockOut);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "Invalid clockOut date/time" },
          { status: 400 }
        );
      }
      clockOutDate = parsed;
    }

    const created = await prisma.shift.create({
      data: {
        userId,
        locationId,
        clockIn: clockInDate,
        clockOut: clockOutDate,
      },
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

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("Error creating shift:", err);
    return NextResponse.json(
      { error: "Failed to create shift" },
      { status: 500 }
    );
  }
}