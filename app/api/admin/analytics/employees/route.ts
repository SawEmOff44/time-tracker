// app/api/admin/analytics/employees/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type EmployeeBreakdown = {
  userId: string;
  userName: string;
  hours: number;
  shifts: number;
  cost: number;
};

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

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

function getCurrentPayPeriod(today = new Date()) {
  const day = today.getDay();
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
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");
    const locationId = searchParams.get("locationId");

    let start = parseDateParam(startStr);
    let end = parseDateParam(endStr);

    if (!start || !end) {
      const p = getCurrentPayPeriod();
      start = parseDateParam(p.startDateStr)!;
      end = parseDateParam(p.endDateStr)!;
    }

    const endExclusive = new Date(end);
    endExclusive.setDate(endExclusive.getDate() + 1);

    const whereClause: any = {
      clockIn: {
        gte: start,
        lt: endExclusive,
      },
      user: {
        active: true,
      },
    };

    if (locationId && locationId !== "null") {
      whereClause.locationId = locationId;
    } else if (locationId === "null") {
      whereClause.locationId = null;
    }

    const shifts = await prisma.shift.findMany({
      where: whereClause,
      include: {
        user: true,
      },
    });

    const empMap = new Map<
      string,
      {
        userId: string;
        userName: string;
        hours: number;
        shifts: number;
        cost: number;
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

      let emp = empMap.get(shift.userId);
      if (!emp) {
        emp = {
          userId: shift.userId,
          userName: shift.user.name ?? "Unknown",
          hours: 0,
          shifts: 0,
          cost: 0,
        };
        empMap.set(shift.userId, emp);
      }

      emp.hours += hours;
      emp.shifts += 1;
      emp.cost += wages;
    }

    const employees: EmployeeBreakdown[] = Array.from(empMap.values())
      .map((e) => ({
        userId: e.userId,
        userName: e.userName,
        hours: Number(e.hours.toFixed(2)),
        shifts: e.shifts,
        cost: Number(e.cost.toFixed(2)),
      }))
      .sort((a, b) => b.hours - a.hours);

    return NextResponse.json(employees);
  } catch (err) {
    console.error("Employee analytics error", err);
    return NextResponse.json(
      { error: "Failed to load employee analytics" },
      { status: 500 }
    );
  }
}
