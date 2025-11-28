// app/api/worker/[userId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: { userId: string };
};

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const handle = params.userId; // e.g. "KYLE" or a Prisma id

  if (!handle) {
    return NextResponse.json(
      { error: "Missing worker identifier." },
      { status: 400 }
    );
  }

  try {
    // Decide how to look this worker up:
    // - If it looks like a Prisma id (starts with "cm" and long), use `id`
    // - Otherwise treat it as an employeeCode like "KYLE"
    const include = {
      shifts: {
        orderBy: { clockIn: "desc" },
        take: 50,
        include: { location: true },
      },
    } as const;

    let user =
      handle.startsWith("cm") && handle.length > 20
        ? await prisma.user.findUnique({
            where: { id: handle },
            include,
          })
        : await prisma.user.findUnique({
            where: { employeeCode: handle },
            include,
          });

    if (!user) {
      return NextResponse.json(
        { error: "Worker not found." },
        { status: 404 }
      );
    }

    const shifts = user.shifts.map((s) => {
      const clockIn = s.clockIn;
      const clockOut = s.clockOut;
      const effectiveOut = clockOut ?? new Date();
      const diffMs = effectiveOut.getTime() - clockIn.getTime();
      const hours = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;

      return {
        id: s.id,
        clockIn: clockIn.toISOString(),
        clockOut: clockOut ? clockOut.toISOString() : null,
        locationName:
          s.location?.name ??
          (s.locationId ? "Job site" : "ADHOC job site"),
        adhoc: !s.locationId,
        hours,
        notes: s.notes,
      };
    });

    return NextResponse.json({
      worker: {
        id: user.id,
        name: user.name,
        employeeCode: user.employeeCode,
        // contact fields for later UI
        email: user.email,
        phone: user.phone,
        addressLine1: user.addressLine1,
        addressLine2: user.addressLine2,
        city: user.city,
        state: user.state,
        postalcode: user.postalcode,
      },
      shifts,
    });
  } catch (err) {
    console.error("Error loading worker data", err);
    return NextResponse.json(
      { error: "Failed to load worker data" },
      { status: 500 }
    );
  }
}