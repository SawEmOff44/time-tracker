// app/api/admin/login/route.ts
import { NextRequest, NextResponse } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export async function POST(req: NextRequest) {
  if (!ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "Admin password not configured on server" },
      { status: 500 }
    );
  }

  const { password } = await req.json().catch(() => ({} as any));

  if (!password || password !== ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "Invalid admin password" },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ success: true });

  // Set a simple session cookie – you can upgrade this to JWT later.
  res.cookies.set("admin_session", "ok", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return res;
}