// app/admin/(protected)/exceptions/page.tsx
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ReactNode } from "react";

// Local TS enums instead of @prisma/client
type ShiftCorrectionType =
  | "MISSING_IN"
  | "MISSING_OUT"
  | "ADJUST_IN"
  | "ADJUST_OUT"
  | "NEW_SHIFT";

type CorrectionStatus = "PENDING" | "APPROVED" | "REJECTED";

const prismaAny = prisma as any;

type CorrectionWithRelations = Awaited<
  ReturnType<typeof prismaAny.shiftCorrectionRequest.findMany>
>[number];

function formatDateTimeLocal(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Chicago",
  });
}

function humanType(t: ShiftCorrectionType) {
  switch (t) {
    case "MISSING_IN":
      return "Missing clock-in";
    case "MISSING_OUT":
      return "Missing clock-out";
    case "ADJUST_IN":
      return "Adjust clock-in time";
    case "ADJUST_OUT":
      return "Adjust clock-out time";
    case "NEW_SHIFT":
      return "New shift request";
    default:
      return t;
  }
}

function statusBadgeClasses(status: CorrectionStatus) {
  switch (status) {
    case "PENDING":
      return "bg-amber-500/10 text-amber-200 border border-amber-500/50";
    case "APPROVED":
      return "bg-emerald-500/10 text-emerald-200 border border-emerald-500/50";
    case "REJECTED":
      return "bg-rose-500/10 text-rose-200 border border-rose-500/50";
    default:
      return "bg-slate-500/10 text-slate-200 border border-slate-500/40";
  }
}

/* --- Server actions for Approve / Reject -------------------------------- */

async function updateRequestStatus(id: string, status: CorrectionStatus) {
  "use server";

  // Load full correction so we can act on the base Shift
  const correction = await prismaAny.shiftCorrectionRequest.findUnique({
    where: { id },
    include: {
      shift: true,
      user: true,
    },
  });

  if (!correction) {
    console.warn(`ShiftCorrectionRequest ${id} not found`);
    return;
  }

  let updatedShift: any = null;

  if (status === "APPROVED") {
    const {
      type,
      shiftId,
      requestedClockIn,
      requestedClockOut,
      userId,
      reason,
    } = correction as {
      type: ShiftCorrectionType;
      shiftId: string | null;
      requestedClockIn: Date | null;
      requestedClockOut: Date | null;
      userId: string;
      reason: string | null;
      shift: {
        id: string;
        notes: string | null;
        locationId: string | null;
      } | null;
    };

    // 1) NEW_SHIFT => create a brand new Shift row
    if (type === "NEW_SHIFT") {
      if (!requestedClockIn && !requestedClockOut) {
        console.warn(
          `NEW_SHIFT correction ${id} missing requestedClockIn/out; skipping shift create.`
        );
      } else {
        const locationId =
          correction.shift && correction.shift.locationId
            ? correction.shift.locationId
            : null;

        updatedShift = await prismaAny.shift.create({
          data: {
            userId,
            locationId,
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

    // 2) Adjust an existing shift (all non-NEW types)
    if (type !== "NEW_SHIFT" && shiftId) {
      const updateData: any = {};

      if (requestedClockIn) {
        updateData.clockIn = requestedClockIn;
      }

      if (requestedClockOut) {
        updateData.clockOut = requestedClockOut;
      }

      if (Object.keys(updateData).length > 0) {
        const baseNotes = correction.shift?.notes ?? "";
        const tag = "Adjusted via approved correction request.";
        const reasonText = reason ? `Reason: ${reason}` : null;

        updateData.notes = [baseNotes, tag, reasonText]
          .filter((s) => s && s.trim().length > 0)
          .join(" ");

        updatedShift = await prismaAny.shift.update({
          where: { id: shiftId },
          data: updateData,
        });
      }
    }
  }

  // Finally, update the request status itself
  await prismaAny.shiftCorrectionRequest.update({
    where: { id },
    data: { status },
  });

  // Revalidate the Exceptions page so UI updates
  revalidatePath("/admin/exceptions");
}

function ApproveRejectActions({ id }: { id: string }) {
  async function approveAction() {
    "use server";
    await updateRequestStatus(id, "APPROVED");
  }

  async function rejectAction() {
    "use server";
    await updateRequestStatus(id, "REJECTED");
  }

  return (
    <div className="flex gap-2 justify-end">
      <form action={approveAction}>
        <button
          type="submit"
          className="rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition"
        >
          Approve
        </button>
      </form>
      <form action={rejectAction}>
        <button
          type="submit"
          className="rounded-full bg-rose-500/90 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-rose-400 transition"
        >
          Reject
        </button>
      </form>
    </div>
  );
}

/* --- Page component ------------------------------------------------------ */

export default async function ExceptionsPage() {
  const pending = (await prismaAny.shiftCorrectionRequest.findMany({
    where: { status: "PENDING" as CorrectionStatus },
    include: {
      user: true,
      shift: true,
    },
    orderBy: { createdAt: "desc" },
  })) as CorrectionWithRelations[];

  const recentlyHandled = (await prismaAny.shiftCorrectionRequest.findMany({
    where: {
      status: {
        in: ["APPROVED", "REJECTED"] as CorrectionStatus[],
      },
    },
    include: {
      user: true,
      shift: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  })) as CorrectionWithRelations[];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-50">
          Shift Exceptions
        </h1>
        <p className="mt-1 text-sm text-slate-300">
          Review worker-submitted fixes for missing or incorrect clock-ins and
          clock-outs.
        </p>
      </div>

      {/* Pending requests */}
      <section className="card">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              Pending requests
            </h2>
            <p className="text-xs text-slate-400">
              Items waiting for your approval or rejection.
            </p>
          </div>
          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200 border border-amber-500/50">
            {pending.length} pending
          </span>
        </div>

        {pending.length === 0 ? (
          <p className="text-sm text-slate-400">
            No pending correction requests. Nice and clean.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="min-w-full admin-table text-xs">
              <thead>
                <tr className="bg-slate-900/60">
                  <th className="px-3 py-2 text-left">Worker</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Requested times</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                  <th className="px-3 py-2 text-left">Linked shift</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {pending.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-900/50">
                    <td className="px-3 py-3 align-top">
                      <div className="text-slate-50 text-xs font-medium">
                        {r.user?.name ?? "Unknown"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {r.user?.employeeCode ?? "No code"}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Submitted {formatDateTimeLocal(r.createdAt)}
                      </div>
                    </td>

                    <td className="px-3 py-3 align-top">
                      <div className="text-[11px] font-semibold text-amber-100 uppercase tracking-wide">
                        {humanType(r.type as ShiftCorrectionType)}
                      </div>
                      <div
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClasses(
                          r.status as CorrectionStatus
                        )}`}
                      >
                        {r.status}
                      </div>
                    </td>

                    <td className="px-3 py-3 align-top">
                      <div className="text-[11px] text-slate-200">
                        In: {formatDateTimeLocal(r.requestedClockIn)}
                      </div>
                      <div className="text-[11px] text-slate-200">
                        Out: {formatDateTimeLocal(r.requestedClockOut)}
                      </div>
                    </td>

                    <td className="px-3 py-3 align-top">
                      <p className="text-[11px] text-slate-200 whitespace-pre-wrap max-w-xs">
                        {r.reason || "—"}
                      </p>
                    </td>

                    <td className="px-3 py-3 align-top">
                      {r.shift ? (
                        <div className="text-[11px] text-slate-200">
                          <div>
                            In: {formatDateTimeLocal(r.shift.clockIn)}
                          </div>
                          <div>
                            Out: {formatDateTimeLocal(r.shift.clockOut)}
                          </div>
                          <div className="mt-1 text-slate-400">
                            Loc: {r.shift.locationId ?? "—"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">
                          Not linked to a shift
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3 align-top text-right">
                      <ApproveRejectActions id={r.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recently handled */}
      <section className="card">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              Recently handled
            </h2>
            <p className="text-xs text-slate-400">
              Last 20 approved or rejected requests.
            </p>
          </div>
        </div>

        {recentlyHandled.length === 0 ? (
          <p className="text-sm text-slate-400">No recent activity yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="min-w-full admin-table text-xs">
              <thead>
                <tr className="bg-slate-900/60">
                  <th className="px-3 py-2 text-left">Worker</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Requested times</th>
                  <th className="px-3 py-2 text-left">Handled at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {recentlyHandled.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-3 align-top">
                      <div className="text-slate-50 text-xs font-medium">
                        {r.user?.name ?? "Unknown"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {r.user?.employeeCode ?? "No code"}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="text-[11px] text-slate-200">
                        {humanType(r.type as ShiftCorrectionType)}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClasses(
                          r.status as CorrectionStatus
                        )}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="text-[11px] text-slate-200">
                        In: {formatDateTimeLocal(r.requestedClockIn)}
                      </div>
                      <div className="text-[11px] text-slate-200">
                        Out: {formatDateTimeLocal(r.requestedClockOut)}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="text-[11px] text-slate-300">
                        {formatDateTimeLocal(r.updatedAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}