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

// GET /api/admin/locations → list all locations
export async function GET() {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const locations = await prisma.location.findMany({
      orderBy: { name: "asc" },
    });

    const payload = locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      code: loc.code,
      lat: loc.lat,
      lng: loc.lng,
      radiusMeters: loc.radiusMeters,
      active: loc.active,
      adhoc: loc.radiusMeters === 0,
      createdAt: loc.createdAt.toISOString(),
    }));

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Error loading locations:", err);
    return NextResponse.json(
      { error: "Failed to load locations" },
      { status: 500 }
    );
  }
}

// POST /api/admin/locations → create a location
export async function POST(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { name, code, lat, lng, radiusMeters, active } = body;

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

    if (
      !Number.isFinite(parsedLat) ||
      !Number.isFinite(parsedLng)
    ) {
      return NextResponse.json(
        { error: "lat and lng must be valid numbers" },
        { status: 400 }
      );
    }

    // ✅ ALLOW 0 (unbounded / ad-hoc job site). Only disallow negative.
    if (!Number.isFinite(parsedRadius) || parsedRadius < 0) {
      return NextResponse.json(
        { error: "radiusMeters must be a non-negative number (0 or more)" },
        { status: 400 }
      );
    }

    const loc = await prisma.location.create({
      data: {
        name: trimmedName,
        code: trimmedCode,
        lat: parsedLat,
        lng: parsedLng,
        radiusMeters: parsedRadius,
        active: active ?? true,
      },
    });

    return NextResponse.json(loc, { status: 201 });
  } catch (err) {
    console.error("Error creating location:", err);
    return NextResponse.json(
      { error: "Failed to create location" },
      { status: 500 }
    );
  }
}