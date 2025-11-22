// app/api/admin/logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = cookies();

  // Remove the admin session cookie
  cookieStore.set("admin_session", "", {
    expires: new Date(0),
    path: "/",
  });

  return NextResponse.json({ success: true });
}