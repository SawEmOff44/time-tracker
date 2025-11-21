// app/api/admin/locations/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/admin/locations → list all locations
export async function GET(_req: NextRequest) {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json(locations);
  } catch (err) {
    console.error("Error loading locations:", err);
    const message =
      err instanceof Error ? err.message : "Failed to load locations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/admin/locations → create a location
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { name, code, lat, lng, radiusMeters, active } = body;

    if (!name || !code || lat == null || lng == null || radiusMeters == null) {
      return NextResponse.json(
        {
          error: "name, code, lat, lng, and radiusMeters are required",
        },
        { status: 400 }
      );
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);
    const radiusNum = Number(radiusMeters);

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return NextResponse.json(
        { error: "Latitude and longitude must be valid numbers" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(radiusNum) || radiusNum <= 0) {
      return NextResponse.json(
        { error: "Radius must be a positive number" },
        { status: 400 }
      );
    }

    const loc = await prisma.location.create({
      data: {
        name,
        code,
        lat: latNum,
        lng: lngNum,
        radiusMeters: radiusNum,
        active: active ?? true,
      },
    });

    return NextResponse.json(loc, { status: 201 });
  } catch (err) {
    console.error("Error creating location:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}