export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const employeeId = searchParams.get("employeeId");
    const locationId = searchParams.get("locationId");

    const where: any = {};

    if (fromParam) {
      const fromDate = new Date(fromParam);
      if (!where.clockIn) where.clockIn = {};
      where.clockIn.gte = fromDate;
    }

    if (toParam) {
      const toDate = new Date(toParam);
      if (!where.clockIn) where.clockIn = {};
      where.clockIn.lte = toDate;
    }

    if (employeeId) {
      where.userId = employeeId;
    }

    if (locationId) {
      where.locationId = locationId;
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

    return NextResponse.json(shifts);
  } catch (err) {
    console.error("Error fetching shifts:", err);
    return NextResponse.json(
      { error: "Failed to fetch shifts" },
      { status: 500 }
    );
  }
}