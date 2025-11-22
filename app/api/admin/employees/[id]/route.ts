// app/api/admin/employees/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

// GET /api/admin/employees → list all employees
export async function GET() {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawEmployees = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        employeeCode: true,
        role: true,
        active: true,
        pinHash: true, // real DB field
      },
    });

    const employees = rawEmployees.map((e) => ({
      id: e.id,
      name: e.name,
      employeeCode: e.employeeCode,
      role: e.role,
      active: e.active,
      // expose as `pin` to the UI
      pin: e.pinHash ?? null,
    }));

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

    const { name, employeeCode, role, pin } = body as {
      name?: string;
      employeeCode?: string;
      role?: string;
      pin?: string;
    };

    if (!name || !employeeCode) {
      return NextResponse.json(
        { error: "name and employeeCode are required" },
        { status: 400 }
      );
    }

    const normalizedRole: Role =
      (role === "ADMIN" || role === "WORKER" ? role : "WORKER") as Role;

    let pinToStore: string | null = null;
    if (typeof pin === "string" && pin.trim().length > 0) {
      pinToStore = pin.trim();
    }

    let created;
    try {
      created = await prisma.user.create({
        data: {
          name,
          employeeCode,
          role: normalizedRole,
          active: true,
          pinHash: pinToStore, // store in pinHash
        },
        select: {
          id: true,
          name: true,
          employeeCode: true,
          role: true,
          active: true,
          pinHash: true,
        },
      });
    } catch (err: any) {
      // Handle common Prisma constraint errors a bit nicer
      if (err?.code === "P2002") {
        // unique constraint
        return NextResponse.json(
          {
            error:
              "An employee with that code already exists. Use a unique employee code.",
          },
          { status: 400 }
        );
      }

      console.error("Prisma error creating employee:", err);
      return NextResponse.json(
        { error: "Database error creating employee" },
        { status: 500 }
      );
    }

    const result = {
      id: created.id,
      name: created.name,
      employeeCode: created.employeeCode,
      role: created.role,
      active: created.active,
      pin: created.pinHash ?? null,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("Error creating employee:", err);
    return NextResponse.json(
      { error: "Failed to create employee" },
      { status: 500 }
    );
  }
}