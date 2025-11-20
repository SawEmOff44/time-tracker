import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { distanceInMeters } from "@/lib/distance";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Clock API is reachable",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { employeeCode, pin, locationId, lat, lng } = body;

  if (!employeeCode || !pin || !locationId || lat == null || lng == null) {
    return NextResponse.json(
      { status: "error", error: "Missing required fields" },
      { status: 400 }
    );
  }

  // 1. Find employee
  const user = await prisma.user.findUnique({
    where: { employeeCode },
  });

  if (!user || !user.pinHash) {
    return NextResponse.json(
      { status: "error", error: "Invalid employee or PIN" },
      { status: 401 }
    );
  }

  // 2. Check PIN
  const pinOk = await bcrypt.compare(String(pin), user.pinHash);
  if (!pinOk) {
    return NextResponse.json(
      { status: "error", error: "Invalid employee or PIN" },
      { status: 401 }
    );
  }

  // 3. Load location
  const location = await prisma.location.findUnique({
    where: { id: locationId },
  });

  if (!location) {
    return NextResponse.json(
      { status: "error", error: "Unknown location" },
      { status: 400 }
    );
  }

  // 4. Calculate distance
  const dMeters = distanceInMeters(lat, lng, location.lat, location.lng);

  // 5. Check existing shift
  const openShift = await prisma.shift.findFirst({
    where: {
      userId: user.id,
      status: "OPEN",
    },
    orderBy: { clockIn: "desc" },
  });

  // CLOCK-OUT LOGIC
  if (openShift) {
    const updated = await prisma.shift.update({
      where: { id: openShift.id },
      data: {
        clockOut: new Date(),
        status: "CLOSED",
      },
    });

    const hours =
      updated.clockOut && updated.clockIn
        ? (updated.clockOut.getTime() - updated.clockIn.getTime()) /
          (1000 * 60 * 60)
        : null;

    return NextResponse.json({
      status: "ok",
      message: "Clocked out successfully.",
      shift: {
        id: updated.id,
        location: location.name,
        clockIn: updated.clockIn,
        clockOut: updated.clockOut,
        hours,
      },
    });
  }

  // CLOCK-IN LOGIC (requires being inside geofence)
  if (dMeters > location.radiusMeters) {
    return NextResponse.json(
      {
        status: "error",
        error: `Too far from ${location.name} to clock in (dist ≈ ${Math.round(
          dMeters
        )}m, allowed ${location.radiusMeters}m).`,
      },
      { status: 403 }
    );
  }

  const newShift = await prisma.shift.create({
    data: {
      userId: user.id,
      locationId: location.id,
      clockIn: new Date(),
      status: "OPEN",
    },
  });

  return NextResponse.json({
    status: "ok",
    message: "Clocked in successfully.",
    shift: {
      id: newShift.id,
      location: location.name,
      clockIn: newShift.clockIn,
    },
  });
}
