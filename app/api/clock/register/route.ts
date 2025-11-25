// app/api/clock/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const rawName = (body.name ?? "").trim();
    const rawEmail = (body.email ?? "").trim();
    const rawEmployeeCode = (body.employeeCode ?? "").trim();
    const rawPin = (body.pin ?? "").trim();

    if (!rawName || !rawEmployeeCode || !rawPin) {
      return NextResponse.json(
        {
          error:
            "Name, employee code, and PIN are required to create an account.",
        },
        { status: 400 }
      );
    }

    // Basic validation: simple code pattern like ABC123, but not too strict
    if (rawEmployeeCode.length < 3 || rawEmployeeCode.length > 20) {
      return NextResponse.json(
        { error: "Employee code must be between 3 and 20 characters." },
        { status: 400 }
      );
    }

    if (rawPin.length < 4 || rawPin.length > 12) {
      return NextResponse.json(
        { error: "PIN must be between 4 and 12 characters." },
        { status: 400 }
      );
    }

    // Ensure employeeCode is unique
    const existingByCode = await prisma.user.findUnique({
      where: { employeeCode: rawEmployeeCode },
    });

    if (existingByCode) {
      return NextResponse.json(
        {
          error:
            "That employee code is already in use. Check with your office to confirm your assigned code.",
        },
        { status: 409 }
      );
    }

    // Optional: ensure email isn't already taken (only if an email is provided)
    if (rawEmail) {
      const existingByEmail = await prisma.user.findFirst({
        where: { email: rawEmail },
      });

      if (existingByEmail) {
        return NextResponse.json(
          {
            error:
              "That email address is already associated with an account. Use a different email or contact your office.",
          },
          { status: 409 }
        );
      }
    }

    const pinHash = await bcrypt.hash(rawPin, 10);

    // Create a WORKER-level user, inactive by default (shows in "Pending")
    const user = await prisma.user.create({
      data: {
        name: rawName,
        email: rawEmail || null,
        employeeCode: rawEmployeeCode,
        pinHash,
        role: "WORKER", // non-admin role
        active: false, // must be approved in Admin
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        name: user.name,
        employeeCode: user.employeeCode,
        email: user.email,
        active: user.active,
        message:
          "Account created. You’ll be able to clock in once an admin approves your account.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error in /api/clock/register:", err);
    return NextResponse.json(
      { error: "Failed to create worker account." },
      { status: 500 }
    );
  }
}