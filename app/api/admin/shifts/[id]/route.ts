export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

// PATCH /api/admin/shifts/:id  → update a shift
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "Shift id is required" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { clockIn, clockOut, locationId, notes, userId } = body;

    const data: any = {};

    if (clockIn) {
      const dt = new Date(clockIn);
      if (isNaN(dt.getTime())) {
        return NextResponse.json(
          { error: "Invalid clockIn datetime" },
          { status: 400 }
        );
      }
      data.clockIn = dt;
    }

    if (clockOut !== undefined) {
      if (clockOut === null || clockOut === "") {
        data.clockOut = null;
      } else {
        const dt = new Date(clockOut);
        if (isNaN(dt.getTime())) {
          return NextResponse.json(
            { error: "Invalid clockOut datetime" },
            { status: 400 }
          );
        }
        data.clockOut = dt;
      }
    }

    if (locationId !== undefined) {
      data.locationId = locationId || null;
    }

    if (notes !== undefined) {
      data.notes = notes;
    }

    if (userId !== undefined) {
      data.userId = userId;
    }

    const shift = await prisma.shift.update({
      where: { id },
      data,
      include: {
        user: true,
        location: true,
      },
    });

    return NextResponse.json(shift);
  } catch (err) {
    console.error("Error updating shift:", err);
    return NextResponse.json(
      { error: "Failed to update shift" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/shifts/:id → delete a shift
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "Shift id is required" }, { status: 400 });
  }

  try {
    await prisma.shift.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting shift:", err);
    return NextResponse.json(
      { error: "Failed to delete shift" },
      { status: 500 }
    );
  }
}