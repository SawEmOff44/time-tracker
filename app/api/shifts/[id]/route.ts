// app/api/shifts/[id]/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

// PATCH /api/shifts/:id  → update an existing shift
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const {
    userId,
    employeeId, // support old name just in case
    locationId,
    clockIn,
    clockOut,
  } = body;

  const data: any = {};

  // Accept either userId or employeeId, map both to userId in DB
  const resolvedUserId = userId ?? employeeId;
  if (resolvedUserId) {
    data.userId = resolvedUserId;
  }

  if (locationId !== undefined) {
    // allow null / empty string to clear location
    data.locationId = locationId || null;
  }

  if (clockIn) {
    const ci = new Date(clockIn);
    if (Number.isNaN(ci.getTime())) {
      return NextResponse.json(
        { error: "Invalid clockIn datetime" },
        { status: 400 }
      );
    }
    data.clockIn = ci;
  }

  if (clockOut !== undefined) {
    if (clockOut === null || clockOut === "") {
      data.clockOut = null;
    } else {
      const co = new Date(clockOut);
      if (Number.isNaN(co.getTime())) {
        return NextResponse.json(
          { error: "Invalid clockOut datetime" },
          { status: 400 }
        );
      }
      data.clockOut = co;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields provided to update" },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.shift.update({
      where: { id },
      data,
      include: {
        user: true,
        location: true,
      },
    });

    const payload = {
      ...updated,
      adhoc: !updated.location || updated.location.radiusMeters === 0,
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Error updating shift:", err);
    return NextResponse.json(
      { error: "Failed to update shift" },
      { status: 500 }
    );
  }
}

// DELETE /api/shifts/:id  → delete a shift
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.shift.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting shift:", err);
    return NextResponse.json(
      { error: "Failed to delete shift" },
      { status: 500 }
    );
  }
}