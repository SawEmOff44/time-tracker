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
        clockIn: "asc",
      },
    });

    const header = [
      "EmployeeCode",
      "EmployeeName",
      "Location",
      "ClockIn",
      "ClockOut",
      "Hours",
      "Status",
    ];

    const rows = shifts.map((s) => {
      const hours =
        s.clockOut && s.clockIn
          ? (s.clockOut.getTime() - s.clockIn.getTime()) /
            (1000 * 60 * 60)
          : null;

      return [
        s.user.employeeCode ?? "",
        s.user.name,
        s.location.name,
        s.clockIn.toISOString(),
        s.clockOut ? s.clockOut.toISOString() : "",
        hours !== null ? hours.toFixed(2) : "",
        s.status,
      ];
    });

    const csvLines = [
      header.join(","),
      ...rows.map((r) =>
        r
          .map((field) => {
            const v = String(field ?? "");
            // escape quotes + commas
            if (v.includes(",") || v.includes('"') || v.includes("\n")) {
              return `"${v.replace(/"/g, '""')}"`;
            }
            return v;
          })
          .join(",")
      ),
    ];

    const csv = csvLines.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="shifts.csv"',
      },
    });
  } catch (err) {
    console.error("Error exporting shifts", err);
    return NextResponse.json(
      { error: "Failed to export shifts" },
      { status: 500 }
    );
  }
}
