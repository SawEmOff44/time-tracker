// app/api/worker/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  const common = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };

  res.cookies.set({
    name: "worker_session_code",
    value: "",
    ...common,
  });

  res.cookies.set({
    name: "worker_session_name",
    value: "",
    ...common,
  });

  return res;
}