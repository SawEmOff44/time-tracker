// app/api/admin/employees/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

type RouteParams = {
  params: { id: string };
};

// GET single employee (not strictly required by UI, but handy)
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      employeeCode: user.employeeCode,
      active: user.active,
      createdAt: user.createdAt.toISOString(),
      // Note: we never return pinHash or PIN
    });
  } catch (err) {
    console.error("Error loading employee", err);
    return NextResponse.json(
      { error: "Failed to load employee" },
      { status: 500 }
    );
  }
}

// PATCH – update name / email / employeeCode / active (+ optional PIN reset)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = params;

  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string | null;
      employeeCode?: string | null;
      active?: boolean;
      pin?: string; // ✅ optional PIN provided by admin
    };

    const data: {
      name?: string;
      email?: string | null;
      employeeCode?: string | null;
      active?: boolean;
      pinHash?: string | null;
    } = {};

    if (typeof body.name === "string") data.name = body.name.trim();

    if (typeof body.email === "string" || body.email === null) {
      data.email = body.email ? body.email.trim() : null;
    }

    if (
      typeof body.employeeCode === "string" ||
      body.employeeCode === null
    ) {
      data.employeeCode = body.employeeCode
        ? body.employeeCode.trim()
        : null;
    }

    if (typeof body.active === "boolean") {
      data.active = body.active;
    }

    // ✅ Handle PIN reset if provided
    if (typeof body.pin === "string" && body.pin.trim().length > 0) {
      const trimmedPin = body.pin.trim();

      // Must be exactly 4 numeric digits
      if (!/^\d{4}$/.test(trimmedPin)) {
        return NextResponse.json(
          { error: "PIN must be exactly 4 digits (0–9)." },
          { status: 400 }
        );
      }

      const pinHash = await bcrypt.hash(trimmedPin, 10);
      data.pinHash = pinHash;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      employeeCode: updated.employeeCode,
      active: updated.active,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err: any) {
    console.error("Error updating employee", err);
    return NextResponse.json(
      { error: "Failed to update employee" },
      { status: 500 }
    );
  }
}

// DELETE – only if user has no shifts
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = params;

  try {
    const shiftCount = await prisma.shift.count({
      where: { userId: id },
    });

    if (shiftCount > 0) {
      return NextResponse.json(
        {
          error:
            "This employee has recorded shifts and cannot be deleted. " +
            "You may deactivate them instead.",
        },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting employee", err);
    return NextResponse.json(
      { error: "Failed to delete employee" },
      { status: 500 }
    );
  }
}