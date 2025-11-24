// app/api/admin/employees/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });

    const payload = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      employeeCode: u.employeeCode,
      active: u.active,
      createdAt: u.createdAt.toISOString(),
    }));

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Error loading employees", err);
    return NextResponse.json(
      { error: "Failed to load employees" },
      { status: 500 }
    );
  }
}