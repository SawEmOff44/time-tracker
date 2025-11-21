// app/api/admin/stats/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

export async function GET(_req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    const [
      totalEmployees,
      activeEmployees,
      totalLocations,
      activeLocations,
      openShifts,
      todaysShifts,
      recentShifts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.location.count(),
      prisma.location.count({ where: { active: true } }),
      prisma.shift.count({ where: { clockOut: null } }),
      prisma.shift.count({
        where: {
          clockIn: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
      prisma.shift.findMany({
        orderBy: { clockIn: "desc" },
        take: 10,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              employeeCode: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      totalEmployees,
      activeEmployees,
      totalLocations,
      activeLocations,
      openShifts,
      todaysShifts,
      recentShifts,
    });
  } catch (err) {
    console.error("Error loading admin stats:", err);
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 }
    );
  }
}