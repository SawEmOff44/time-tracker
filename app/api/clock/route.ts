// app/api/clock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Shape of the JSON payload returned to the clock page

type ClockResponse = {
  status: "clocked_in" | "clocked_out";
  message: string;
  locationName: string | null;
  totalHoursThisPeriod: number | null;
};

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // meters
  const toRad = (d: number) => (d * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function startOfWeek(date: Date): Date {
  // Use Monday as start-of-week for weekly hours (boss is Mon–Sat)
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMonday = (day + 6) % 7; // Mon(1)->0, Tue(2)->1, ..., Sun(0)->6
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diffToMonday);
  return d;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const employeeCode: string | undefined = body.employeeCode;
    const pin: string | undefined = body.pin;
    const lat: number | null = body.lat ?? null;
    const lng: number | null = body.lng ?? null;
    const locationId: string | null =
      typeof body.locationId === "string" ? body.locationId : null;
    const adhoc: boolean = !!body.adhoc;

    if (!employeeCode || !pin) {
      return NextResponse.json(
        { error: "Employee code and PIN are required." },
        { status: 400 }
      );
    }

    if (!adhoc && !locationId) {
      return NextResponse.json(
        {
          error:
            "Please choose a job site, or select 'Other (ADHOC)' if you are off-site.",
        },
        { status: 400 }
      );
    }

    // Look up user by employeeCode
    const user = await prisma.user.findUnique({
      where: { employeeCode },
    });

    if (!user || !user.pinHash) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN." },
        { status: 401 }
      );
    }

    const pinOk = await bcrypt.compare(pin, user.pinHash);
    if (!pinOk) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN." },
        { status: 401 }
      );
    }

    const now = new Date();

    // If not ADHOC, enforce GPS radius check for the chosen location.
    let locationName: string | null = null;
    let resolvedLocationId: string | null = null;

    if (!adhoc && locationId) {
      const location = await prisma.location.findUnique({
        where: { id: locationId },
      });

      if (!location || !location.active) {
        return NextResponse.json(
          { error: "Selected job site is not available." },
          { status: 400 }
        );
      }

      locationName = location.name;
      resolvedLocationId = location.id;

      if (location.radiusMeters > 0) {
        if (lat == null || lng == null) {
          return NextResponse.json(
            {
              error:
                "GPS is required to clock in at this job site. Please enable location services.",
            },
            { status: 400 }
          );
        }

        const distance = haversineMeters(
          lat,
          lng,
          location.lat,
          location.lng
        );

        if (distance > location.radiusMeters) {
          return NextResponse.json(
            {
              error:
                "You are outside the allowed GPS radius for this job site. If you are working at an unlisted location, choose 'Other (ADHOC)'.",
            },
            { status: 400 }
          );
        }
      }
    }

    // ADHOC selection => no locationId, flagged for review.
    if (adhoc) {
      resolvedLocationId = null;
      locationName = "ADHOC job site";
    }

    // Does the user have an open shift?
    const openShift = await prisma.shift.findFirst({
      where: { userId: user.id, clockOut: null },
      orderBy: { clockIn: "desc" },
      include: { location: true },
    });

    let status: "clocked_in" | "clocked_out";
    let message: string;

    if (!openShift) {
      // ---- CLOCK IN --------------------------------------------------------
      const created = await prisma.shift.create({
        data: {
          userId: user.id,
          locationId: resolvedLocationId,
          clockIn: now,
          clockInLat: lat,
          clockInLng: lng,
          notes: adhoc
            ? "ADHOC clock-in from clock page (Other selected)."
            : null,
        },
        include: { location: true },
      });

      status = "clocked_in";
      message = adhoc
        ? "Clocked in (ADHOC). This shift may be reviewed by admin."
        : `Clocked in at ${
            created.location?.name ?? "job site"
          }. Clock-in recorded.`;
      locationName = created.location?.name ?? locationName;
    } else {
      // ---- CLOCK OUT -------------------------------------------------------
      const updated = await prisma.shift.update({
        where: { id: openShift.id },
        data: {
          clockOut: now,
          clockOutLat: lat,
          clockOutLng: lng,
        },
        include: { location: true },
      });

      status = "clocked_out";
      locationName = updated.location?.name ?? locationName;

      message = `Clocked out${
        locationName ? ` from ${locationName}` : ""
      }. Shift recorded.`;
    }

    // Compute total hours this current Mon–Sat week for this worker
    const weekStart = startOfWeek(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekShifts = await prisma.shift.findMany({
      where: {
        userId: user.id,
        clockIn: { gte: weekStart, lte: weekEnd },
      },
    });

    let totalSeconds = 0;
    for (const s of weekShifts) {
      const out = s.clockOut ?? now;
      const diff = (out.getTime() - s.clockIn.getTime()) / 1000;
      if (diff > 0) totalSeconds += diff;
    }

    const totalHoursThisPeriod = totalSeconds / 3600;

    return NextResponse.json({
      status,
      message,
      locationName,
      totalHoursThisPeriod,
    } satisfies ClockResponse);
  } catch (err) {
    console.error("Error in /api/clock", err);
    return NextResponse.json(
      { error: "Internal error while processing clock request." },
      { status: 500 }
    );
  }
}