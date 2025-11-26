import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PayrollLocationBreakdown = {
  locationId: string | null;
  locationName: string | null;
  totalHours: number;
  totalWages: number;
};

type PayrollDayBreakdown = {
  date: string; // YYYY-MM-DD
  weekday: string; // Mon, Tue, ...
  totalHours: number;
  totalWages: number;
  perLocation: PayrollLocationBreakdown[];
};

type PayrollRow = {
  userId: string;
  name: string;
  employeeCode: string | null;
  hourlyRate: number | null;
  totalHours: number;
  totalWages: number;
  shiftCount: number;
  perLocation: PayrollLocationBreakdown[];
  perDay: PayrollDayBreakdown[];
};

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function yyyymmdd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekdayShort(d: Date): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");
    const userIdFilter = searchParams.get("userId"); // optional (for worker portal later)

    const start = parseDateParam(startStr);
    const end = parseDateParam(endStr);

    if (!start || !end) {
      return NextResponse.json(
        { error: "start and end query params are required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Make end exclusive by adding 1 day
    const endExclusive = new Date(end);
    endExclusive.setDate(endExclusive.getDate() + 1);

    const shifts = await prisma.shift.findMany({
      where: {
        clockIn: {
          gte: start,
          lt: endExclusive,
        },
        ...(userIdFilter ? { userId: userIdFilter } : {}),
        user: {
          active: true,
        },
      },
      include: {
        user: true,
        location: true,
      },
      orderBy: {
        clockIn: "asc",
      },
    });

    const userMap = new Map<string, PayrollRow>();

    for (const shift of shifts) {
      if (!shift.clockOut) continue; // ignore open shifts

      const user = shift.user;
      if (!user) continue;

      const location = shift.location;
      const hours =
        (shift.clockOut.getTime() - shift.clockIn.getTime()) / (1000 * 60 * 60);
      if (hours <= 0) continue;

      const hourlyRate = user.hourlyRate ?? 0;
      const wages = hourlyRate * hours;

      let row = userMap.get(user.id);
      if (!row) {
        row = {
          userId: user.id,
          name: user.name,
          employeeCode: user.employeeCode ?? null,
          hourlyRate: user.hourlyRate ?? null,
          totalHours: 0,
          totalWages: 0,
          shiftCount: 0,
          perLocation: [],
          perDay: [],
        };
        userMap.set(user.id, row);
      }

      row.totalHours += hours;
      row.totalWages += wages;
      row.shiftCount += 1;

      // ---- per-location aggregation ----
      const locId = location?.id ?? null;
      const locName = location?.name ?? (location ? "Unnamed job site" : "ADHOC");

      let locRow = row.perLocation.find((l) => l.locationId === locId);
      if (!locRow) {
        locRow = {
          locationId: locId,
          locationName: locName,
          totalHours: 0,
          totalWages: 0,
        };
        row.perLocation.push(locRow);
      }
      locRow.totalHours += hours;
      locRow.totalWages += wages;

      // ---- per-day + per-location-inside-day ----
      const dayKey = yyyymmdd(shift.clockIn);
      const dayWeekday = weekdayShort(shift.clockIn);

      let dayRow = row.perDay.find((d) => d.date === dayKey);
      if (!dayRow) {
        dayRow = {
          date: dayKey,
          weekday: dayWeekday,
          totalHours: 0,
          totalWages: 0,
          perLocation: [],
        };
        row.perDay.push(dayRow);
      }

      dayRow.totalHours += hours;
      dayRow.totalWages += wages;

      let dayLocRow = dayRow.perLocation.find(
        (l) => l.locationId === locId
      );
      if (!dayLocRow) {
        dayLocRow = {
          locationId: locId,
          locationName: locName,
          totalHours: 0,
          totalWages: 0,
        };
        dayRow.perLocation.push(dayLocRow);
      }
      dayLocRow.totalHours += hours;
      dayLocRow.totalWages += wages;
    }

    const rows: PayrollRow[] = Array.from(userMap.values()).map((row) => ({
      ...row,
      totalHours: Number(row.totalHours.toFixed(2)),
      totalWages: Number(row.totalWages.toFixed(2)),
      perLocation: row.perLocation
        .map((l) => ({
          ...l,
          totalHours: Number(l.totalHours.toFixed(2)),
          totalWages: Number(l.totalWages.toFixed(2)),
        }))
        .sort((a, b) => (b.totalHours ?? 0) - (a.totalHours ?? 0)),
      perDay: row.perDay
        .map((d) => ({
          ...d,
          totalHours: Number(d.totalHours.toFixed(2)),
          totalWages: Number(d.totalWages.toFixed(2)),
          perLocation: d.perLocation
            .map((l) => ({
              ...l,
              totalHours: Number(l.totalHours.toFixed(2)),
              totalWages: Number(l.totalWages.toFixed(2)),
            }))
            .sort((a, b) => (b.totalHours ?? 0) - (a.totalHours ?? 0)),
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("Payroll GET error", err);
    return NextResponse.json(
      { error: "Failed to load payroll data" },
      { status: 500 }
    );
  }
}