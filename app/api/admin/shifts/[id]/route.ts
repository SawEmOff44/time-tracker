// app/api/admin/shifts/[id]/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Same cookie check as above
function isAdminRequest(req: NextRequest): boolean {
  const cookieHeader = req.headers.get("cookie") || "";
  return cookieHeader.includes("admin_session=ok");
}

// PATCH /api/admin/shifts/:id → update times (and optionally location)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminRequest(req)) {
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
      locationId?: string | null;
    };

    const data: any = {};

    if (clockIn !== undefined) {
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

    if (locationId !== undefined) {
      data.locationId = locationId || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const updated = await prisma.shift.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Error updating shift:", err);
    const message =
      err instanceof Error ? err.message : "Failed to update shift";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/admin/shifts/:id → delete shift
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    await prisma.shift.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting shift:", err);
    const message =
      err instanceof Error ? err.message : "Failed to delete shift";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}