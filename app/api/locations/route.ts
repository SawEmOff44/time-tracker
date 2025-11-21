export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const locations = await prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        lat: true,
        lng: true,
        radiusMeters: true,
      },
    });

    return NextResponse.json(locations);
  } catch (err) {
    console.error("Error loading public locations:", err);
    const message =
      err instanceof Error ? err.message : "Failed to load locations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}