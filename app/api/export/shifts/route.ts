// app/api/export/shifts/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

function parseDate(input: string | null): Date | undefined {
  if (!input) return undefined;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

export async function GET(req: NextRequest) {
  if (!requireAdmin()) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const employeeId = searchParams.get("employeeId"); // query param name stays employeeId

    const where: any = {};

    // Map external employeeId → internal userId
    if (employeeId) {
      where.userId = employeeId;
    }

    const fromDate = parseDate(fromParam);
    const toDate = parseDate(toParam);

    if (fromDate || toDate) {
      where.clockIn = {};
      if (fromDate) where.clockIn.gte = fromDate;
      if (toDate) where.clockIn.lte = toDate;
    }

    const shifts = await prisma.shift.findMany({
      where,
      orderBy: { clockIn: "asc" },
      include: {
        user: {
          select: {
            name: true,
            employeeCode: true,
          },
        },
        location: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    const header = [
      "Employee Name",
      "Employee Code",
      "Location Name",
      "Location Code",
      "Clock In",
      "Clock Out",
      "Hours",
    ];

    const rows = shifts.map((s) => {
      const clockIn = s.clockIn.toISOString();
      const clockOut = s.clockOut ? s.clockOut.toISOString() : "";

      let hours = "";
      if (s.clockOut) {
        const ms = s.clockOut.getTime() - s.clockIn.getTime();
        if (ms > 0) {
          hours = (ms / (1000 * 60 * 60)).toFixed(2);
        }
      }

      return [
        s.user?.name ?? "",
        s.user?.employeeCode ?? "",
        s.location?.name ?? "",
        s.location?.code ?? "",
        clockIn,
        clockOut,
        hours,
      ];
    });

    const csvLines = [header, ...rows].map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    );

    const csv = csvLines.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="shifts.csv"',
      },
    });
  } catch (err) {
    console.error("Error exporting shifts:", err);
    return new NextResponse("Failed to export shifts", { status: 500 });
  }
}