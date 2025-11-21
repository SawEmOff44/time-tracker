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

// PATCH /api/admin/employees/:id → update fields (name, code, pin, role, active)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const body = await req.json();

  const { name, employeeCode, pin, role, active } = body;

  const data: any = {};
  if (name !== undefined) data.name = name;
  if (employeeCode !== undefined) data.employeeCode = employeeCode;
  if (pin !== undefined) data.pinHash = pin; // plain pin for now
  if (role !== undefined) data.role = role;
  if (active !== undefined) data.active = active;

  try {
    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        employeeCode: true,
        pinHash: true,
        role: true,
        active: true,
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

// DELETE /api/admin/employees/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting employee:", err);
    return NextResponse.json(
      { error: "Failed to delete employee" },
      { status: 500 }
    );
  }
}