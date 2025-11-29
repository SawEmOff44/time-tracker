// app/api/admin/shifts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

// PATCH /api/admin/shifts/:id
// Edit clockIn / clockOut / locationId
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { clockIn, clockOut, locationId } = body as {
      clockIn?: string;
      clockOut?: string | null;
      locationId?: string;
    };

    const data: any = {};

    if (clockIn) {
      const d = new Date(clockIn);
      if (isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "Invalid clockIn value" },
          { status: 400 }
        );
      }
      data.clockIn = d;
    }

    if (clockOut !== undefined) {
      if (clockOut === null || clockOut === "") {
        data.clockOut = null;
      } else {
        const d = new Date(clockOut);
        if (isNaN(d.getTime())) {
          return NextResponse.json(
            { error: "Invalid clockOut value" },
            { status: 400 }
          );
        }
        data.clockOut = d;
      }
    }

    if (locationId) {
      data.locationId = locationId;
    }

    const updated = await prisma.shift.update({
      where: { id },
      data,
      include: {
        user: {
          select: { id: true, name: true, employeeCode: true },
        },
        location: {
          select: { id: true, name: true, code: true, radiusMeters: true },
        },
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

// DELETE /api/admin/shifts/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    await prisma.shift.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting shift:", err);
    return NextResponse.json(
      { error: "Failed to delete shift" },
      { status: 500 }
    );
  }
}