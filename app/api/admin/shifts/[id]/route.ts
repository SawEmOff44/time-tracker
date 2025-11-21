// app/api/admin/shifts/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

// POST /api/admin/shifts → create a manual shift
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const {
      employeeId,
      locationId,
      clockIn,
      clockOut,
    }: {
      employeeId?: string;
      locationId?: string;
      clockIn?: string;
      clockOut?: string | null;
    } = body;

    if (!employeeId || !locationId || !clockIn) {
      return NextResponse.json(
        {
          error: "employeeId, locationId, and clockIn are required",
        },
        { status: 400 }
      );
    }

    const ci = new Date(clockIn);
    if (Number.isNaN(ci.getTime())) {
      return NextResponse.json(
        { error: "Invalid clockIn datetime" },
        { status: 400 }
      );
    }

    let co: Date | null = null;
    if (clockOut) {
      const coDate = new Date(clockOut);
      if (Number.isNaN(coDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid clockOut datetime" },
          { status: 400 }
        );
      }
      co = coDate;
    }

    const shift = await prisma.shift.create({
      data: {
        userId: employeeId,
        locationId,
        clockIn: ci,
        clockOut: co,
      },
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (err) {
    console.error("Error creating manual shift:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create shift";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}