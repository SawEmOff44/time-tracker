// app/api/admin/payroll/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ----- Date helpers: Monday–Saturday pay periods ---------------------------

// Parse "YYYY-MM-DD" as a local date (midnight)
function parseISOToLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  return new Date(y, m - 1, d);
}

// Turn a Date (local) into "YYYY-MM-DD"
function toISODateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Return Monday–Saturday period that contains "today"
function getCurrentPayPeriod(today = new Date()) {
  const day = today.getDay(); // 0=Sun,1=Mon,...,6=Sat

  // We want Monday as start.
  // Example: Mon(1)->0, Tue(2)->1, ..., Sun(0)->6 (days since Monday)
  const daysSinceMonday = (day - 1 + 7) % 7;

  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - daysSinceMonday
  );
  const end = new Date(start);
  end.setDate(end.getDate() + 5); // Monday + 5 => Saturday

  return {
    startDateStr: toISODateLocal(start),
    endDateStr: toISODateLocal(end),
  };
}

// Given a local date, get the following Friday (payday)
function getFollowingFriday(date: Date): Date {
  const day = date.getDay(); // 0=Sun,...,5=Fri,6=Sat
  const daysUntilFriday = (5 - day + 7) % 7;
  const friday = new Date(date);
  friday.setDate(friday.getDate() + daysUntilFriday);
  return friday;
}

// Format Date as YYYY-MM-DD purely for internal clarity
function formatDateOnly(date: Date): string {
  return toISODateLocal(date);
}

// ----- Types for response --------------------------------------------------

type PayrollSummaryRow = {
  userId: string;
  name: string;
  employeeCode: string | null;
  totalHours: number;
  shiftCount: number;
};

type PayrollBreakdownRow = {
  userId: string;
  name: string;
  employeeCode: string | null;
  locationId: string | null;
  locationName: string | null;
  workDate: string; // YYYY-MM-DD
  hours: number;
};

type PayrollResponseBody = {
  summary: PayrollSummaryRow[];
  breakdown: PayrollBreakdownRow[];
  meta: {
    startDate: string; // YYYY-MM-DD (Monday)
    endDate: string; // YYYY-MM-DD (Saturday)
    payday: string; // YYYY-MM-DD (following Friday)
  };
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    let startStr = searchParams.get("start");
    let endStr = searchParams.get("end");

    // If dates are not provided, default to current Mon–Sat period.
    if (!startStr || !endStr) {
      const { startDateStr, endDateStr } = getCurrentPayPeriod();
      startStr = startDateStr;
      endStr = endDateStr;
    }

    const startDate = parseISOToLocalDate(startStr);
    const endDate = parseISOToLocalDate(endStr);

    // We treat the range as inclusive [start, end], so endExclusive = end + 1 day
    const endExclusive = new Date(endDate);
    endExclusive.setDate(endExclusive.getDate() + 1);

    const payday = getFollowingFriday(endDate);

    // 1) Pull all shifts in this date range with a clockOut
    const shifts = await prisma.shift.findMany({
      where: {
        clockIn: {
          gte: startDate,
          lt: endExclusive,
        },
        clockOut: {
          not: null,
        },
        user: {
          active: true,
        },
      },
      include: {
        user: true,
        location: true,
      },
    });

    // 2) Aggregate in JS:
    //    - summaryByUser: total hours & count
    //    - breakdown: per user + location + day (based on clockIn date)

    const summaryMap = new Map<string, PayrollSummaryRow>();
    const breakdownMap = new Map<string, PayrollBreakdownRow>();

    for (const shift of shifts) {
      if (!shift.clockIn || !shift.clockOut) continue;

      const clockIn = new Date(shift.clockIn);
      const clockOut = new Date(shift.clockOut);
      const diffMs = clockOut.getTime() - clockIn.getTime();
      if (!Number.isFinite(diffMs) || diffMs <= 0) continue;

      const hours = diffMs / (1000 * 60 * 60);

      const user = shift.user;
      const location = shift.location;

      const userId = user.id;
      const name = user.name;
      const employeeCode = user.employeeCode ?? null;

      const locationId = location?.id ?? null;
      const locationName = location?.name ?? null;

      // Work date = local date from clockIn
      const workDate = formatDateOnly(clockIn); // YYYY-MM-DD

      // Summary by user
      const existingSummary = summaryMap.get(userId);
      if (!existingSummary) {
        summaryMap.set(userId, {
          userId,
          name,
          employeeCode,
          totalHours: hours,
          shiftCount: 1,
        });
      } else {
        existingSummary.totalHours += hours;
        existingSummary.shiftCount += 1;
      }

      // Breakdown key: user + location + day
      const breakdownKey = `${userId}|${locationId ?? "NULL"}|${workDate}`;
      const existingBreakdown = breakdownMap.get(breakdownKey);
      if (!existingBreakdown) {
        breakdownMap.set(breakdownKey, {
          userId,
          name,
          employeeCode,
          locationId,
          locationName,
          workDate,
          hours,
        });
      } else {
        existingBreakdown.hours += hours;
      }
    }

    const summary: PayrollSummaryRow[] = Array.from(summaryMap.values()).map(
      (row) => ({
        ...row,
        totalHours: Number(row.totalHours.toFixed(2)),
      })
    );

    const breakdown: PayrollBreakdownRow[] = Array.from(
      breakdownMap.values()
    ).map((row) => ({
      ...row,
      hours: Number(row.hours.toFixed(2)),
    }));

    // Sort: summary by name, breakdown by name -> location -> date
    summary.sort((a, b) => a.name.localeCompare(b.name));
    breakdown.sort((a, b) => {
      const byName = a.name.localeCompare(b.name);
      if (byName !== 0) return byName;

      const locA = a.locationName ?? "";
      const locB = b.locationName ?? "";
      const byLoc = locA.localeCompare(locB);
      if (byLoc !== 0) return byLoc;

      return a.workDate.localeCompare(b.workDate);
    });

    const body: PayrollResponseBody = {
      summary,
      breakdown,
      meta: {
        startDate: formatDateOnly(startDate),
        endDate: formatDateOnly(endDate),
        payday: formatDateOnly(payday),
      },
    };

    return NextResponse.json(body);
  } catch (err) {
    console.error("Error in payroll API:", err);
    return NextResponse.json(
      { error: "Failed to compute payroll for the given period." },
      { status: 500 }
    );
  }
}