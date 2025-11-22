// app/api/admin/employees/route.ts
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

// GET /api/admin/employees  → list all employees (active + inactive)
export async function GET(_req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const employees = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        employeeCode: true,
        email: true,
        role: true,
        active: true,
      },
    });

    return NextResponse.json(employees);
  } catch (err) {
    console.error("Error loading employees:", err);
    return NextResponse.json(
      { error: "Failed to load employees" },
      { status: 500 }
    );
  }
}

// POST /api/admin/employees → create new employee
export async function POST(req: NextRequest) {
  if (!requireAdmin()) {
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

    const { name, employeeCode, email, role, active } = body;

    if (!name || !employeeCode) {
      return NextResponse.json(
        { error: "name and employeeCode are required" },
        { status: 400 }
      );
    }

    const employee = await prisma.user.create({
      data: {
        name,
        employeeCode,
        email: email || null,
        role: role || "EMPLOYEE",
        active: active ?? true,
      },
      select: {
        id: true,
        name: true,
        employeeCode: true,
        email: true,
        role: true,
        active: true,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (err) {
    console.error("Error creating employee:", err);
    return NextResponse.json(
      { error: "Failed to create employee" },
      { status: 500 }
    );
  }
}