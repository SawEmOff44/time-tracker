// app/api/worker/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { employeeCode, pin } = (await req.json()) as {
      employeeCode?: string;
      pin?: string;
    };

    if (!employeeCode || !pin) {
      return NextResponse.json(
        { error: "Employee code and PIN are required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { employeeCode },
    });

    if (!user || !user.pinHash) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN." },
        { status: 401 }
      );
    }

    const ok = await bcrypt.compare(pin, user.pinHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN." },
        { status: 401 }
      );
    }

    // Success – create a simple session based on employeeCode
    const res = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        employeeCode: user.employeeCode,
      },
    });

    const secure = process.env.NODE_ENV === "production";

    // This is the "session token" the worker portal will use
    res.cookies.set({
      name: "worker_session_code",
      value: user.employeeCode ?? "",
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours
    });

    // Just for display in the UI (safe to be non-HttpOnly)
    res.cookies.set({
      name: "worker_session_name",
      value: user.name ?? "",
      httpOnly: false,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return res;
  } catch (err) {
    console.error("Error in /api/worker/login", err);
    return NextResponse.json(
      { error: "Internal error while logging in." },
      { status: 500 }
    );
  }
}