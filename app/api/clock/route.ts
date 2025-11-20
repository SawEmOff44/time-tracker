export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { distanceInMeters } from "@/lib/distance";

// Ensure Node.js runtime for Prisma
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { employeeCode, pin, locationId, lat, lng } = body;

    if (!employeeCode || !pin || !locationId || lat == null || lng == null) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Find user
    const user = await prisma.user.findUnique({
      where: { employeeCode },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN" },
        { status: 401 }
      );
    }

    // 2. Simple PIN check (using pinHash as plaintext pin for now)
    if (user.pinHash !== pin) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN" },
        { status: 401 }
      );
    }

    // 3. Load location
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location || !location.active) {
      return NextResponse.json(
        { error: "Invalid or inactive location" },
        { status: 400 }
      );
    }

    // 4. Geofence check – NOTE: prisma model uses lat / lng, not latitude / longitude
    const dMeters = distanceInMeters(
      lat,
      lng,
      location.lat,
      location.lng
    );

    if (dMeters > location.radiusMeters) {
      return NextResponse.json(
        {
          error: `You are too far from ${location.name}.`,
          distanceMeters: Math.round(dMeters),
          allowedRadiusMeters: location.radiusMeters,
        },
        { status: 403 }
      );
    }

    // 5. Check for open shift
    const openShift = await prisma.shift.findFirst({
      where: {
        userId: user.id,
        status: "OPEN",
        clockOut: null,
      },
      orderBy: {
        clockIn: "desc",
      },
    });

    const now = new Date();

    if (openShift) {
      // Clock OUT
      const updated = await prisma.shift.update({
        where: { id: openShift.id },
        data: {
          clockOut: now,
          status: "CLOSED",
        },
        include: {
          user: true,
          location: true,
        },
      });

      const hours =
        updated.clockIn && updated.clockOut
          ? (updated.clockOut.getTime() - updated.clockIn.getTime()) /
            (1000 * 60 * 60)
          : null;

      return NextResponse.json({
        status: "clocked-out",
        message: `Clocked out at ${updated.location.name}`,
        shift: {
          id: updated.id,
          employeeName: updated.user.name,
          employeeCode: updated.user.employeeCode,
          locationName: updated.location.name,
          clockIn: updated.clockIn,
          clockOut: updated.clockOut,
          hours,
        },
      });
    } else {
      // Clock IN
      const created = await prisma.shift.create({
        data: {
          userId: user.id,
          locationId: location.id,
          clockIn: now,
          status: "OPEN",
        },
        include: {
          user: true,
          location: true,
        },
      });

      return NextResponse.json({
        status: "clocked-in",
        message: `Clocked in at ${created.location.name}`,
        shift: {
          id: created.id,
          employeeName: created.user.name,
          employeeCode: created.user.employeeCode,
          locationName: created.location.name,
          clockIn: created.clockIn,
          clockOut: created.clockOut,
          hours: null,
        },
      });
    }
  } catch (err) {
    console.error("Error in /api/clock:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
