// app/api/admin/employees/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

// Helper to map Prisma user → detailed JSON for profile page
function toEmployeeDetail(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    employeeCode: user.employeeCode,
    active: user.active,
    role: user.role as Role,
    phone: user.phone,
    addressLine1: user.addressLine1,
    addressLine2: user.addressLine2,
    city: user.city,
    state: user.state,
    postalcode: user.postalcode,
    hourlyRate: user.hourlyRate,
    // NOTE: if your schema field is spelled salaryAnnnual, map from that:
    salaryAnnual: user.salaryAnnnual ?? user.salaryAnnual ?? null,
    adminNotes: user.adminNotes,
    createdAt: user.createdAt.toISOString(),
    documents: (user.documents ?? []).map((d: any) => ({
      id: d.id,
      title: d.title,
      url: d.url,
      description: d.description,
      visibleToWorker: d.visibleToWorker,
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

// Lightweight shape for the employees list UI
function toAdminUserRow(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    employeeCode: user.employeeCode,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
  };
}

// GET /api/admin/employees/[id] → full detail for profile page
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        documents: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(toEmployeeDetail(user));
  } catch (err) {
    console.error("Error loading employee detail", err);
    return NextResponse.json(
      { error: "Failed to load employee." },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/employees/[id] → update employee fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const {
    name,
    email,
    employeeCode,
    active,
    pin, // optional: new PIN
    phone,
    addressLine1,
    addressLine2,
    city,
    state,
    postalcode,
    hourlyRate,
    salaryAnnual,
    adminNotes,
  } = body ?? {};

  const data: Record<string, any> = {};

  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;
  if (employeeCode !== undefined) data.employeeCode = employeeCode;
  if (typeof active === "boolean") data.active = active;

  if (phone !== undefined) data.phone = phone;
  if (addressLine1 !== undefined) data.addressLine1 = addressLine1;
  if (addressLine2 !== undefined) data.addressLine2 = addressLine2;
  if (city !== undefined) data.city = city;
  if (state !== undefined) data.state = state;
  if (postalcode !== undefined) data.postalcode = postalcode;

  if (hourlyRate !== undefined)
    data.hourlyRate =
      hourlyRate === null || hourlyRate === "" ? null : Number(hourlyRate);

  if (salaryAnnual !== undefined) {
    // Map to actual Prisma field name (fix spelling here if you corrected schema)
    data.salaryAnnnual =
      salaryAnnual === null || salaryAnnual === ""
        ? null
        : Number(salaryAnnual);
  }

  if (adminNotes !== undefined) data.adminNotes = adminNotes;

  if (pin !== undefined && pin !== null && String(pin).trim().length > 0) {
    const pinStr = String(pin).trim();
    if (!/^\d{4}$/.test(pinStr)) {
      return NextResponse.json(
        { error: "PIN must be exactly 4 digits." },
        { status: 400 }
      );
    }
    // For now store plain; if you add hashing, do it here.
    data.pinHash = pinStr;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data,
    });

    // Return the lightweight row shape so your existing list UI keeps working
    return NextResponse.json(toAdminUserRow(updated));
  } catch (err) {
    console.error("Error updating employee", err);
    return NextResponse.json(
      { error: "Failed to update employee." },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/employees/[id] is whatever you already had;
// if you had it in this file before, keep it as-is below.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Error deleting employee", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to delete employee." },
      { status: 400 }
    );
  }
}