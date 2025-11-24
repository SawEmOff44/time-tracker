// app/api/clock/corrections/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Local TS types instead of importing from @prisma/client
type ShiftCorrectionType =
  | "MISSING_IN"
  | "MISSING_OUT"
  | "ADJUST_IN"
  | "ADJUST_OUT"
  | "NEW_SHIFT";

type CorrectionStatus = "PENDING" | "APPROVED" | "REJECTED";

const prismaAny = prisma as any;

type CorrectionBody = {
  employeeCode: string;
  pin: string;
  type: ShiftCorrectionType | string;
  shiftId?: string | null;
  requestedClockIn?: string | null;
  requestedClockOut?: string | null;
  reason?: string | null;
};

// Helper: validate incoming type string against allowed values
function parseCorrectionType(value: string): ShiftCorrectionType | null {
  const upper = value.toUpperCase();
  const allowed: ShiftCorrectionType[] = [
    "MISSING_IN",
    "MISSING_OUT",
    "ADJUST_IN",
    "ADJUST_OUT",
    "NEW_SHIFT",
  ];
  return (allowed.find((t) => t === upper) as ShiftCorrectionType | undefined) ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<CorrectionBody>;

    const employeeCode = body.employeeCode?.trim();
    const pin = body.pin?.trim();
    const typeRaw = (body.type as string | undefined) ?? "";

    if (!employeeCode || !pin || !typeRaw) {
      return NextResponse.json(
        { error: "Employee code, PIN, and correction type are required." },
        { status: 400 }
      );
    }

    const type = parseCorrectionType(typeRaw);
    if (!type) {
      return NextResponse.json(
        { error: "Invalid correction type." },
        { status: 400 }
      );
    }

    // Look up user
    const user = await prisma.user.findFirst({
      where: { employeeCode, active: true },
    });

    if (!user || user.pinHash !== pin) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN." },
        { status: 401 }
      );
    }

    // Parse requested times (if provided)
    let requestedClockIn: Date | null = null;
    let requestedClockOut: Date | null = null;

    if (body.requestedClockIn) {
      const d = new Date(body.requestedClockIn);
      if (!Number.isNaN(d.getTime())) {
        requestedClockIn = d;
      }
    }

    if (body.requestedClockOut) {
      const d = new Date(body.requestedClockOut);
      if (!Number.isNaN(d.getTime())) {
        requestedClockOut = d;
      }
    }

    const shiftId = body.shiftId?.trim() || null;

    const created = await prismaAny.shiftCorrectionRequest.create({
      data: {
        userId: user.id,
        shiftId,
        type,
        requestedClockIn: requestedClockIn ?? undefined,
        requestedClockOut: requestedClockOut ?? undefined,
        reason: body.reason?.trim() || null,
        status: "PENDING" as CorrectionStatus,
      },
    });

    return NextResponse.json(
      {
        message: "Correction request submitted for review.",
        id: created.id,
        status: created.status as CorrectionStatus,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error creating shift correction:", err);
    return NextResponse.json(
      { error: "Unexpected server error while submitting correction." },
      { status: 500 }
    );
  }
}