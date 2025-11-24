// app/admin/(protected)/page.tsx
import { prisma } from "@/lib/prisma";
import { startOfMonth } from "date-fns";

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

function formatHours(clockIn: Date | null, clockOut: Date | null) {
  if (!clockIn || !clockOut) return "—";
  const diffMs = clockOut.getTime() - clockIn.getTime();
  if (diffMs <= 0) return "—";
  const hours = diffMs / (1000 * 60 * 60);
  return hours.toFixed(2);
}

// ADHOC = locations with radiusMeters === 0
function isAdhocShift(shift: { location: { radiusMeters: number | null } | null }) {
  return !!shift.location && shift.location.radiusMeters === 0;
}

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const monthStart = startOfMonth(now);

  const [
    totalEmployees,
    activeEmployees,
    totalLocations,
    shiftsToday,
    recentShifts,
    adhocShiftsThisMonth,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { active: true } }),
    prisma.location.count({ where: { active: true } }),
    prisma.shift.count({
      where: {
        clockIn: { gte: todayStart },
      },
    }),
    prisma.shift.findMany({
      orderBy: { clockIn: "desc" },
      take: 10,
      include: {
        user: true,
        location: true,
      },
    }),
    prisma.shift.findMany({
      where: {
        clockIn: { gte: monthStart },
        location: {
          radiusMeters: 0,
        },
      },
      include: {
        user: true,
        location: true,
      },
    }),
  ]);

  // ADHOC analytics
  const adhocCounts = new Map<
    string,
    { userName: string; employeeCode: string | null; count: number }
  >();

  for (const shift of adhocShiftsThisMonth) {
    if (!shift.user) continue;
    const key = shift.user.id;
    const existing = adhocCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      adhocCounts.set(key, {
        userName: shift.user.name,
        employeeCode: shift.user.employeeCode,
        count: 1,
      });
    }
  }

  const suspiciousAdhocUsers = Array.from(adhocCounts.values())
    .filter((u) => u.count >= 3)
    .sort((a, b) => b.count - a.count);

  const totalAdhocShiftsThisMonth = adhocShiftsThisMonth.length;

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Overview of time tracking activity across Rhinehart Co.
        </p>
      </div>

      {/* STATS */}
      <div className="grid gap-6 lg:grid-cols-4 md:grid-cols-2">
        <div className="card">
          <div className="card-label">Active employees</div>
          <div className="card-value">{activeEmployees}</div>
          <p className="card-sub">{totalEmployees} total in system</p>
        </div>

        <div className="card">
          <div className="card-label">Active locations</div>
          <div className="card-value">{totalLocations}</div>
          <p className="card-sub">Job sites set up for GPS</p>
        </div>

        <div className="card">
          <div className="card-label">Shifts today</div>
          <div className="card-value">{shiftsToday}</div>
          <p className="card-sub">Clock-ins since midnight (local time)</p>
        </div>

        <div className="card card-amber">
          <div className="text-xs font-medium uppercase tracking-wide">
            ADHOC activity
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {totalAdhocShiftsThisMonth}
          </div>
          <p className="mt-1 text-xs">
            ADHOC shifts this month
            {suspiciousAdhocUsers.length > 0 && (
              <>
                {" · "}
                {suspiciousAdhocUsers.length}{" "}
                {suspiciousAdhocUsers.length === 1 ? "worker" : "workers"} over
                threshold
              </>
            )}
          </p>
        </div>
      </div>

      {/* ADHOC RISK PANEL FIRST (full width) */}
      <div className="rounded-2xl border border-amber-500/40 bg-amber-50/5 px-5 py-4 shadow-lg shadow-amber-900/30">
        <div className="border-b border-amber-500/30 pb-3 mb-3">
          <h2 className="text-sm font-semibold text-amber-200">
            ADHOC risk overview
          </h2>
          <p className="mt-1 text-xs text-amber-100/80">
            Workers with 3+ ADHOC shifts this month.
          </p>
        </div>

        <div className="space-y-3">
          {suspiciousAdhocUsers.length === 0 && (
            <p className="text-xs text-amber-100/80">
              No workers over the ADHOC threshold yet. Keep an eye on this
              panel for potential compliance issues.
            </p>
          )}

          {suspiciousAdhocUsers.map((u) => (
            <div
              key={u.userName + (u.employeeCode ?? "")}
              className="flex items-center justify-between rounded-lg bg-slate-950/40 px-3 py-2 border border-amber-500/30"
            >
              <div>
                <div className="text-sm font-medium text-amber-50">
                  {u.userName}
                </div>
                <div className="text-xs text-amber-100/80">
                  {u.employeeCode ?? "No code"} · {u.count} ADHOC shifts
                </div>
              </div>
              <div className="rounded-full bg-amber-400/20 px-3 py-0.5 text-xs font-semibold text-amber-200">
                {u.count}
              </div>
            </div>
          ))}

          {suspiciousAdhocUsers.length > 0 && (
            <p className="pt-1 text-[11px] leading-snug text-amber-100/80">
              Review these workers’ ADHOC clock-ins on the Shifts tab and use
              the map links to confirm on-site activity.
            </p>
          )}
        </div>
      </div>

      {/* RECENT SHIFTS – now full width, no horizontal scroll */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900/70 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              Recent shifts
            </h2>
            <p className="text-xs text-slate-400">
              Last 10 clock-in / clock-out records.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="admin-table min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/90">
              <tr>
                <th className="table-head-cell">Employee</th>
                <th className="table-head-cell">Location</th>
                <th className="table-head-cell">Clock in</th>
                <th className="table-head-cell">Clock out</th>
                <th className="table-head-cell">Hours</th>
                <th className="table-head-cell">ADHOC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              {recentShifts.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    No shifts recorded yet.
                  </td>
                </tr>
              )}

              {recentShifts.map((shift) => {
                const adhoc = isAdhocShift(shift);
                return (
                  <tr key={shift.id}>
                    <td className="table-cell">
                      <div className="font-medium text-slate-50">
                        {shift.user?.name ?? "Unknown"}
                      </div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-400">
                        {shift.user?.employeeCode ?? "—"}
                      </div>
                    </td>
                    <td className="table-cell text-slate-100">
                      {shift.location?.name ?? "—"}
                    </td>
                    <td className="table-cell text-slate-100">
                      {formatDateTimeLocal(shift.clockIn)}
                    </td>
                    <td className="table-cell text-slate-100">
                      {formatDateTimeLocal(shift.clockOut)}
                    </td>
                    <td className="table-cell text-slate-100">
                      {formatHours(shift.clockIn, shift.clockOut)}
                    </td>
                    <td className="table-cell">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          adhoc
                            ? "bg-amber-500/20 text-amber-200 border border-amber-400/40"
                            : "bg-emerald-500/15 text-emerald-200 border border-emerald-400/30"
                        }`}
                      >
                        {adhoc ? "ADHOC" : "Standard"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}