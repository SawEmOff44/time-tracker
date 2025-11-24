// app/admin/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const url = new URL("/admin/login", req.url);
  const res = NextResponse.redirect(url);

  // Kill the admin_session cookie
  res.cookies.set("admin_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  return res;
}

// Optional: support GET as well (e.g. if you ever hit /admin/logout directly)
export async function GET(req: NextRequest) {
  return POST(req);
}