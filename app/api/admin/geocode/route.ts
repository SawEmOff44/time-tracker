// app/api/admin/geocode/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

// GET /api/admin/geocode?address=...
export async function GET(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address || !address.trim()) {
      return NextResponse.json(
        { error: "Missing address query parameter" },
        { status: 400 }
      );
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      address
    )}`;

    // Nominatim requires a User-Agent
    const res = await fetch(url, {
      headers: {
        "User-Agent": "rhinehart-time-tracker/1.0 (admin@rhinehart.example)",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to contact geocoding provider" },
        { status: 502 }
      );
    }

    const json = (await res.json()) as any[];

    if (!json || json.length === 0) {
      return NextResponse.json(
        { error: "No results found for that address" },
        { status: 404 }
      );
    }

    const first = json[0];
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: "Invalid coordinates returned from provider" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      lat,
      lng,
      formattedAddress: first.display_name as string,
    });
  } catch (err) {
    console.error("Error in geocode endpoint:", err);
    return NextResponse.json(
      { error: "Failed to geocode address" },
      { status: 500 }
    );
  }
}