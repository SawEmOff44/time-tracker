// app/admin/(protected)/page.tsx
import { prisma } from "@/lib/prisma";
import { startOfMonth } from "date-fns";

type DashboardShift = {
  id: string;
  clockIn: Date;
  clockOut: Date | null;
  user: {
    name: string;
    employeeCode: string | null;
  } | null;
  location: {
    name: string;
    radiusMeters: number | null;
  } | null;
};

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

function isAdhocShift(shift: { location: { radiusMeters: number | null } | null }) {
  return !!shift.location && shift.location.radiusMeters === 0;
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  const monthStart = startOfMonth(now);

  const [
    activeEmployees,
    totalEmployees,
    activeLocations,
    shiftsToday,
    recentShiftsRaw,
    adhocShiftsThisMonth,
  ] = await Promise.all([
    prisma.user.count({ where: { active: true } }),
    prisma.user.count(),
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

  const recentShifts: DashboardShift[] = recentShiftsRaw.map((s) => ({
    id: s.id,
    clockIn: s.clockIn,
    clockOut: s.clockOut,
    user: s.user
      ? {
          name: s.user.name,
          employeeCode: s.user.employeeCode,
        }
      : null,
    location: s.location
      ? { name: s.location.name, radiusMeters: s.location.radiusMeters }
      : null,
  }));

  const adhocCountsByUser = new Map<
    string,
    { userName: string; employeeCode: string | null; count: number }
  >();

  for (const shift of adhocShiftsThisMonth) {
    if (!shift.user) continue;
    const key = shift.user.id;
    const existing = adhocCountsByUser.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      adhocCountsByUser.set(key, {
        userName: shift.user.name,
        employeeCode: shift.user.employeeCode,
        count: 1,
      });
    }
  }

  const suspiciousAdhocUsers = Array.from(adhocCountsByUser.values())
    .filter((u) => u.count >= 3)
    .sort((a, b) => b.count - a.count);

  const totalAdhocShiftsThisMonth = adhocShiftsThisMonth.length;

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">
          Overview of today&apos;s clock-ins, active locations, and ADHOC
          activity.
        </p>
      </div>

      {/* TOP STATS */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <div className="card-label">Active employees</div>
          <div className="card-value">{activeEmployees}</div>
          <p className="card-sub">
            {totalEmployees} total in system · {activeEmployees} currently active
          </p>
        </div>

        <div className="card">
          <div className="card-label">Active job sites</div>
          <div className="card-value">{activeLocations}</div>
          <p className="card-sub">Locations with GPS radius configured</p>
        </div>

        <div className="card">
          <div className="card-label">Shifts today</div>
          <div className="card-value">{shiftsToday}</div>
          <p className="card-sub">
            Clock-ins since midnight (Central time zone)
          </p>
        </div>

        <div className="card card-amber">
          <div className="card-label text-amber-900">ADHOC shifts (month)</div>
          <div className="card-value text-amber-950">
            {totalAdhocShiftsThisMonth}
          </div>
          <p className="card-sub text-amber-900/80">
            Zero-radius locations only
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

      {/* LOWER GRID */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Recent shifts table */}
        <section className="xl:col-span-2 card">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Recent shifts
              </h2>
              <p className="text-xs text-slate-500">
                Last 10 clock-in / clock-out records.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="table-head-cell">Employee</th>
                  <th className="table-head-cell">Location</th>
                  <th className="table-head-cell">Clock in</th>
                  <th className="table-head-cell">Clock out</th>
                  <th className="table-head-cell text-right">Hours</th>
                  <th className="table-head-cell text-center">ADHOC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentShifts.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-sm text-slate-400"
                    >
                      No shifts recorded yet.
                    </td>
                  </tr>
                )}

                {recentShifts.map((shift) => {
                  const adhoc = isAdhocShift({
                    location: shift.location
                      ? { radiusMeters: shift.location.radiusMeters }
                      : null,
                  });

                  return (
                    <tr
                      key={shift.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="table-cell align-top">
                        <div className="font-medium text-slate-900">
                          {shift.user?.name ?? "Unknown"}
                        </div>
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                          {shift.user?.employeeCode ?? "—"}
                        </div>
                      </td>
                      <td className="table-cell align-top text-slate-800">
                        {shift.location?.name ?? "—"}
                      </td>
                      <td className="table-cell align-top text-slate-800">
                        {formatDateTimeLocal(shift.clockIn)}
                      </td>
                      <td className="table-cell align-top text-slate-800">
                        {formatDateTimeLocal(shift.clockOut)}
                      </td>
                      <td className="table-cell align-top text-right text-slate-800">
                        {formatHours(shift.clockIn, shift.clockOut)}
                      </td>
                      <td className="table-cell align-top text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            adhoc
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-100"
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
        </section>

        {/* ADHOC risk panel */}
        <section className="card bg-amber-50/80 border-amber-200">
          <div className="border-b border-amber-100 pb-3 mb-3">
            <h2 className="text-sm font-semibold text-amber-950">
              ADHOC risk overview
            </h2>
            <p className="text-xs text-amber-800">
              Workers with 3+ ADHOC shifts this month.
            </p>
          </div>

          <div className="space-y-3">
            {suspiciousAdhocUsers.length === 0 && (
              <p className="text-xs text-amber-900">
                No one is over the ADHOC threshold yet. Use this panel to spot
                patterns in off-site or manual clock-ins.
              </p>
            )}

            {suspiciousAdhocUsers.map((u) => (
              <div
                key={u.userName + (u.employeeCode ?? "")}
                className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 border border-amber-100"
              >
                <div>
                  <div className="text-sm font-medium text-amber-950">
                    {u.userName}
                  </div>
                  <div className="text-xs text-amber-800">
                    {u.employeeCode ?? "No code"} · {u.count} ADHOC shifts
                  </div>
                </div>
                <div className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                  {u.count}
                </div>
              </div>
            ))}

            {suspiciousAdhocUsers.length > 0 && (
              <p className="pt-1 text-[11px] leading-snug text-amber-900/90">
                Cross-check these workers on the Shifts tab and use the map
                links to verify on-site activity.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}