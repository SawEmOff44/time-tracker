// app/admin/(protected)/flagged-shifts/page.tsx
import { prisma } from "@/lib/prisma";
import Link from "next/link";

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

function calculateShiftHours(clockIn: Date, clockOut: Date | null): number {
  if (!clockOut) return 0;
  const diffMs = clockOut.getTime() - clockIn.getTime();
  return diffMs / (1000 * 60 * 60);
}

export default async function FlaggedShiftsPage({
  searchParams,
}: {
  searchParams?: {
    page?: string;
  };
}) {
  const page = Math.max(1, parseInt(searchParams?.page ?? "1", 10) || 1);
  const PAGE_SIZE = 25;
  const skip = (page - 1) * PAGE_SIZE;

  // Find all shifts with geofence warnings in notes
  const flaggedShifts = await prisma.shift.findMany({
    where: {
      notes: {
        contains: "⚠️",
      },
    },
    include: {
      user: {
        select: {
          name: true,
          employeeCode: true,
        },
      },
      location: {
        select: {
          name: true,
          code: true,
        },
      },
    },
    orderBy: {
      clockIn: "desc",
    },
    take: PAGE_SIZE,
    skip,
  });

  const totalFlagged = await prisma.shift.count({
    where: {
      notes: {
        contains: "⚠️",
      },
    },
  });

  const totalPages = Math.ceil(totalFlagged / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">
            Geofence-Flagged Shifts
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Shifts that were clocked in or out outside the allowed geofence
            radius (WARN policy)
          </p>
        </div>
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-2">
          <p className="text-xs uppercase tracking-wider text-amber-200/80">
            Total Flagged
          </p>
          <p className="text-2xl font-semibold text-amber-200">
            {totalFlagged}
          </p>
        </div>
      </div>

      {/* Filter/Navigation Bar */}
      <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-900/80 border border-slate-700/80 p-4">
        <div className="text-sm text-slate-300">
          Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, totalFlagged)} of{" "}
          {totalFlagged} flagged shifts
        </div>
        <div className="flex items-center gap-2">
          {page > 1 && (
            <Link
              href={`/admin/flagged-shifts?page=${page - 1}`}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-sm hover:bg-slate-700 transition"
            >
              ← Previous
            </Link>
          )}
          <span className="text-sm text-slate-400">
            Page {page} of {totalPages || 1}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/flagged-shifts?page=${page + 1}`}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-sm hover:bg-slate-700 transition"
            >
              Next →
            </Link>
          )}
        </div>
      </div>

      {/* Table */}
      {flaggedShifts.length === 0 ? (
        <div className="rounded-xl bg-slate-900/40 border border-slate-700/60 p-12 text-center">
          <p className="text-slate-400">
            No flagged shifts found. All shifts are within geofence compliance.
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-900/80 border border-slate-700/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/80 bg-slate-800/50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-300">
                    Worker
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300">
                    Clock In
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300">
                    Clock Out
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300">
                    Hours
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300">
                    Flag Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {flaggedShifts.map((shift) => {
                  const hours = calculateShiftHours(shift.clockIn, shift.clockOut);
                  
                  // Extract distance from notes if available
                  const clockInMatch = shift.notes?.match(/Clock-in outside geofence \((\d+)m from site/);
                  const clockOutMatch = shift.notes?.match(/Clock-out outside geofence \((\d+)m from site/);
                  
                  return (
                    <tr
                      key={shift.id}
                      className="hover:bg-slate-800/40 transition"
                    >
                      <td className="px-4 py-3 text-slate-200">
                        <div className="font-medium">
                          {shift.user?.name ?? "Unknown"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {shift.user?.employeeCode ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-200">
                        <div className="font-medium">
                          {shift.location?.name ?? "ADHOC"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {shift.location?.code ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-200">
                        {formatDateTimeLocal(shift.clockIn)}
                      </td>
                      <td className="px-4 py-3 text-slate-200">
                        {shift.clockOut ? (
                          formatDateTimeLocal(shift.clockOut)
                        ) : (
                          <span className="text-amber-300 font-medium">
                            Still clocked in
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-200">
                        {shift.clockOut ? `${hours.toFixed(2)}h` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1 text-xs">
                          {clockInMatch && (
                            <div className="flex items-center gap-2 text-amber-200">
                              <span className="text-base">⚠️</span>
                              <span>
                                In: {clockInMatch[1]}m from site
                              </span>
                            </div>
                          )}
                          {clockOutMatch && (
                            <div className="flex items-center gap-2 text-amber-200">
                              <span className="text-base">⚠️</span>
                              <span>
                                Out: {clockOutMatch[1]}m from site
                              </span>
                            </div>
                          )}
                          {shift.notes && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-slate-400 hover:text-slate-300">
                                View full notes
                              </summary>
                              <div className="mt-2 p-2 rounded bg-slate-800/60 text-slate-300 max-w-md">
                                {shift.notes}
                              </div>
                            </details>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Bottom */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/admin/flagged-shifts?page=${page - 1}`}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 text-sm hover:bg-slate-700 transition"
            >
              ← Previous
            </Link>
          )}
          <span className="text-sm text-slate-400 px-4">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/flagged-shifts?page=${page + 1}`}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 text-sm hover:bg-slate-700 transition"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
