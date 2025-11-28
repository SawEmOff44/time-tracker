// app/api/worker/[userId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: { userId: string } };

function resolveUserWhere(handle: string) {
  // If it looks like a Prisma id, use `id`, otherwise treat as employeeCode
  if (handle.startsWith("cm") && handle.length > 20) {
    return { id: handle };
  }
  return { employeeCode: handle };
}

/* ------------------------ GET: worker + shifts ------------------------ */

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const handle = params.userId;

  if (!handle) {
    return NextResponse.json(
      { error: "Missing worker identifier." },
      { status: 400 }
    );
  }

  try {
    const include = {
      shifts: {
        orderBy: { clockIn: "desc" },
        take: 50,
        include: { location: true },
      },
    } as const;

    const user = await prisma.user.findUnique({
      where: resolveUserWhere(handle),
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

/* ------------------------ PATCH: update profile ------------------------ */

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const handle = params.userId;

  if (!handle) {
    return NextResponse.json(
      { error: "Missing worker identifier." },
      { status: 400 }
    );
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string | null;
      phone?: string | null;
      addressLine1?: string | null;
      addressLine2?: string | null;
      city?: string | null;
      state?: string | null;
      postalcode?: string | null;
    };

    const data: typeof body = {};

    if (typeof body.name === "string") data.name = body.name.trim();
    if (typeof body.email === "string" || body.email === null) {
      data.email = body.email ? body.email.trim() : null;
    }
    if (typeof body.phone === "string" || body.phone === null) {
      data.phone = body.phone ? body.phone.trim() : null;
    }
    if (
      typeof body.addressLine1 === "string" ||
      body.addressLine1 === null
    ) {
      data.addressLine1 = body.addressLine1
        ? body.addressLine1.trim()
        : null;
    }
    if (
      typeof body.addressLine2 === "string" ||
      body.addressLine2 === null
    ) {
      data.addressLine2 = body.addressLine2
        ? body.addressLine2.trim()
        : null;
    }
    if (typeof body.city === "string" || body.city === null) {
      data.city = body.city ? body.city.trim() : null;
    }
    if (typeof body.state === "string" || body.state === null) {
      data.state = body.state ? body.state.trim() : null;
    }
    if (
      typeof body.postalcode === "string" ||
      body.postalcode === null
    ) {
      data.postalcode = body.postalcode
        ? body.postalcode.trim()
        : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update." },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: resolveUserWhere(handle),
      data,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      employeeCode: updated.employeeCode,
      email: updated.email,
      phone: updated.phone,
      addressLine1: updated.addressLine1,
      addressLine2: updated.addressLine2,
      city: updated.city,
      state: updated.state,
      postalcode: updated.postalcode,
    });
  } catch (err) {
    console.error("Error updating worker profile", err);
    return NextResponse.json(
      { error: "Failed to update worker profile." },
      { status: 500 }
    );
  }
}