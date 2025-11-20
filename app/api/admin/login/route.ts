import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE_NAME = "admin_session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || !body.password) {
    return NextResponse.json(
      { error: "Password is required" },
      { status: 400 }
    );
  }

  const { password } = body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json(
      { error: "Admin password not configured on server" },
      { status: 500 }
    );
  }

  if (password !== adminPassword) {
    return NextResponse.json(
      { error: "Invalid password" },
      { status: 401 }
    );
  }

  // Create a simple session token. For MVP, a random string is fine.
  const token = crypto.randomUUID();

  const res = NextResponse.json({ success: true });

  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return res;
}
