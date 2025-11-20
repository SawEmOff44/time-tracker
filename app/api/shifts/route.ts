import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from"); // YYYY-MM-DD
    const to = searchParams.get("to");     // YYYY-MM-DD

    const where: any = {};

    if (from || to) {
      where.clockIn = {};

      if (from) {
        where.clockIn.gte = new Date(from);
      }

      if (to) {
        // make "to" inclusive by adding 1 day
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1);
        where.clockIn.lt = toDate;
      }
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

    const result = shifts.map((s) => {
      const hours =
        s.clockOut && s.clockIn
          ? (s.clockOut.getTime() - s.clockIn.getTime()) /
            (1000 * 60 * 60)
          : null;

      return {
        id: s.id,
        employeeCode: s.user.employeeCode,
        employeeName: s.user.name,
        locationName: s.location.name,
        status: s.status,
        clockIn: s.clockIn,
        clockOut: s.clockOut,
        hours,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Error fetching shifts", err);
    return NextResponse.json(
      { error: "Failed to load shifts" },
      { status: 500 }
    );
  }
}
