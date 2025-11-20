import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Clock API is reachable",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { employeeCode, pin, locationId, lat, lng } = body;

  // For now, just echo back what we got so you can see GPS working
  return NextResponse.json({
    status: "ok",
    message: "Received clock request",
    received: {
      employeeCode,
      locationId,
      lat,
      lng,
      pinLength: pin ? String(pin).length : 0, // don't echo actual PIN
    },
  });
}
