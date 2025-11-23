// app/api/shifts/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

// GET /api/shifts  -> list/search shifts for admin
export async function GET(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const employeeQuery = searchParams.get("employee")?.trim() || "";
  const locationQuery = searchParams.get("location")?.trim() || "";
  const adhocOnly = searchParams.get("adhocOnly") === "true";

  const where: Prisma.ShiftWhereInput = {};

  // Filter by employee name or code
  if (employeeQuery) {
    where.user = {
      OR: [
        { name: { contains: employeeQuery, mode: "insensitive" } },
        { employeeCode: { contains: employeeQuery, mode: "insensitive" } },
      ],
    };
  }

  // Filter by location name
  if (locationQuery) {
    where.location = {
      name: { contains: locationQuery, mode: "insensitive" },
    };
  }

  // ADHOC-only logic:
  //  - Shifts with no locationId
  //  - OR shifts tied to a Location whose radiusMeters === 0 (your Adhoc Job Site)
  if (adhocOnly) {
    where.OR = [
      { locationId: null },
      {
        location: {
          radiusMeters: 0,
        },
      },
    ];
  }

  try {
    const shifts = await prisma.shift.findMany({
      where,
      orderBy: { clockIn: "desc" },
      include: {
        user: true,
        location: true,
      },
      take: 500, // safety cap
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

// POST /api/shifts  -> create manual shift from Admin
export async function POST(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, locationId, clockIn, clockOut } = body || {};

  if (!userId || !clockIn) {
    return NextResponse.json(
      { error: "userId and clockIn are required" },
      { status: 400 }
    );
  }

  try {
    const shift = await prisma.shift.create({
      data: {
        userId: String(userId),
        locationId: locationId ? String(locationId) : null,
        clockIn: new Date(clockIn),
        clockOut: clockOut ? new Date(clockOut) : null,
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