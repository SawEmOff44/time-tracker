// app/api/admin/logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = cookies();

  // Clear a few likely cookie names, harmless if they don't exist
  const cookieNames = ["admin_session", "adminAuth", "admin_token"];

  for (const name of cookieNames) {
    cookieStore.set(name, "", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
    });
  }

  return NextResponse.json({ ok: true });
}