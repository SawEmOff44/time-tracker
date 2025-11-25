// app/api/admin/employees/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type AdminUserPayload = {
  id: string;
  name: string;
  email: string | null;
  employeeCode: string | null;
  active: boolean;
  createdAt: string;
};

export async function GET(_req: NextRequest) {
  try {
    // Return ALL non-admin users (EMPLOYEE + WORKER) so the UI
    // can split them into pending vs active.
    const users = await prisma.user.findMany({
      where: {
        role: {
          not: "ADMIN",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const payload: AdminUserPayload[] = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      employeeCode: u.employeeCode,
      active: u.active,
      createdAt: u.createdAt.toISOString(),
    }));

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("Error in /api/admin/employees GET:", err);
    return NextResponse.json(
      { error: "Failed to load employees." },
      { status: 500 }
    );
  }
}

/**
 * Optional: allow an admin to manually add a new employee from admin tools.
 * If you don't currently POST to this route from the UI, this won't affect anything,
 * but it's handy to have.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const rawName = (body.name ?? "").trim();
    const rawEmail = (body.email ?? "").trim();
    const rawEmployeeCode = (body.employeeCode ?? "").trim();
    const role = (body.role ?? "EMPLOYEE") as "EMPLOYEE" | "WORKER";

    if (!rawName || !rawEmployeeCode) {
      return NextResponse.json(
        { error: "Name and employee code are required." },
        { status: 400 }
      );
    }

    // You can optionally enforce a pattern on codes here too.
    const existingByCode = await prisma.user.findUnique({
      where: { employeeCode: rawEmployeeCode },
    });

    if (existingByCode) {
      return NextResponse.json(
        { error: "That employee code is already in use." },
        { status: 409 }
      );
    }

    let created;
    // NOTE: By default, admin-created employees are active immediately
    // and can clock in, but they won't have a PIN unless you also set it
    // somewhere else. This is just a basic "create" hook.
    created = await prisma.user.create({
      data: {
        name: rawName,
        email: rawEmail || null,
        employeeCode: rawEmployeeCode,
        role,
        active: true,
      },
    });

    const payload: AdminUserPayload = {
      id: created.id,
      name: created.name,
      email: created.email,
      employeeCode: created.employeeCode,
      active: created.active,
      createdAt: created.createdAt.toISOString(),
    };

    return NextResponse.json(payload, { status: 201 });
  } catch (err) {
    console.error("Error in /api/admin/employees POST:", err);
    return NextResponse.json(
      { error: "Failed to create employee." },
      { status: 500 }
    );
  }
}