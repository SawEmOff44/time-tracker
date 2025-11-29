import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { distanceInMeters } from "@/lib/distance";

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

export async function POST(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { locationId, lat, lng } = body as {
      locationId?: string;
      lat?: number | null;
      lng?: number | null;
    };

    if (!locationId) {
      return NextResponse.json({ error: "locationId is required" }, { status: 400 });
    }

    const location = await prisma.location.findUnique({ where: { id: locationId } });
    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const providedLat = typeof lat === "number" ? lat : null;
    const providedLng = typeof lng === "number" ? lng : null;

    const providedInvalid = providedLat == null || providedLng == null || Math.abs(providedLat) > 90 || Math.abs(providedLng) > 180;
    const maybeSwapped = providedLat != null && providedLng != null && Math.abs(providedLat) > 90 && Math.abs(providedLng) <= 90;
    const siteCoordsInvalid = Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180;

    const TOLERANCE = 75; // keep in sync with server tolerance

    let distance: number | null = null;
    let allowed = false;

    if (providedLat != null && providedLng != null) {
      distance = distanceInMeters(providedLat, providedLng, location.lat, location.lng);
      allowed = distance <= (location.radiusMeters + TOLERANCE);
    }

    return NextResponse.json({
      locationId: location.id,
      locationName: location.name,
      siteLat: location.lat,
      siteLng: location.lng,
      siteRadiusMeters: location.radiusMeters,
      providedLat,
      providedLng,
      providedInvalid,
      maybeSwapped,
      siteCoordsInvalid,
      distance: distance != null ? Math.round(distance) : null,
      allowed,
      toleranceMeters: TOLERANCE,
    });
  } catch (err) {
    console.error("Error in /api/admin/debug/clock-check", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
