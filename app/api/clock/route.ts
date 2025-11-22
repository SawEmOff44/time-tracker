// app/api/clock/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ------------------------- UTILS ------------------------- */

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371e3; // meters
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/* ------------------------- MAIN ROUTE ------------------------- */

export async function POST(req: NextRequest) {
  try {
    const { employeeCode, pin, lat, lng } = await req.json();

    if (!employeeCode || !pin || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    /* ------------------------- 1. FETCH USER ------------------------- */
    const user = await prisma.user.findUnique({
      where: { employeeCode },
    });

    if (!user || !user.active) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN" },
        { status: 401 }
      );
    }

    if (user.pinHash !== pin) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN" },
        { status: 401 }
      );
    }

    /* ------------------------- 2. FIND NEAREST LOCATION ------------------------- */

    const activeLocations = await prisma.location.findMany({
      where: { active: true },
    });

    let matchedLocation: { id: string } | null = null;

    for (const loc of activeLocations) {
      const dist = distanceMeters(lat, lng, loc.lat, loc.lng);

      // radiusMeters = 0 → always allow match
      const radius = loc.radiusMeters ?? 0;

      if (radius === 0 || dist <= radius) {
        matchedLocation = { id: loc.id };
        break;
      }
    }

    // fallback: ADHOC location entry
    // (We could create one automatically if none exists)
    let locationId: string | null = null;

    if (matchedLocation) {
      locationId = matchedLocation.id;
    } else {
      const adhoc = await prisma.location.findFirst({
        where: { code: "ADHOC" },
      });

      if (!adhoc) {
        // Create once
        const newAdhoc = await prisma.location.create({
          data: {
            name: "Adhoc Job Site",
            code: "ADHOC",
            lat: 0,
            lng: 0,
            radiusMeters: 0,
            active: true,
          },
        });
        locationId = newAdhoc.id;
      } else {
        locationId = adhoc.id;
      }
    }

    /* ------------------------- 3. CHECK IF USER IS CLOCKING OUT ------------------------- */

    const openShift = await prisma.shift.findFirst({
      where: { userId: user.id, clockOut: null },
    });

    if (openShift) {
      const updated = await prisma.shift.update({
        where: { id: openShift.id },
        data: {
          clockOut: new Date(),
          clockOutLat: lat,
          clockOutLng: lng,
        },
      });

      return NextResponse.json({
        status: "clocked_out",
        shift: updated,
      });
    }

    /* ------------------------- 4. CREATE NEW SHIFT ------------------------- */

    const shift = await prisma.shift.create({
      data: {
        userId: user.id,
        locationId,
        clockIn: new Date(),
        clockInLat: lat,
        clockInLng: lng,
      },
    });

    return NextResponse.json({
      status: "clocked_in",
      shift,
    });
  } catch (err) {
    console.error("Clock route failed:", err);
    return NextResponse.json(
      { error: "Server error. Check logs." },
      { status: 500 }
    );
  }
}