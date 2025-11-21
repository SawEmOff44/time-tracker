export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  if (!session) {
    return false;
  }
  return true;
}

// GET /api/admin/employees → list employees
export async function GET() {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      employeeCode: true,
      pinHash: true,
      role: true,
      active: true,
    },
  });

  return NextResponse.json(users);
}

// POST /api/admin/employees → create employee
export async function POST(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, employeeCode, pin, role, active } = body;

    if (!name || !employeeCode || !pin) {
      return NextResponse.json(
        { error: "Name, employeeCode, and pin are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        employeeCode,
        pinHash: pin, // storing plain pin in pinHash for now
        role: role || "EMPLOYEE",
        active: active ?? true,
      },
      select: {
        id: true,
        name: true,
        employeeCode: true,
        pinHash: true,
        role: true,
        active: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error("Error creating employee:", err);
    return NextResponse.json(
      { error: "Failed to create employee" },
      { status: 500 }
    );
  }
}