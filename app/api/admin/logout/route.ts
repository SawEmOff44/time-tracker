// app/api/admin/logout/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET() {
  const res = NextResponse.redirect("/admin/login");
  res.cookies.set("admin_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",   // <-- must match login
    maxAge: 0,
  });
  return res;
}