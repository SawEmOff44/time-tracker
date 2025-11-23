// app/admin/(protected)/page.tsx
import { prisma } from "@/lib/prisma";
import { startOfMonth } from "date-fns";

// Shape we actually render in the table
type RecentShift = {
  id: string;
  clockIn: Date | null;
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

// Helpers
function formatDateTimeLocal(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Chicago", // keep consistent for you
  });
}

function formatHours(clockIn: Date | null, clockOut: Date | null) {
  if (!clockIn || !clockOut) return "—";
  const diffMs = clockOut.getTime() - clockIn.getTime();
  if (diffMs <= 0) return "—";
  const hours = diffMs / (1000 * 60 * 60);
  return hours.toFixed(2);
}

// ADHOC = location with radiusMeters === 0
function isAdhocShift(shift: { location: { radiusMeters: number | null } | null }) {
  if (!shift.location) return false;
  return shift.location.radiusMeters === 0;
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

  // Core stats + recent shifts
  const [
    totalEmployees,
    activeEmployees,
    totalLocations,
    shiftsToday,
    recentShiftsRaw,
    adhocShiftsThisMonthRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { active: true } }),
    prisma.location.count({ where: { active: true } }),
    prisma.shift.count({
      where: {
        clockIn: {
          gte: todayStart,
        },
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
        // ADHOC = location with radiusMeters === 0
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

  // Normalize recent shifts into our display type
  const recentShifts: RecentShift[] = recentShiftsRaw.map((s: any) => ({
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
      ? {
          name: s.location.name,
          radiusMeters: s.location.radiusMeters,
        }
      : null,
  }));

  // ADHOC analytics: count adhoc shifts per worker (3+ triggers "attention")
  const adhocCounts = new Map<
    string,
    { userName: string; employeeCode: string | null; count: number }
  >();

  for (const s of adhocShiftsThisMonthRaw) {
    if (!s.user) continue;
    const key = s.user.id;
    const existing = adhocCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      adhocCounts.set(key, {
        userName: s.user.name,
        employeeCode: s.user.employeeCode,
        count: 1,
      });
    }
  }

  const suspiciousAdhocUsers = Array.from(adhocCounts.values())
    .filter((u) => u.count >= 3)
    .sort((a, b) => b.count - a.count);

  const totalAdhocShiftsThisMonth = adhocShiftsThisMonthRaw.length;

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of time tracking activity across Rhinehart Co.
        </p>
      </div>

      {/* STATS */}
      <div className="grid gap-6 lg:grid-cols-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-xs font-medium text-gray-500">Active employees</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {activeEmployees}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {totalEmployees} total in system
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-xs font-medium text-gray-500">Active locations</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {totalLocations}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Job sites configured for GPS tracking
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-xs font-medium text-gray-500">Shifts today</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {shiftsToday}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Clock-ins since midnight (local time)
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <div className="text-xs font-medium text-amber-700">ADHOC activity</div>
          <div className="mt-2 text-2xl font-semibold text-amber-900">
            {totalAdhocShiftsThisMonth}
          </div>
          <p className="mt-1 text-xs text-amber-800">
            ADHOC shifts this month
            {suspiciousAdhocUsers.length > 0 && (
              <>
                {" · "}
                {suspiciousAdhocUsers.length}{" "}
                {suspiciousAdhocUsers.length === 1 ? "worker" : "workers"}{" "}
                over threshold
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* RECENT SHIFTS */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Recent shifts
              </h2>
              <p className="text-xs text-gray-500">
                Last 10 clock-in / clock-out records.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Employee
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Location
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Clock in
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Clock out
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Hours
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    ADHOC
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {recentShifts.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-sm text-gray-400"
                    >
                      No shifts recorded yet.
                    </td>
                  </tr>
                )}

                {recentShifts.map((shift) => {
                  const adhoc = isAdhocShift(shift);
                  return (
                    <tr key={shift.id}>
                      <td className="px-4 py-2 align-top">
                        <div className="font-medium text-gray-900">
                          {shift.user?.name ?? "Unknown"}
                        </div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                          {shift.user?.employeeCode ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-2 align-top text-gray-700">
                        {adhoc ? "ADHOC" : shift.location?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2 align-top text-gray-700">
                        {formatDateTimeLocal(shift.clockIn)}
                      </td>
                      <td className="px-4 py-2 align-top text-gray-700">
                        {formatDateTimeLocal(shift.clockOut)}
                      </td>
                      <td className="px-4 py-2 align-top text-gray-700">
                        {formatHours(shift.clockIn, shift.clockOut)}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            adhoc
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-50 text-emerald-700"
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

        {/* ADHOC RISK PANEL */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 shadow-sm">
          <div className="border-b border-amber-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-amber-900">
              ADHOC risk overview
            </h2>
            <p className="text-xs text-amber-800">
              Workers with 3+ ADHOC shifts this month.
            </p>
          </div>

          <div className="px-5 py-4 space-y-3">
            {suspiciousAdhocUsers.length === 0 && (
              <p className="text-xs text-amber-800">
                No workers over the ADHOC threshold yet. Keep an eye on this
                panel for potential compliance issues.
              </p>
            )}

            {suspiciousAdhocUsers.map((u) => (
              <div
                key={u.userName + (u.employeeCode ?? "")}
                className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium text-amber-950">
                    {u.userName}
                  </div>
                  <div className="text-xs text-amber-700">
                    {u.employeeCode ?? "No code"} · {u.count} ADHOC shifts
                  </div>
                </div>
                <div className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {u.count}
                </div>
              </div>
            ))}

            {suspiciousAdhocUsers.length > 0 && (
              <p className="pt-1 text-[11px] leading-snug text-amber-800">
                Review these workers’ ADHOC clock-ins on the Shifts tab and use
                the map links to confirm on-site activity.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}