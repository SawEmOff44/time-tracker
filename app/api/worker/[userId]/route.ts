import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: {
    userId: string; // this is employeeCode from the URL
  };
};

// Helper: compute hours between clockIn/clockOut
function computeHours(clockIn: Date, clockOut: Date | null): number {
  if (!clockOut) return 0;
  const diffMs = clockOut.getTime() - clockIn.getTime();
  if (diffMs <= 0) return 0;
  return diffMs / (1000 * 60 * 60);
}

// GET /api/worker/[userId]  -> worker payload used by WorkerProfilePage
export async function GET(_req: NextRequest, context: RouteContext) {
  const employeeCode = decodeURIComponent(context.params.userId);

  if (!employeeCode) {
    return NextResponse.json(
      { error: "Missing employee code in URL." },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { employeeCode }, // employeeCode is unique in your schema
      include: {
        // Most recent 50 shifts
        shifts: {
          orderBy: { clockIn: "desc" },
          take: 50,
          include: {
            location: true,
          },
        },
        // Documents relation already exists on User (from your Prisma types)
        documents: {
          where: {
            visibleToWorker: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Worker not found." },
        { status: 404 }
      );
    }

    const shifts = user.shifts.map((s) => ({
      id: s.id,
      clockIn: s.clockIn.toISOString(),
      clockOut: s.clockOut ? s.clockOut.toISOString() : null,
      locationName: s.location?.name ?? s.locationId ?? "Unknown",
      // If you have an `adhoc` field on Shift, use it. Otherwise treat
      // "no location" as adhoc.
      adhoc: (s as any).adhoc ?? !s.locationId,
      hours:
        (s as any).hours != null
          ? Number((s as any).hours)
          : computeHours(s.clockIn, s.clockOut),
      notes: (s as any).notes ?? null,
    }));

    const documents =
      user.documents?.map((d) => ({
        id: d.id,
        title: d.title,
        url: d.url,
        description: d.description,
        createdAt: d.createdAt.toISOString(),
      })) ?? [];

    const payload = {
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
      documents,
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Error loading worker data", err);
    return NextResponse.json(
      { error: "Error loading worker data." },
      { status: 500 }
    );
  }
}

// PATCH /api/worker/[userId]  -> update contact info (from worker portal)
export async function PATCH(req: NextRequest, context: RouteContext) {
  const employeeCode = decodeURIComponent(context.params.userId);

  if (!employeeCode) {
    return NextResponse.json(
      { error: "Missing employee code in URL." },
      { status: 400 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const {
    name,
    email,
    phone,
    addressLine1,
    addressLine2,
    city,
    state,
    postalcode,
  } = body ?? {};

  // Build update object, allowing nulls to clear values, but ignoring undefined
  const data: Record<string, any> = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;
  if (phone !== undefined) data.phone = phone;
  if (addressLine1 !== undefined) data.addressLine1 = addressLine1;
  if (addressLine2 !== undefined) data.addressLine2 = addressLine2;
  if (city !== undefined) data.city = city;
  if (state !== undefined) data.state = state;
  if (postalcode !== undefined) data.postalcode = postalcode;

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No updatable fields provided." },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.user.update({
      where: { employeeCode },
      data,
    });

    // Return the shape WorkerProfilePage expects in saveContactInfo()
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
    console.error("Error updating worker contact info", err);
    return NextResponse.json(
      { error: "Failed to save contact information." },
      { status: 500 }
    );
  }
}