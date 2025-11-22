// app/api/clock/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Haversine distance in meters
function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
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

    const { employeeCode, pin, lat, lng } = body;

    if (
      !employeeCode ||
      !pin ||
      typeof lat !== "number" ||
      typeof lng !== "number"
    ) {
      return NextResponse.json(
        { error: "employeeCode, pin, lat, and lng are required" },
        { status: 400 }
      );
    }

    // 1) Find active user by employeeCode
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

    // 2) PIN check (using pinHash as plain PIN for now)
    if (!user.pinHash || user.pinHash !== pin) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN" },
        { status: 401 }
      );
    }

    // 3) Find open shift (no clockOut yet)
    const openShift = await prisma.shift.findFirst({
      where: {
        userId: user.id,
        clockOut: null,
      },
      orderBy: { clockIn: "desc" },
      include: {
        user: true,
        location: true,
      },
    });

    // 4) Load all active locations
    const allLocations = await prisma.location.findMany({
      where: { active: true },
    });

    // Infer a type for locations from the query result
    type LocationType = (typeof allLocations)[number];

    const adhocLocation: LocationType | null =
      allLocations.find((l: LocationType) => l.code === "ADHOC") ?? null;

    // Only use "normal" locations for geofence matching
    const normalLocations: LocationType[] = allLocations.filter(
      (l: LocationType) => l.code !== "ADHOC"
    );

    let pickedLocation: LocationType | null = null;
    let usedAdhoc = false;

    // 5) Try to match a real job site by radius
    if (normalLocations.length > 0) {
      let best: LocationType | null = null;
      let bestDist = Infinity;

      for (const loc of normalLocations) {
        const dist = distanceMeters(lat, lng, loc.lat, loc.lng);

        if (dist <= loc.radiusMeters && dist < bestDist) {
          best = loc;
          bestDist = dist;
        }
      }

      if (best) {
        pickedLocation = best;
      }
    }

    // 6) Fallback: use ADHOC if no real site matched
    if (!pickedLocation) {
      if (adhocLocation) {
        pickedLocation = adhocLocation;
        usedAdhoc = true;
      } else {
        // Create ADHOC if it doesn't exist yet, using current coords as seed
        const newAdhoc = await prisma.location.create({
          data: {
            name: "ADHOC",
            code: "ADHOC",
            lat,
            lng,
            radiusMeters: 0,
            active: true,
          },
        });
        pickedLocation = newAdhoc as LocationType;
        usedAdhoc = true;
      }
    }

    // 7) If there was an open shift, this is a clock OUT
    if (openShift) {
      const updated = await prisma.shift.update({
        where: { id: openShift.id },
        data: {
          clockOut: new Date(),
          clockOutLat: lat,
          clockOutLng: lng,
          // If the open shift somehow had no location, attach our picked one
          locationId: openShift.locationId ?? pickedLocation!.id,
        },
        include: {
          user: true,
          location: true,
        },
      });

      return NextResponse.json({
        status: "clocked_out",
        message: `Clocked OUT at ${pickedLocation!.name}${
          usedAdhoc ? " (ADHOC)" : ""
        }`,
        shift: updated,
      });
    }

    // 8) Otherwise, this is a clock IN
    const created = await prisma.shift.create({
      data: {
        userId: user.id,
        locationId: pickedLocation!.id,
        clockIn: new Date(),
        clockInLat: lat,
        clockInLng: lng,
      },
      include: {
        user: true,
        location: true,
      },
    });

    return NextResponse.json({
      status: "clocked_in",
      message: `Clocked IN at ${pickedLocation!.name}${
        usedAdhoc ? " (ADHOC)" : ""
      }`,
      shift: created,
    });
  } catch (err) {
    console.error("Error in /api/clock:", err);
    return NextResponse.json(
      { error: "Server error while clocking in/out" },
      { status: 500 }
    );
  }
}