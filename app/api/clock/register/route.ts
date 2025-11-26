// app/api/clock/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, employeeCode, pin } = body;

    if (!name || !employeeCode || !pin) {
      return NextResponse.json(
        { error: "Name, employee code, and PIN are required." },
        { status: 400 }
      );
    }

    // ✅ enforce 4-digit numeric PIN
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN must be exactly 4 digits (0-9)." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { employeeCode },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Employee code already exists." },
        { status: 409 }
      );
    }

    const pinHash = await bcrypt.hash(pin, 10);

    const user = await prisma.user.create({
      data: {
        name,
        employeeCode,
        role: "WORKER",
        active: false, // waits for approval
        pinHash,
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        name: user.name,
        employeeCode: user.employeeCode,
        active: user.active,
        createdAt: user.createdAt,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Registration failed." },
      { status: 500 }
    );
  }
}