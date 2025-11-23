// app/api/shifts/[id]/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// Simple admin guard using the same cookie as other admin APIs
function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

// Helper to safely extract id
function getId(params: { id?: string | string[] }) {
  const raw = params.id;
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] : raw;
}

// GET — fetch one shift
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = getId(params);
  if (!id) return NextResponse.json({ error: "Missing shift id" }, { status: 400 });

  try {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        user: true,
        location: true,
      },
    });

    if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });

    return NextResponse.json(shift);
  } catch (err) {
    console.error("Error fetching shift:", err);
    return NextResponse.json({ error: "Failed to fetch shift" }, { status: 500 });
  }
}

// PUT — update a shift
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = getId(params);
  if (!id) return NextResponse.json({ error: "Missing shift id" }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: any = {};

  if ("clockIn" in body) data.clockIn = body.clockIn ? new Date(body.clockIn) : null;
  if ("clockOut" in body) data.clockOut = body.clockOut ? new Date(body.clockOut) : null;
  if ("locationId" in body)
    data.locationId = body.locationId ? String(body.locationId) : null;

  try {
    const updated = await prisma.shift.update({
      where: { id },
      data,
      include: {
        user: true,
        location: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Error updating shift:", err);
    return NextResponse.json({ error: "Failed to update shift" }, { status: 500 });
  }
}

// DELETE — delete the shift
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = getId(params);
  if (!id) return NextResponse.json({ error: "Missing shift id" }, { status: 400 });

  try {
    await prisma.shift.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("Error deleting shift:", err);
    return NextResponse.json({ error: "Failed to delete shift" }, { status: 500 });
  }
}