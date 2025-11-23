// app/api/clock/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ClockBody = {
  employeeCode?: string;
  pin?: string;
  lat?: number;
  lng?: number;
};

// Haversine distance in meters
function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // meters
  const toRad = (v: number) => (v * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) *
      Math.cos(φ2) *
      Math.sin(Δλ / 2) *
      Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Current pay period = current calendar week (Sunday–Saturday)
function getCurrentWeekRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  // JS getDay: 0 = Sunday
  const day = start.getDay();
  start.setDate(start.getDate() - day); // go back to Sunday

  const end = new Date(start);
  end.setDate(end.getDate() + 7); // next Sunday (exclusive)

  return { start, end };
}

async function computeWeeklyHours(userId: string) {
  const { start, end } = getCurrentWeekRange();

  const weeklyShifts = await prisma.shift.findMany({
    where: {
      userId,
      clockIn: { gte: start },
      clockOut: { not: null, lt: end },
    },
    select: {
      clockIn: true,
      clockOut: true,
    },
  });

  let totalMs = 0;
  for (const s of weeklyShifts) {
    if (!s.clockIn || !s.clockOut) continue;
    const startMs = new Date(s.clockIn).getTime();
    const endMs = new Date(s.clockOut).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs)
      continue;
    totalMs += endMs - startMs;
  }

  const hours = totalMs / (1000 * 60 * 60);
  return Number(hours.toFixed(2));
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ClockBody;

    const { employeeCode, pin, lat, lng } = body;

    if (!employeeCode || !pin) {
      return NextResponse.json(
        { error: "Employee code and PIN are required." },
        { status: 400 }
      );
    }

    if (lat == null || lng == null) {
      return NextResponse.json(
        { error: "GPS location (lat/lng) is required." },
        { status: 400 }
      );
    }

    // 1. Find the user by employee code
    const user = await prisma.user.findFirst({
      where: {
        employeeCode,
        active: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN" },
        { status: 401 }
      );
    }

    // 2. Simple PIN check (comparing against pinHash field for now)
    if (user.pinHash !== pin) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN" },
        { status: 401 }
      );
    }

    // 3. Find active locations & determine closest match
    const locations = await prisma.location.findMany({
      where: { active: true },
    });

    let matchedLocation: (typeof locations)[number] | null = null;
    let matchedDistance = Number.POSITIVE_INFINITY;

    for (const loc of locations) {
      if (loc.radiusMeters <= 0) continue; // skip ADHOC / zero-radius
      const d = haversineDistanceMeters(
        lat,
        lng,
        loc.lat,
        loc.lng
      );
      if (d <= loc.radiusMeters && d < matchedDistance) {
        matchedLocation = loc;
        matchedDistance = d;
      }
    }

    // ADHOC fallback = location with radiusMeters == 0 (if present)
    let finalLocation = matchedLocation;
    if (!finalLocation) {
      const adhoc = locations.find((l) => l.radiusMeters === 0);
      if (adhoc) {
        finalLocation = adhoc;
      }
    }

    // 4. Check for open shift
    const openShift = await prisma.shift.findFirst({
      where: {
        userId: user.id,
        clockOut: null,
      },
      orderBy: { clockIn: "desc" },
    });

    let shiftResult;
    let status: "clocked_in" | "clocked_out";

    if (openShift) {
      // CLOCK OUT
      shiftResult = await prisma.shift.update({
        where: { id: openShift.id },
        data: {
          clockOut: new Date(),
          clockOutLat: lat,
          clockOutLng: lng,
        },
        include: {
          user: true,
          location: true,
        },
      });

      status = "clocked_out";
    } else {
      // CREATE NEW SHIFT (CLOCK IN)
      shiftResult = await prisma.shift.create({
        data: {
          userId: user.id,
          locationId: finalLocation ? finalLocation.id : null,
          clockIn: new Date(),
          clockInLat: lat,
          clockInLng: lng,
        },
        include: {
          user: true,
          location: true,
        },
      });

      status = "clocked_in";
    }

    // 5. Compute weekly hours AFTER this action
    const totalHoursThisPeriod = await computeWeeklyHours(user.id);

    return NextResponse.json({
      status,
      message:
        status === "clocked_in"
          ? "Clock-in recorded"
          : "Clock-out recorded",
      shift: shiftResult,
      locationName: shiftResult.location?.name ?? null,
      totalHoursThisPeriod,
    });
  } catch (err) {
    console.error("Clock API error:", err);
    return NextResponse.json(
      { error: "Unexpected server error while clocking in/out." },
      { status: 500 }
    );
  }
}