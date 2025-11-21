// app/api/admin/locations/[id]/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/admin/locations/:id → update fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { name, code, lat, lng, radiusMeters, active } = body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (code !== undefined) data.code = code;
    if (lat !== undefined) data.lat = Number(lat);
    if (lng !== undefined) data.lng = Number(lng);
    if (radiusMeters !== undefined) data.radiusMeters = Number(radiusMeters);
    if (active !== undefined) data.active = active;

    const updated = await prisma.location.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Error updating location:", err);
    const message =
      err instanceof Error ? err.message : "Failed to update location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/admin/locations/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    await prisma.location.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting location:", err);
    const message =
      err instanceof Error ? err.message : "Failed to delete location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}