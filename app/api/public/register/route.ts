// app/api/public/register/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client"; // assumes Role enum exists

type RegisterBody = {
  name?: string;
  email?: string;
  employeeCode?: string;
  pin?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RegisterBody;
    let { name, email, employeeCode, pin } = body;

    name = (name ?? "").trim();
    email = (email ?? "").trim();
    employeeCode = (employeeCode ?? "").trim().toUpperCase();
    pin = (pin ?? "").trim();

    // Basic validation
    if (!name || !email || !employeeCode || !pin) {
      return NextResponse.json(
        { error: "Name, email, employee code, and PIN are required." },
        { status: 400 }
      );
    }

    // Very simple PIN rule: 4–6 digits
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN must be 4–6 digits (numbers only)." },
        { status: 400 }
      );
    }

    // Check uniqueness
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ employeeCode }, { email }],
      },
    });

    if (existing) {
      let reason = "An account already exists with this";
      if (existing.employeeCode === employeeCode && existing.email === email) {
        reason += " employee code and email.";
      } else if (existing.employeeCode === employeeCode) {
        reason += " employee code.";
      } else {
        reason += " email address.";
      }

      return NextResponse.json({ error: reason }, { status: 409 });
    }

    // Create user as an active EMPLOYEE
    const user = await prisma.user.create({
      data: {
        name,
        email,
        employeeCode,
        pinHash: pin, // NOTE: currently stored in plain text like the rest of the app
        active: true,
        role: Role.EMPLOYEE,
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeCode: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "Account created. You can now clock in/out with your ID and PIN.",
        user,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register API error:", err);
    return NextResponse.json(
      { error: "Unexpected server error while creating account." },
      { status: 500 }
    );
  }
}