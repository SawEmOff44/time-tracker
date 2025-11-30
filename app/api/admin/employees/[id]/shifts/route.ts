// app/api/admin/employees/[id]/shifts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employeeId = params.id;
  const searchParams = req.nextUrl.searchParams;
  const startStr = searchParams.get("start");
  const endStr = searchParams.get("end");

  let start = parseDateParam(startStr);
  let end = parseDateParam(endStr);

  // Default to last 30 days if not provided
  if (!start || !end) {
    const today = new Date();
    end = new Date(today);
    end.setHours(23, 59, 59, 999);
    start = new Date(today);
    start.setDate(today.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  } else {
    // Set end to end of day
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);
    end = endDate;
  }

  try {
    const shifts = await prisma.shift.findMany({
      where: {
        userId: employeeId,
        clockIn: {
          gte: start,
          lte: end,
        },
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        clockIn: "desc",
      },
    });

    return NextResponse.json(shifts);
  } catch (err) {
    console.error("Error loading employee shifts:", err);
    return NextResponse.json(
      { error: "Failed to load shifts" },
      { status: 500 }
    );
  }
}
