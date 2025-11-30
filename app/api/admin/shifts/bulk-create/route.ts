// app/api/admin/shifts/bulk-create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

export async function POST(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { templateId, employeeIds, startDate, endDate } = body;

    if (!templateId || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json(
        { error: "Template and employees are required" },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start and end dates are required" },
        { status: 400 }
      );
    }

    // Load template
    const template = await prisma.shiftTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Generate dates in range that match template days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates: Date[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (template.daysOfWeek.includes(dayOfWeek)) {
        dates.push(new Date(d));
      }
    }

    // Create shifts for each employee on each matching date
    const shiftsToCreate = [];

    for (const employeeId of employeeIds) {
      for (const date of dates) {
        const clockInDate = new Date(date);
        clockInDate.setHours(
          Math.floor(template.startMinutes / 60),
          template.startMinutes % 60,
          0,
          0
        );

        const clockOutDate = new Date(date);
        clockOutDate.setHours(
          Math.floor(template.endMinutes / 60),
          template.endMinutes % 60,
          0,
          0
        );

        // Handle overnight shifts
        if (template.endMinutes < template.startMinutes) {
          clockOutDate.setDate(clockOutDate.getDate() + 1);
        }

        shiftsToCreate.push({
          userId: employeeId,
          locationId: template.locationId,
          clockIn: clockInDate,
          clockOut: clockOutDate,
          notes: `Created from template: ${template.name}`,
        });
      }
    }

    // Bulk create shifts
    await prisma.shift.createMany({
      data: shiftsToCreate,
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      count: shiftsToCreate.length,
    });
  } catch (err) {
    console.error("Error creating bulk shifts:", err);
    return NextResponse.json(
      { error: "Failed to create shifts" },
      { status: 500 }
    );
  }
}
