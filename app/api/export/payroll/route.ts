import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseDateOnly(value: string | null): Date | undefined {
  if (!value) return undefined;
  const iso = `${value}T00:00:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    const startDate = parseDateOnly(startParam);
    const endDateBase = parseDateOnly(endParam);

    const where: any = {};
    if (startDate || endDateBase) {
      where.clockIn = {};
      if (startDate) {
        where.clockIn.gte = startDate;
      }
      if (endDateBase) {
        const endOfDay = new Date(endDateBase);
        endOfDay.setHours(23, 59, 59, 999);
        where.clockIn.lte = endOfDay;
      }
    }

    const shifts = await prisma.shift.findMany({
      where,
      orderBy: { clockIn: "asc" },
      include: {
        user: true,
        location: true,
      },
    });

    const rows = shifts.map((s) => {
      const clockIn = s.clockIn ? new Date(s.clockIn) : null;
      const clockOut = s.clockOut ? new Date(s.clockOut) : null;

      const hours =
        clockIn && clockOut
          ? (
              (clockOut.getTime() - clockIn.getTime()) /
              1000 /
              60 /
              60
            ).toFixed(2)
          : "";

      return {
        employee: s.user?.name || "Unknown",
        code: s.user?.employeeCode || "",
        date: clockIn ? clockIn.toISOString().slice(0, 10) : "",
        clockIn: clockIn ? clockIn.toLocaleTimeString() : "",
        clockOut: clockOut ? clockOut.toLocaleTimeString() : "",
        hours,
        location: s.location?.name || "Unknown",
      };
    });

    const header = [
      "Employee",
      "Code",
      "Date",
      "Clock In",
      "Clock Out",
      "Hours",
      "Location",
    ];

    const csv =
      header.join(",") +
      "\n" +
      rows
        .map((r) =>
          [
            r.employee,
            r.code,
            r.date,
            r.clockIn,
            r.clockOut,
            r.hours,
            r.location,
          ]
            .map((v) => {
              const val = (v ?? "").toString().replace(/"/g, '""');
              return `"${val}"`;
            })
            .join(",")
        )
        .join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=payroll.csv",
      },
    });
  } catch (err) {
    console.error("CSV export failed:", err);
    return NextResponse.json(
      { error: "Failed to export payroll" },
      { status: 500 }
    );
  }
}