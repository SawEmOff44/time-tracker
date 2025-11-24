// app/api/clock/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RegisterBody = {
  name?: string;
  email?: string;
  employeeCode?: string;
  pin?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RegisterBody;

    const rawName = (body.name ?? "").trim();
    const rawEmail = (body.email ?? "").trim();
    const rawCode = (body.employeeCode ?? "").trim();
    const rawPin = (body.pin ?? "").trim();

    if (!rawName || !rawCode || !rawPin) {
      return NextResponse.json(
        { error: "Name, employee code, and PIN are required." },
        { status: 400 }
      );
    }

    if (rawCode.length < 3 || rawCode.length > 16) {
      return NextResponse.json(
        { error: "Employee code must be between 3 and 16 characters." },
        { status: 400 }
      );
    }

    // PIN: 4–8 digits
    if (!/^\d{4,8}$/.test(rawPin)) {
      return NextResponse.json(
        { error: "PIN must be 4–8 digits." },
        { status: 400 }
      );
    }

    const normalizedCode = rawCode.toUpperCase();

    // Check if employee code already in use
    const existing = await prisma.user.findFirst({
      where: { employeeCode: normalizedCode },
    });

    if (existing) {
      return NextResponse.json(
        {
          error:
            "That employee code is already in use. Talk to your supervisor or pick a different code.",
        },
        { status: 409 }
      );
    }

    // Create as INACTIVE = awaiting approval
    const user = await prisma.user.create({
      data: {
        name: rawName,
        email: rawEmail || null,
        employeeCode: normalizedCode,
        pinHash: rawPin, // your clock API compares against pinHash
        active: false,   // <- awaiting approval
      },
    });

    return NextResponse.json(
      {
        message:
          "Account created. You can't clock in yet until a supervisor approves you.",
        userId: user.id,
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