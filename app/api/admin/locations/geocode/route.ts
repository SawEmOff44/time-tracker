export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

// POST /api/admin/locations/geocode
export async function POST(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.query !== "string" || !body.query.trim()) {
      return NextResponse.json({ error: "Missing query in body" }, { status: 400 });
    }

    const query = body.query.trim();

    // Try Nominatim (OpenStreetMap) first
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        query
      )}`;

      const nomRes = await fetch(nomUrl, {
        headers: {
          "User-Agent": "rhinehart-time-tracker/1.0 (admin@rhinehart.example)",
        },
      });

      if (nomRes.ok) {
        const nomJson = (await nomRes.json()) as any[];
        if (Array.isArray(nomJson) && nomJson.length > 0) {
          const first = nomJson[0];
          const lat = parseFloat(first.lat);
          const lng = parseFloat(first.lon);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return NextResponse.json({ lat, lng, formattedAddress: first.display_name });
          }
        }
      }
    } catch (err) {
      // swallow and try fallback
      console.warn("Nominatim geocode error, will try fallback:", err);
    }

    // Fallback: Google Geocoding API if key present
    const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (GOOGLE_KEY) {
      try {
        const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          query
        )}&key=${encodeURIComponent(GOOGLE_KEY)}`;

        const gRes = await fetch(gUrl);
        if (gRes.ok) {
          const gJson = await gRes.json();
          if (gJson.status === "OK" && Array.isArray(gJson.results) && gJson.results.length > 0) {
            const r = gJson.results[0];
            const lat = r.geometry.location.lat;
            const lng = r.geometry.location.lng;
            const formattedAddress = r.formatted_address;
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              return NextResponse.json({ lat, lng, formattedAddress });
            }
          } else {
            console.warn("Google geocode returned no results or status", gJson.status, gJson.error_message);
          }
        }
      } catch (err) {
        console.warn("Google geocode error:", err);
      }
    }

    return NextResponse.json({ error: "No results found for that address" }, { status: 404 });
  } catch (err) {
    console.error("Error in admin locations geocode endpoint:", err);
    return NextResponse.json({ error: "Failed to geocode address" }, { status: 500 });
  }
}
