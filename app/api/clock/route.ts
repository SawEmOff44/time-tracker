// app/api/clock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { distanceInMeters } from "@/lib/distance";

// Shape of the JSON payload returned to the clock page

type ClockResponse = {
  status: "clocked_in" | "clocked_out";
  message: string;
  locationName: string | null;
  totalHoursThisPeriod: number | null;
};

// Use shared distance utility (Haversine) from `lib/distance`.

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

    // Resolve location metadata early, but defer GPS enforcement until
    // we know whether this request is a clock-in. This avoids requiring
    // GPS when a user is clocking out (which previously caused false
    // failures if the client didn't include fresh coordinates).
    let locationName: string | null = null;
    let resolvedLocationId: string | null = null;
    let resolvedLocation: any | null = null;

    if (!adhoc && locationId) {
      resolvedLocation = await prisma.location.findUnique({
        where: { id: locationId },
      });

      if (!resolvedLocation || !resolvedLocation.active) {
        return NextResponse.json(
          { error: "Selected job site is not available." },
          { status: 400 }
        );
      }

      locationName = resolvedLocation.name;
      resolvedLocationId = resolvedLocation.id;
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
      // If the chosen location requires GPS, enforce it here so clock-out
      // requests aren't blocked by GPS validation.
      if (!adhoc && resolvedLocation && resolvedLocation.radiusMeters > 0) {
        const CLOCKIN_TOLERANCE = 75; // meters of GPS noise allowance for clock-in
        if (lat == null || lng == null) {
          return NextResponse.json(
            {
              error:
                "GPS is required to clock in at this job site. Please enable location services.",
            },
            { status: 400 }
          );
        }

        // Simple validation / swap-detection heuristics
        const providedInvalid = Math.abs(lat) > 90 || Math.abs(lng) > 180;
        const maybeSwapped = Math.abs(lat) > 90 && Math.abs(lng) <= 90;
        const siteCoordsInvalid =
          resolvedLocation &&
          (Math.abs(resolvedLocation.lat) > 90 || Math.abs(resolvedLocation.lng) > 180);

        if (providedInvalid || siteCoordsInvalid || maybeSwapped) {
          console.warn("Clock-in GPS suspicious values", {
            employeeCode,
            provided: { lat, lng, providedInvalid, maybeSwapped },
            site: resolvedLocation
              ? { lat: resolvedLocation.lat, lng: resolvedLocation.lng, siteCoordsInvalid }
              : null,
          });

          const baseError =
            "You are outside the allowed GPS radius for this job site. If you are working at an unlisted location, choose 'Other (ADHOC)'.";

          if (process.env.NODE_ENV !== "production") {
            return NextResponse.json(
              {
                error: baseError,
                details: {
                  providedInvalid,
                  maybeSwapped,
                  siteCoordsInvalid,
                  providedLat: lat,
                  providedLng: lng,
                  siteLat: resolvedLocation?.lat,
                  siteLng: resolvedLocation?.lng,
                },
              },
              { status: 400 }
            );
          }

          return NextResponse.json({ error: baseError }, { status: 400 });
        }

        const distance = distanceInMeters(lat, lng, resolvedLocation.lat, resolvedLocation.lng);

        const allowed = distance <= (resolvedLocation.radiusMeters + CLOCKIN_TOLERANCE);

        if (!allowed) {
          // Log diagnostic info to server logs to help debug failures.
          console.warn("Clock-in GPS rejected", {
            employeeCode,
            provided: { lat, lng },
            site: { lat: resolvedLocation.lat, lng: resolvedLocation.lng },
            radius: resolvedLocation.radiusMeters,
            distance,
            allowedRadius: resolvedLocation.radiusMeters + CLOCKIN_TOLERANCE,
          });

          const baseError =
            "You are outside the allowed GPS radius for this job site. If you are working at an unlisted location, choose 'Other (ADHOC)'.";

          // Only include diagnostics in non-production to avoid leaking coords.
          if (process.env.NODE_ENV !== "production") {
            return NextResponse.json(
              {
                error: baseError,
                details: {
                  distance: Math.round(distance),
                  radius: resolvedLocation.radiusMeters,
                  allowedRadius: Math.round(resolvedLocation.radiusMeters + CLOCKIN_TOLERANCE),
                  providedLat: lat,
                  providedLng: lng,
                },
              },
              { status: 400 }
            );
          }

          return NextResponse.json({ error: baseError }, { status: 400 });
        }
      }

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
      // Re-check GPS for clock-out, but be more forgiving than a strict
      // radius-only check. Strategy:
      // - If the shift or selected location is ADHOC, skip GPS enforcement.
      // - If the location has a positive radius, try the following in order:
      //   1) If client provided current lat/lng, allow if inside radius.
      //   2) If client provided lat/lng and it's slightly outside radius,
      //      allow within a small tolerance (e.g. 100m).
      //   3) If client provided lat/lng but outside tolerance, allow if
      //      the current coords are near the original clock-in coordinates.
      //   4) If client did not provide coords, fall back to the original
      //      clock-in coordinates: allow if those were within radius + tol.
      //   5) Otherwise, reject and ask for location services.

      const TOLERANCE_METERS = 100;

      if (!adhoc) {
        const site = resolvedLocation ?? openShift.location ?? null;
        if (site && site.radiusMeters && site.radiusMeters > 0) {
          // Helper to reject with consistent message.
          const rejectOutOfRange = () =>
            NextResponse.json(
              {
                error:
                  "You are outside the allowed GPS radius for this job site. If you are working at an unlisted location, choose 'Other (ADHOC)'.",
              },
              { status: 400 }
            );

          let allowed = false;

          if (lat != null && lng != null) {
              const distToSite = distanceInMeters(lat, lng, site.lat, site.lng);
            if (distToSite <= site.radiusMeters) {
              allowed = true;
            } else if (distToSite <= site.radiusMeters + TOLERANCE_METERS) {
              // Slightly outside — accept as OK
              allowed = true;
            } else if (
              openShift.clockInLat != null &&
              openShift.clockInLng != null
            ) {
              const distToClockIn = distanceInMeters(
                lat,
                lng,
                openShift.clockInLat,
                openShift.clockInLng
              );
              if (distToClockIn <= TOLERANCE_METERS) {
                allowed = true;
              }
            }
          } else {
            // No current coords — fall back to clock-in coords if present
            if (
              openShift.clockInLat != null &&
              openShift.clockInLng != null
            ) {
              const distClockInToSite = distanceInMeters(
                openShift.clockInLat,
                openShift.clockInLng,
                site.lat,
                site.lng
              );
              if (distClockInToSite <= site.radiusMeters + TOLERANCE_METERS) {
                allowed = true;
              }
            }
          }

          if (!allowed) {
            return rejectOutOfRange();
          }
        }
      }

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