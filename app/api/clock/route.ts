import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  // This runs when you visit /api/clock in the browser
  return NextResponse.json({
    status: "ok",
    message: "Clock API is reachable",
  });
}

export async function POST(req: NextRequest) {
  // This runs when something sends a POST request to /api/clock
  const body = await req.json().catch(() => null);

  return NextResponse.json({
    status: "ok",
    received: body,
  });
}
