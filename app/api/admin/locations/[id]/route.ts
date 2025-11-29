export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// Simple admin check via cookie
function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

// PUT /api/admin/locations/:id → update a location
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = params.id;

  if (!id) {
    return NextResponse.json(
      { error: "Location id is required" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { name, code, lat, lng, radiusMeters, active, geofenceRadiusMeters, clockInGraceSeconds, policy } = body;

    const trimmedName = typeof name === "string" ? name.trim() : "";
    const trimmedCode = typeof code === "string" ? code.trim() : "";
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    const parsedRadius = Number(radiusMeters);

    if (!trimmedName || !trimmedCode) {
      return NextResponse.json(
        { error: "name and code are required" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      return NextResponse.json(
        { error: "lat and lng must be valid numbers" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(parsedRadius) || parsedRadius < 0) {
      return NextResponse.json(
        { error: "radiusMeters must be a non-negative number" },
        { status: 400 }
      );
    }

    const loc = await (prisma.location as any).update({
      where: { id },
      data: {
        name: trimmedName,
        code: trimmedCode,
        lat: parsedLat,
        lng: parsedLng,
        radiusMeters: parsedRadius,
        active: active ?? true,
        geofenceRadiusMeters: geofenceRadiusMeters ?? 60,
        clockInGraceSeconds: clockInGraceSeconds ?? 120,
        policy: policy ?? \"STRICT\",
      },
    });

    return NextResponse.json(loc);
  } catch (err) {
    console.error(\"Error updating location:\", err);
    return NextResponse.json(
      { error: \"Failed to update location\" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/locations/:id → delete a location
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = params.id;

  if (!id) {
    return NextResponse.json(
      { error: "Location id is required" },
      { status: 400 }
    );
  }

  try {
    // Optional: check if location has shifts
    const shiftCount = await prisma.shift.count({
      where: { locationId: id },
    });

    if (shiftCount > 0) {
      return NextResponse.json(
        {
          error:
            "This location has existing shifts and cannot be deleted. " +
            "Deactivate it instead or move those shifts first.",
        },
        { status: 400 }
      );
    }

    await prisma.location.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting location:", err);
    return NextResponse.json(
      { error: "Failed to delete location" },
      { status: 500 }
    );
  }
}