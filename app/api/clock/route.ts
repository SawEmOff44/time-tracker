// app/api/clock/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Haversine distance in meters between two lat/lng points
 */
function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const {
      employeeCode,
      pin,
      lat: rawLat,
      lng: rawLng,
      locationId: clientLocationId,
    } = body as {
      employeeCode?: string;
      pin?: string;
      lat?: number | string;
      lng?: number | string;
      locationId?: string;
    };

    if (!employeeCode || !pin) {
      return NextResponse.json(
        { error: "Employee code and PIN are required." },
        { status: 400 }
      );
    }

    // Normalize lat/lng (accept string OR number)
    const lat = Number(rawLat);
    const lng = Number(rawLng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: "Valid GPS coordinates are required." },
        { status: 400 }
      );
    }

    // 1. Look up active user by employee code
    const user = await prisma.user.findFirst({
      where: {
        employeeCode,
        active: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN." },
        { status: 401 }
      );
    }

    // 2. PIN check using pinHash (plain compare for now)
    if (!user.pinHash) {
      return NextResponse.json(
        { error: "No PIN set for this employee." },
        { status: 401 }
      );
    }

    if (user.pinHash !== pin) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN." },
        { status: 401 }
      );
    }

    // 3. Load active locations
    const locations = await prisma.location.findMany({
      where: { active: true },
    });

    // GPS-bound locations (radiusMeters > 0)
    const gpsLocations = locations.filter(
      (loc) => (loc.radiusMeters ?? 0) > 0
    );

    // ADHOC template = first active location where radiusMeters <= 0
    const adhocLocation = locations.find(
      (loc) => !loc.radiusMeters || loc.radiusMeters <= 0
    );

    let matchedLocation: (typeof gpsLocations)[number] | null = null;
    let nearestDistance: number | null = null;

    // 4. Try to match GPS to one of the gpsLocations
    for (const loc of gpsLocations) {
      const dist = haversineDistanceMeters(lat, lng, loc.lat, loc.lng);

      if (dist <= (loc.radiusMeters ?? 0)) {
        if (nearestDistance === null || dist < nearestDistance) {
          nearestDistance = dist;
          matchedLocation = loc;
        }
      }
    }

    const now = new Date();

    // Helper: pick effective location for this clock event
    const pickLocationId = (
      existingLocationId?: string | null
    ): string | null => {
      // 1) Preserve any existing explicit location
      if (existingLocationId) return existingLocationId;

      // 2) Use GPS matched location if we have one
      if (matchedLocation) return matchedLocation.id;

      // 3) If no match, but we have an ADHOC template, use that
      if (adhocLocation) return adhocLocation.id;

      // 4) Fallback: leave null
      return null;
    };

    // 5. Check for an open shift (no clockOut) for this user
    const openShift = await prisma.shift.findFirst({
      where: {
        userId: user.id,
        clockOut: null,
      },
      orderBy: { clockIn: "desc" },
    });

    // If open shift exists → CLOCK OUT
    if (openShift) {
      const updated = await prisma.shift.update({
        where: { id: openShift.id },
        data: {
          clockOut: now,
          clockOutLat: lat,
          clockOutLng: lng,
          locationId: pickLocationId(openShift.locationId),
        },
        include: {
          location: true,
          user: true,
        },
      });

      const isAdhoc =
        !updated.location ||
        (updated.location.radiusMeters ?? 0) <= 0;

      return NextResponse.json({
        status: "success",
        message: isAdhoc
          ? "Clocked out (ADHOC location)."
          : `Clocked out at ${updated.location?.name}.`,
        shift: updated,
      });
    }

    // Otherwise → CLOCK IN (new shift)
    const created = await prisma.shift.create({
      data: {
        userId: user.id,
        // If the client passed a locationId explicitly, we keep it,
        // otherwise we rely on GPS/ADHOC logic.
        locationId: pickLocationId(clientLocationId),
        clockIn: now,
        clockInLat: lat,
        clockInLng: lng,
      },
      include: {
        location: true,
        user: true,
      },
    });

    const isAdhoc =
      !created.location ||
      (created.location.radiusMeters ?? 0) <= 0;

    return NextResponse.json({
      status: "success",
      message: isAdhoc
        ? "Clocked in (ADHOC location)."
        : `Clocked in at ${created.location?.name}.`,
      shift: created,
    });
  } catch (err) {
    console.error("Error in /api/clock:", err);
    return NextResponse.json(
      { error: "Server error processing clock request." },
      { status: 500 }
    );
  }
}