// app/api/clock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

type ClockResponse = {
  status: "clocked_in" | "clocked_out";
  message: string;
  locationName: string | null;
  totalHoursThisPeriod: number | null;
};

// Simple haversine distance in meters
function distanceInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Get current week range for Mon–Sat around `base`
function getCurrentWeekMonSat(base = new Date()) {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // How many days since Monday?
  const daysSinceMonday = (day + 6) % 7; // Mon=1 -> 0, Tue=2 ->1, ..., Sun=0 ->6
  const start = new Date(d);
  start.setDate(start.getDate() - daysSinceMonday); // Monday

  const end = new Date(start);
  end.setDate(end.getDate() + 5); // Saturday
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

async function computeWeeklyHours(userId: string): Promise<number> {
  const { start, end } = getCurrentWeekMonSat();

  const shifts = await prisma.shift.findMany({
    where: {
      userId,
      clockOut: { not: null },
      clockIn: {
        gte: start,
        lte: end,
      },
    },
    select: {
      clockIn: true,
      clockOut: true,
    },
  });

  let totalMs = 0;
  for (const s of shifts) {
    if (!s.clockOut) continue;
    const ms = s.clockOut.getTime() - s.clockIn.getTime();
    if (ms > 0) totalMs += ms;
  }

  const hours = totalMs / (1000 * 60 * 60);
  return Number(hours.toFixed(2));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const employeeCode: string | undefined = body.employeeCode?.trim();
    const pin: string | undefined = body.pin?.trim();
    const lat: number | null =
      typeof body.lat === "number" ? body.lat : null;
    const lng: number | null =
      typeof body.lng === "number" ? body.lng : null;

    if (!employeeCode || !pin) {
      return NextResponse.json(
        { error: "Employee code and PIN are required." },
        { status: 400 }
      );
    }

    // --- Find active user by employeeCode ------------------------------
    const user = await prisma.user.findFirst({
      where: {
        employeeCode: employeeCode,
        active: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Employee code not found or inactive." },
        { status: 400 }
      );
    }

    if (!user.pinHash) {
      return NextResponse.json(
        { error: "No PIN is set for this user." },
        { status: 400 }
      );
    }

    // --- Proper PIN check against hashed pinHash -----------------------
    const pinOk = await bcrypt.compare(pin, user.pinHash);
    if (!pinOk) {
      return NextResponse.json(
        { error: "Invalid PIN." },
        { status: 400 }
      );
    }

    const now = new Date();

    // --- Determine if they are currently clocked in --------------------
    const openShift = await prisma.shift.findFirst({
      where: {
        userId: user.id,
        clockOut: null,
      },
      orderBy: {
        clockIn: "desc",
      },
    });

    // --- Helper: resolve location from GPS, if provided ---------------
    let resolvedLocationId: string | null = null;
    let resolvedLocationName: string | null = null;

    if (lat != null && lng != null) {
      const locations = await prisma.location.findMany({
        where: { active: true },
      });

      let best: { id: string; name: string; dist: number; radius: number } | null =
        null;

      for (const loc of locations) {
        const d = distanceInMeters(lat, lng, loc.lat, loc.lng);
        if (d <= loc.radiusMeters) {
          if (!best || d < best.dist) {
            best = {
              id: loc.id,
              name: loc.name,
              dist: d,
              radius: loc.radiusMeters,
            };
          }
        }
      }

      if (best) {
        resolvedLocationId = best.id;
        resolvedLocationName = best.name;
      } else {
        resolvedLocationId = null;
        resolvedLocationName = "ADHOC job site";
      }
    } else {
      // No GPS, treat as ADHOC
      resolvedLocationId = null;
      resolvedLocationName = "ADHOC job site";
    }

    let response: ClockResponse;

    if (openShift) {
      // ---------- CLOCK OUT -------------------------------------------
      // Use the existing shift's location for label
      let locationName: string | null = resolvedLocationName;

      if (openShift.locationId) {
        const loc = await prisma.location.findUnique({
          where: { id: openShift.locationId },
        });
        if (loc) {
          locationName = loc.name;
        }
      }

      await prisma.shift.update({
        where: { id: openShift.id },
        data: {
          clockOut: now,
          clockOutLat: lat,
          clockOutLng: lng,
        },
      });

      const weeklyHours = await computeWeeklyHours(user.id);

      response = {
        status: "clocked_out",
        message: "Clock-out recorded.",
        locationName: locationName,
        totalHoursThisPeriod: weeklyHours,
      };
    } else {
      // ---------- CLOCK IN --------------------------------------------
      const newShift = await prisma.shift.create({
        data: {
          userId: user.id,
          locationId: resolvedLocationId,
          clockIn: now,
          clockInLat: lat,
          clockInLng: lng,
        },
      });

      // fresh weekly hours (will include this shift later, once clocked out)
      const weeklyHours = await computeWeeklyHours(user.id);

      response = {
        status: "clocked_in",
        message: "Clock-in recorded.",
        locationName: resolvedLocationName,
        totalHoursThisPeriod: weeklyHours,
      };
    }

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("Error in /api/clock", err);
    return NextResponse.json(
      { error: "Unexpected error while processing clock request." },
      { status: 500 }
    );
  }
}