// app/api/clock/corrections/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CorrectionStatus, ShiftCorrectionType } from "@prisma/client";

// Small helper to safely parse enum from string
function parseCorrectionType(
  raw: string | undefined
): ShiftCorrectionType | null {
  if (!raw) return null;
  const upper = raw.toUpperCase() as keyof typeof ShiftCorrectionType;
  return ShiftCorrectionType[upper] ?? null;
}

// --------- POST: create a correction request --------------------------------
// Used by worker portal (NO PIN needed).
//
// Expected body:
// {
//   userId: string;
//   shiftId?: string | null;
//   type: "MISSING_IN" | "MISSING_OUT" | "ADJUST_IN" | "ADJUST_OUT" | "NEW_SHIFT";
//   requestedClockIn?: string | null;  // ISO or "YYYY-MM-DDTHH:mm"
//   requestedClockOut?: string | null;
//   reason?: string | null;
// }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      shiftId?: string | null;
      type?: string;
      requestedClockIn?: string | null;
      requestedClockOut?: string | null;
      reason?: string | null;
    };

    const {
      userId,
      shiftId,
      type,
      requestedClockIn,
      requestedClockOut,
      reason,
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required to submit a correction request." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.active) {
      return NextResponse.json(
        { error: "Worker not found or inactive." },
        { status: 404 }
      );
    }

    const parsedType = parseCorrectionType(type);
    if (!parsedType) {
      return NextResponse.json(
        { error: "A valid correction type is required." },
        { status: 400 }
      );
    }

    // Parse requested in/out times (optional)
    const requestedIn =
      requestedClockIn && requestedClockIn.trim().length > 0
        ? new Date(requestedClockIn)
        : null;
    const requestedOut =
      requestedClockOut && requestedClockOut.trim().length > 0
        ? new Date(requestedClockOut)
        : null;

    // Light sanity checks per type
    if (
      (parsedType === ShiftCorrectionType.MISSING_IN ||
        parsedType === ShiftCorrectionType.ADJUST_IN) &&
      !requestedIn
    ) {
      return NextResponse.json(
        {
          error:
            "Requested clock-in time is required for this correction type.",
        },
        { status: 400 }
      );
    }

    if (
      (parsedType === ShiftCorrectionType.MISSING_OUT ||
        parsedType === ShiftCorrectionType.ADJUST_OUT) &&
      !requestedOut
    ) {
      return NextResponse.json(
        {
          error:
            "Requested clock-out time is required for this correction type.",
        },
        { status: 400 }
      );
    }

    if (
      parsedType === ShiftCorrectionType.NEW_SHIFT &&
      !requestedIn &&
      !requestedOut
    ) {
      return NextResponse.json(
        {
          error:
            "For a NEW_SHIFT correction, provide at least a requested clock-in or clock-out.",
        },
        { status: 400 }
      );
    }

    // Optional: if a shiftId is passed, ensure it belongs to this user
    let safeShiftId: string | null = null;
    if (shiftId) {
      const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
      });
      if (!shift || shift.userId !== userId) {
        return NextResponse.json(
          { error: "Shift not found or does not belong to this worker." },
          { status: 400 }
        );
      }
      safeShiftId = shift.id;
    }

    const created = await prisma.shiftCorrectionRequest.create({
      data: {
        userId,
        shiftId: safeShiftId,
        type: parsedType,
        requestedClockIn: requestedIn,
        requestedClockOut: requestedOut,
        reason: reason?.trim() || null,
        status: CorrectionStatus.PENDING,
      },
      include: {
        user: true,
        shift: {
          include: { location: true },
        },
      },
    });

    return NextResponse.json(
      {
        id: created.id,
        status: created.status,
        type: created.type,
        userId: created.userId,
        shiftId: created.shiftId,
        requestedClockIn: created.requestedClockIn
          ? created.requestedClockIn.toISOString()
          : null,
        requestedClockOut: created.requestedClockOut
          ? created.requestedClockOut.toISOString()
          : null,
        reason: created.reason,
        createdAt: created.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error creating shift correction", err);
    return NextResponse.json(
      { error: "Failed to submit correction request." },
      { status: 500 }
    );
  }
}

// --------- GET: list correction requests (used by Exceptions page) ----------
// Optional query param: ?status=PENDING|APPROVED|REJECTED (default PENDING)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") || "PENDING";

    const statusKey = statusParam.toUpperCase() as keyof typeof CorrectionStatus;
    const status = CorrectionStatus[statusKey] ?? CorrectionStatus.PENDING;

    const corrections = await prisma.shiftCorrectionRequest.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        shift: {
          include: { location: true },
        },
      },
    });

    const payload = corrections.map((c) => ({
      id: c.id,
      userId: c.userId,
      userName: c.user.name,
      employeeCode: c.user.employeeCode,
      type: c.type,
      status: c.status,
      reason: c.reason,
      requestedClockIn: c.requestedClockIn
        ? c.requestedClockIn.toISOString()
        : null,
      requestedClockOut: c.requestedClockOut
        ? c.requestedClockOut.toISOString()
        : null,
      shiftId: c.shiftId,
      shiftClockIn: c.shift?.clockIn
        ? c.shift.clockIn.toISOString()
        : null,
      shiftClockOut: c.shift?.clockOut
        ? c.shift.clockOut.toISOString()
        : null,
      locationName: c.shift?.location?.name ?? null,
      createdAt: c.createdAt.toISOString(),
    }));

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Error listing shift corrections", err);
    return NextResponse.json(
      { error: "Failed to load correction requests." },
      { status: 500 }
    );
  }
}

// --------- PATCH: approve / reject AND auto-apply to Shift ------------------

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      id?: string;
      action?: string; // "approve" | "reject"
    };

    const id = body.id;
    if (!id) {
      return NextResponse.json(
        { error: "Correction id is required." },
        { status: 400 }
      );
    }

    const action = (body.action ?? "").toLowerCase();

    let targetStatus: CorrectionStatus;
    if (action === "approve" || action === "approved") {
      targetStatus = CorrectionStatus.APPROVED;
    } else if (action === "reject" || action === "rejected") {
      targetStatus = CorrectionStatus.REJECTED;
    } else {
      return NextResponse.json(
        { error: "Unknown action. Use 'approve' or 'reject'." },
        { status: 400 }
      );
    }

    // Load the full correction (with shift + user) so we can act on it
    const correction = await prisma.shiftCorrectionRequest.findUnique({
      where: { id },
      include: {
        shift: true,
        user: true,
      },
    });

    if (!correction) {
      return NextResponse.json(
        { error: "Shift correction request not found." },
        { status: 404 }
      );
    }

    let updatedShift: any = null;

    // Only apply side-effects when moving to APPROVED
    if (targetStatus === CorrectionStatus.APPROVED) {
      const {
        type,
        shiftId,
        requestedClockIn,
        requestedClockOut,
        userId,
        reason,
      } = correction;

      // 1) NEW_SHIFT => create a brand new shift
      if (type === ShiftCorrectionType.NEW_SHIFT) {
        if (!requestedClockIn && !requestedClockOut) {
          console.warn(
            `NEW_SHIFT correction ${id} missing requestedClockIn/out`
          );
        } else {
          updatedShift = await prisma.shift.create({
            data: {
              userId,
              locationId: null, // unknown; can be edited later if needed
              clockIn: requestedClockIn ?? requestedClockOut!,
              clockOut: requestedClockOut ?? null,
              notes: [
                "Created via approved shift correction request.",
                reason ? `Reason: ${reason}` : null,
              ]
                .filter(Boolean)
                .join(" "),
            },
          });
        }
      }

      // 2) Existing shift adjustments (IN / OUT)
      if (type !== ShiftCorrectionType.NEW_SHIFT && shiftId) {
        const updateData: any = {};

        if (
          (type === ShiftCorrectionType.MISSING_IN ||
            type === ShiftCorrectionType.ADJUST_IN) &&
          requestedClockIn
        ) {
          updateData.clockIn = requestedClockIn;
        }

        if (
          (type === ShiftCorrectionType.MISSING_OUT ||
            type === ShiftCorrectionType.ADJUST_OUT) &&
          requestedClockOut
        ) {
          updateData.clockOut = requestedClockOut;
        }

        if (Object.keys(updateData).length > 0) {
          const baseNotes = correction.shift?.notes ?? "";
          const tag = "Adjusted via approved correction request.";
          const reasonText = reason ? `Reason: ${reason}` : null;

          updateData.notes = [baseNotes, tag, reasonText]
            .filter((s) => s && s.trim().length > 0)
            .join(" ");

          updatedShift = await prisma.shift.update({
            where: { id: shiftId },
            data: updateData,
          });
        }
      }
    }

    const updatedRequest = await prisma.shiftCorrectionRequest.update({
      where: { id },
      data: {
        status: targetStatus,
      },
      include: {
        shift: true,
        user: true,
      },
    });

    return NextResponse.json({
      request: updatedRequest,
      updatedShift,
    });
  } catch (err) {
    console.error("Error updating shift correction", err);
    return NextResponse.json(
      { error: "Failed to update shift correction." },
      { status: 500 }
    );
  }
}