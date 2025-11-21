// app/api/shifts/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    const from = searchParams.get("from"); // YYYY-MM-DD
    const to = searchParams.get("to");     // YYYY-MM-DD

    const where: any = {};

    if (from || to) {
      const clockIn: any = {};
      if (from) {
        const fromDate = new Date(from + "T00:00:00");
        clockIn.gte = fromDate;
      }
      if (to) {
        // inclusive end-of-day
        const toDate = new Date(to + "T23:59:59.999");
        clockIn.lte = toDate;
      }
      where.clockIn = clockIn;
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        user: true,
        location: true,
      },
      orderBy: {
        clockIn: "desc",
      },
    });

    // Serialize dates to ISO strings for the client-side pages
    const serialized = shifts.map((s) => ({
      ...s,
      clockIn: s.clockIn.toISOString(),
      clockOut: s.clockOut ? s.clockOut.toISOString() : null,
    }));

    return NextResponse.json(serialized);
  } catch (err) {
    console.error("Error fetching shifts:", err);
    const message =
      err instanceof Error ? err.message : "Failed to load shifts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}