// app/api/admin/payroll/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const userId = searchParams.get("userId");
    const locationId = searchParams.get("locationId");

    // Default range: last 14 days (inclusive)
    const today = new Date();
    const defaultEnd = endOfDay(today);
    const defaultStart = startOfDay(
      new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000)
    );

    const start = startParam ? startOfDay(new Date(startParam)) : defaultStart;
    const end = endParam ? endOfDay(new Date(endParam)) : defaultEnd;

    const shifts = await prisma.shift.findMany({
      where: {
        clockIn: { gte: start, lte: end },
        clockOut: { not: null },
        ...(userId ? { userId } : {}),
        ...(locationId ? { locationId } : {}),
      },
      include: {
        user: true,
        location: true,
      },
      orderBy: {
        clockIn: "asc",
      },
    });

    type BucketKey = string;
    const buckets = new Map<
      BucketKey,
      {
        userId: string;
        userName: string;
        employeeCode: string | null;
        locationId: string | null;
        locationName: string;
        date: string; // YYYY-MM-DD
        totalHours: number;
        hourlyRate: number | null;
      }
    >();

    for (const s of shifts) {
      if (!s.clockIn || !s.clockOut) continue;

      const ms = s.clockOut.getTime() - s.clockIn.getTime();
      if (ms <= 0) continue;

      const hours = ms / (1000 * 60 * 60);
      const workDate = toYMD(s.clockIn);

      const locId = s.locationId ?? "ADHOC";
      const key = `${s.userId}::${locId}::${workDate}`;

      const hourlyRate =
        (s.user as any).hourlyRate != null ? Number(s.user.hourlyRate) : null;

      const existing = buckets.get(key);
      if (existing) {
        existing.totalHours += hours;
      } else {
        buckets.set(key, {
          userId: s.userId,
          userName: s.user?.name ?? "Unknown",
          employeeCode: s.user?.employeeCode ?? null,
          locationId: s.locationId,
          locationName:
            s.location?.name ??
            (s.locationId ? "Unknown location" : "ADHOC job site"),
          date: workDate,
          totalHours: hours,
          hourlyRate,
        });
      }
    }

    const rows = Array.from(buckets.values())
      .map((row) => {
        const roundedHours = Number(row.totalHours.toFixed(2));
        const laborCost =
          row.hourlyRate != null
            ? Number((roundedHours * row.hourlyRate).toFixed(2))
            : null;

        return {
          ...row,
          totalHours: roundedHours,
          laborCost,
        };
      })
      .sort((a, b) => {
        if (a.date === b.date) {
          if (a.locationName === b.locationName) {
            return a.userName.localeCompare(b.userName);
          }
          return a.locationName.localeCompare(b.locationName);
        }
        return a.date.localeCompare(b.date);
      });

    const totalHours = rows.reduce((sum, r) => sum + r.totalHours, 0);
    const totalCost = rows.reduce(
      (sum, r) => sum + (r.laborCost ?? 0),
      0
    );

    return NextResponse.json({
      start: start.toISOString(),
      end: end.toISOString(),
      count: rows.length,
      totalHours: Number(totalHours.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      rows,
    });
  } catch (err) {
    console.error("Payroll GET error", err);
    return NextResponse.json(
      { error: "Failed to load payroll data." },
      { status: 500 }
    );
  }
}