import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type JobSiteRow = {
  locationId: string | null;
  locationName: string | null;
  totalHours: number;
  totalWages: number;
  // kept for UI compatibility
  totalCost?: number;
  shiftCount: number;
  workerCount: number;
};

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// same Mon–Sat helper as payroll
function getCurrentPayPeriod(today = new Date()) {
  const day = today.getDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (day + 6) % 7;
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - daysSinceMonday
  );
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 5
  );
  return {
    startDateStr: formatDateInput(start),
    endDateStr: formatDateInput(end),
  };
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");

    let start = parseDateParam(startStr);
    let end = parseDateParam(endStr);

    if (!start || !end) {
      const p = getCurrentPayPeriod();
      start = parseDateParam(p.startDateStr)!;
      end = parseDateParam(p.endDateStr)!;
    }

    const endExclusive = new Date(end);
    endExclusive.setDate(endExclusive.getDate() + 1);

    const shifts = await prisma.shift.findMany({
      where: {
        clockIn: {
          gte: start,
          lt: endExclusive,
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

    const locMap = new Map<
      string | null,
      {
        locationId: string | null;
        locationName: string | null;
        totalHours: number;
        totalWages: number;
        shiftCount: number;
        workerIds: Set<string>;
      }
    >();

    for (const shift of shifts) {
      if (!shift.clockOut) continue;
      if (!shift.user) continue;

      const hours =
        (shift.clockOut.getTime() - shift.clockIn.getTime()) /
        (1000 * 60 * 60);
      if (hours <= 0) continue;

      const hourlyRate = shift.user.hourlyRate ?? 0;
      const wages = hours * hourlyRate;

      const locId = shift.location?.id ?? null;
      const locName = shift.location?.name ?? (locId ? "Unnamed job site" : "ADHOC");

      let row = locMap.get(locId);
      if (!row) {
        row = {
          locationId: locId,
          locationName: locName,
          totalHours: 0,
          totalWages: 0,
          shiftCount: 0,
          workerIds: new Set<string>(),
        };
        locMap.set(locId, row);
      }

      row.totalHours += hours;
      row.totalWages += wages;
      row.shiftCount += 1;
      row.workerIds.add(shift.userId);
    }

    const rows: JobSiteRow[] = Array.from(locMap.values())
      .map((r) => ({
        locationId: r.locationId,
        locationName: r.locationName,
        totalHours: Number(r.totalHours.toFixed(2)),
        totalWages: Number(r.totalWages.toFixed(2)),
        totalCost: Number(r.totalWages.toFixed(2)),
        shiftCount: r.shiftCount,
        workerCount: r.workerIds.size,
      }))
      .sort((a, b) => (b.totalHours ?? 0) - (a.totalHours ?? 0));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("Job-site analytics error", err);
    return NextResponse.json(
      { error: "Failed to load job-site analytics" },
      { status: 500 }
    );
  }
}