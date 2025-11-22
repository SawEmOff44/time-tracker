// app/api/admin/employees/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

// GET /api/admin/employees → list all employees (with defaultLocation)
export async function GET() {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const employees = await prisma.user.findMany({
      orderBy: { name: "asc" },
      include: {
        defaultLocation: true,
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

// POST /api/admin/employees → create an employee (with optional PIN)
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

    const {
      name,
      employeeCode,
      role,
      email,
      defaultLocationId,
      active,
      pin,
    } = body;

    if (!name || !employeeCode || !role) {
      return NextResponse.json(
        { error: "name, employeeCode, and role are required" },
        { status: 400 }
      );
    }

    const created = await prisma.user.create({
      data: {
        name,
        employeeCode,
        role, // "EMPLOYEE" or "ADMIN"
        email: email || null,
        active: typeof active === "boolean" ? active : true,
        defaultLocationId: defaultLocationId || null,
        // For now we treat pinHash as the plain PIN string
        pinHash: pin && typeof pin === "string" && pin.length > 0 ? pin : null,
      },
      include: {
        defaultLocation: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("Error creating employee:", err);
    return NextResponse.json(
      { error: "Failed to create employee" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/employees → update employee (name, code, role, active, defaultLocationId, PIN)
export async function PUT(req: NextRequest) {
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

    const {
      id,
      name,
      employeeCode,
      role,
      email,
      active,
      defaultLocationId,
      pin,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required to update employee" },
        { status: 400 }
      );
    }

    const data: any = {};

    if (typeof name === "string") data.name = name;
    if (typeof employeeCode === "string") data.employeeCode = employeeCode;
    if (typeof role === "string") data.role = role;
    if (typeof email === "string") data.email = email;
    if (typeof active === "boolean") data.active = active;
    if (typeof defaultLocationId === "string" || defaultLocationId === null) {
      data.defaultLocationId = defaultLocationId || null;
    }

    // PIN handling:
    // - if pin is undefined → don't touch existing pinHash
    // - if pin is "" → clear pinHash
    // - if pin is non-empty string → set new PIN
    if (pin !== undefined) {
      if (typeof pin === "string" && pin.length > 0) {
        data.pinHash = pin;
      } else {
        data.pinHash = null;
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      include: {
        defaultLocation: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Error updating employee:", err);
    return NextResponse.json(
      { error: "Failed to update employee" },
      { status: 500 }
    );
  }
}