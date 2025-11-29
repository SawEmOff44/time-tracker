import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");

    let start = parseDateParam(startStr);
    let end = parseDateParam(endStr);

    if (!start || !end) {
      // default last 14 days
      const today = new Date();
      const endD = new Date(today);
      endD.setHours(0, 0, 0, 0);
      const startD = new Date(endD.getTime() - 13 * 24 * 60 * 60 * 1000);
      start = startD;
      end = endD;
    }

    const endExclusive = new Date(end);
    endExclusive.setDate(endExclusive.getDate() + 1);

    const shifts = await prisma.shift.findMany({
      where: {
        clockIn: { gte: start, lt: endExclusive },
        clockOut: { not: null },
        user: { active: true },
      },
      include: { user: true },
    });

    const dayMap = new Map<string, number>();

    for (const shift of shifts) {
      if (!shift.clockOut) continue;
      const hours = (shift.clockOut.getTime() - shift.clockIn.getTime()) / (1000 * 60 * 60);
      if (hours <= 0) continue;

      const d = new Date(shift.clockIn);
      d.setHours(0, 0, 0, 0);
      const key = formatDateInput(d);
      dayMap.set(key, (dayMap.get(key) ?? 0) + hours);
    }

    // Build continuous array from start..end
    const result: { date: string; hours: number }[] = [];
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);

    while (cur.getTime() <= last.getTime()) {
      const key = formatDateInput(cur);
      result.push({ date: key, hours: Number((dayMap.get(key) ?? 0).toFixed(2)) });
      cur.setDate(cur.getDate() + 1);
    }

    return NextResponse.json({ start: formatDateInput(start), end: formatDateInput(end), series: result });
  } catch (err) {
    console.error("Analytics hours series error", err);
    return NextResponse.json({ error: "Failed to load analytics series" }, { status: 500 });
  }
}
