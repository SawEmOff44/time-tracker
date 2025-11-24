// app/api/admin/payroll/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PayrollRow = {
  userId: string;
  name: string;
  employeeCode: string | null;
  totalHours: number;
  shiftCount: number;
};

function parseDateFromQuery(value: string | null): Date | null {
  if (!value) return null;
  // Expecting YYYY-MM-DD from the date inputs
  const d = new Date(value + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");

    const start = parseDateFromQuery(startStr);
    const end = parseDateFromQuery(endStr);

    if (!start || !end) {
      return NextResponse.json(
        { error: "Both start and end dates (YYYY-MM-DD) are required." },
        { status: 400 }
      );
    }

    // Ensure start <= end
    if (start > end) {
      return NextResponse.json(
        { error: "Start date must be before or equal to end date." },
        { status: 400 }
      );
    }

    // Treat "end" as inclusive by querying up to (end + 1 day)
    const endExclusive = new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate() + 1
    );

    const shifts = await prisma.shift.findMany({
      where: {
        clockIn: {
          gte: start,
          lt: endExclusive,
        },
      },
      include: {
        user: true,
      },
      orderBy: {
        clockIn: "asc",
      },
    });

    const map = new Map<string, PayrollRow>();

    for (const shift of shifts) {
      if (!shift.user) continue;

      // Only count completed shifts; ignore active/open ones
      if (!shift.clockOut) continue;

      const ms = shift.clockOut.getTime() - shift.clockIn.getTime();
      if (ms <= 0) continue;

      const hours = ms / 1000 / 60 / 60;
      const userId = shift.userId;

      if (!map.has(userId)) {
        map.set(userId, {
          userId,
          name: shift.user.name,
          employeeCode: shift.user.employeeCode,
          totalHours: 0,
          shiftCount: 0,
        });
      }

      const row = map.get(userId)!;
      row.totalHours += hours;
      row.shiftCount += 1;
    }

    const result = Array.from(map.values()).map((row) => ({
      ...row,
      totalHours: Number(row.totalHours.toFixed(2)),
    }));

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("Error loading payroll data", err);
    return NextResponse.json(
      { error: "Failed to load payroll data." },
      { status: 500 }
    );
  }
}