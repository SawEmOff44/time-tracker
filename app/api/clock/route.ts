// app/api/clock/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Haversine distance in meters
function distanceInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // earth radius in m
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

    const { employeeCode, pin, locationId, lat, lng } = body;

    if (!employeeCode || !pin || !locationId || lat == null || lng == null) {
      return NextResponse.json(
        { error: "employeeCode, pin, locationId, lat, and lng are required" },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { employeeCode },
    });

    if (!user || !user.active) {
      return NextResponse.json(
        { error: "Invalid employee code or inactive user" },
        { status: 401 }
      );
    }

    // Simple PIN check (plain text for now)
    if (user.pinHash && user.pinHash !== pin) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN" },
        { status: 401 }
      );
    }

    // Find location
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location || !location.active) {
      return NextResponse.json(
        { error: "Invalid or inactive location" },
        { status: 400 }
      );
    }

    const currentLat = Number(lat);
    const currentLng = Number(lng);

    if (!Number.isFinite(currentLat) || !Number.isFinite(currentLng)) {
      return NextResponse.json(
        { error: "Invalid GPS coordinates" },
        { status: 400 }
      );
    }

    // Geofence check:
    // If radiusMeters > 0, enforce distance. If radiusMeters === 0, treat as "no geofence".
    if (location.radiusMeters > 0) {
      const d = distanceInMeters(
        currentLat,
        currentLng,
        location.lat,
        location.lng
      );

      if (d > location.radiusMeters) {
        return NextResponse.json(
          {
            error:
              "You are too far from the job site to clock in/out. " +
              `Distance: ${d.toFixed(1)}m, allowed: ${location.radiusMeters}m.`,
          },
          { status: 403 }
        );
      }
    }

    // See if user has an open shift (no clockOut yet)
    const openShift = await prisma.shift.findFirst({
      where: {
        userId: user.id,
        clockOut: null,
      },
      orderBy: { clockIn: "desc" },
    });

    const now = new Date();

    // If open shift exists, clock them out
    if (openShift) {
      const updated = await prisma.shift.update({
        where: { id: openShift.id },
        data: {
          clockOut: now,
          clockOutLat: currentLat,
          clockOutLng: currentLng,
          locationId: location.id, // keep location association
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

      return NextResponse.json({
        status: "clocked_out",
        message: "Clocked out successfully",
        shift: updated,
      });
    }

    // Otherwise, create a new shift (clock in)
    const created = await prisma.shift.create({
      data: {
        userId: user.id,
        locationId: location.id,
        clockIn: now,
        clockInLat: currentLat,
        clockInLng: currentLng,
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

    return NextResponse.json({
      status: "clocked_in",
      message: "Clocked in successfully",
      shift: created,
    });
  } catch (err) {
    console.error("Error in /api/clock:", err);
    return NextResponse.json(
      { error: "Failed to clock in/out" },
      { status: 500 }
    );
  }
}