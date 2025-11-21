// app/api/admin/login/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || typeof body.password !== "string") {
    return NextResponse.json(
      { error: "Password is required" },
      { status: 400 }
    );
  }

  if (!ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "Admin password not configured on server" },
      { status: 500 }
    );
  }

  if (body.password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // ✅ Set a cookie that works for /admin *and* /api/*
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_session", "ok", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/", // <-- IMPORTANT: make it available to all routes
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return res;
}