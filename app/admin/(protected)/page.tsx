// app/admin/(protected)/page.tsx
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

type RecentShift = {
  id: string;
  userName: string | null;
  locationName: string | null;
  clockIn: string | null;
  clockOut: string | null;
  isAdhoc?: boolean;
};

type TopAdhocUser = {
  userId: string;
  name: string | null;
  adhocCount: number;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminDashboardPage() {
  // Safe defaults so dashboard never hard-crashes
  let totalEmployees = 0;
  let activeEmployees = 0;
  let totalLocations = 0;
  let activeLocations = 0;
  let totalShiftsToday = 0;
  let totalHoursThisWeek = 0;
  let adhocShiftCount = 0;
  let recentShifts: RecentShift[] = [];
  let topAdhocUsers: TopAdhocUser[] = [];

  try {
    const now = new Date();

    // Today bounds
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );

    // One week ago (for weekly stats & ADHOC)
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);

    // Basic counts in parallel
    const [
      totalEmployeesCount,
      activeEmployeesCount,
      totalLocationsCount,
      activeLocationsCount,
      totalShiftsTodayCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.location.count(),
      prisma.location.count({ where: { active: true } }),
      prisma.shift.count({
        where: {
          clockIn: {
            gte: startOfToday,
            lt: endOfToday,
          },
        },
      }),
    ]);

    totalEmployees = totalEmployeesCount;
    activeEmployees = activeEmployeesCount;
    totalLocations = totalLocationsCount;
    activeLocations = activeLocationsCount;
    totalShiftsToday = totalShiftsTodayCount;

    // Shifts in last week for total hours
    const weekShifts = await prisma.shift.findMany({
      where: {
        clockIn: { gte: oneWeekAgo },
        clockOut: { not: null },
      },
      select: {
        clockIn: true,
        clockOut: true,
      },
    });

    totalHoursThisWeek = weekShifts.reduce((sum, s) => {
      if (!s.clockIn || !s.clockOut) return sum;
      const ms = s.clockOut.getTime() - s.clockIn.getTime();
      if (!Number.isFinite(ms) || ms <= 0) return sum;
      return sum + ms / (1000 * 60 * 60);
    }, 0);

    // Recent shifts
    const recentShiftRecords = await prisma.shift.findMany({
      orderBy: { clockIn: "desc" },
      take: 10,
      include: {
        user: true,
        location: true,
      },
    });

    recentShifts = recentShiftRecords.map((shift) => ({
      id: shift.id,
      userName: shift.user?.name ?? shift.user?.employeeCode ?? "Unknown",
      locationName: shift.location?.name ?? null,
      clockIn: shift.clockIn ? shift.clockIn.toISOString() : null,
      clockOut: shift.clockOut ? shift.clockOut.toISOString() : null,
      // ADHOC if bound to the ADHOC location
      isAdhoc: shift.location?.code === "ADHOC",
    }));

    // ADHOC logic is based on a special Location with code "ADHOC"
    const adhocLocation = await prisma.location.findFirst({
      where: { code: "ADHOC" },
      select: { id: true },
    });

    if (adhocLocation) {
      // Count ADHOC shifts in last week
      adhocShiftCount = await prisma.shift.count({
        where: {
          locationId: adhocLocation.id,
          clockIn: {
            gte: oneWeekAgo,
          },
        },
      });

      // Group ADHOC shifts by user in last week
      const adhocGroups = await prisma.shift.groupBy({
        by: ["userId"],
        where: {
          locationId: adhocLocation.id,
          clockIn: {
            gte: oneWeekAgo,
          },
        },
        _count: {
          userId: true,
        },
        orderBy: {
          _count: {
            userId: "desc",
          },
        },
        take: 5,
      });

      const adhocUserIds = adhocGroups
        .map((g) => g.userId)
        .filter((id): id is string => !!id);

      let userNamesById: Record<string, string | null> = {};

      if (adhocUserIds.length > 0) {
        const users = await prisma.user.findMany({
          where: { id: { in: adhocUserIds } },
          select: { id: true, name: true },
        });

        for (const u of users) {
          userNamesById[u.id] = u.name;
        }
      }

      topAdhocUsers = adhocGroups
        .filter((g) => !!g.userId)
        .map((g) => ({
          userId: g.userId!,
          name: userNamesById[g.userId!] ?? null,
          adhocCount: g._count?.userId ?? 0,
        }));
    } else {
      adhocShiftCount = 0;
      topAdhocUsers = [];
    }
  } catch (err) {
    console.error("Error building admin dashboard:", err);
    // fall back to defaults – page still renders
  }

  return (
    <main className="flex-1">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Page header */}
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">
            Admin Dashboard
          </h1>
          <p className="text-sm text-gray-500">
            At-a-glance view of workforce activity, locations, and ADHOC usage.
          </p>
        </header>

        {/* Summary cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Employees */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col justify-between">
            <div className="text-xs font-medium uppercase text-gray-500 tracking-wide">
              Employees
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-2xl font-semibold text-gray-900">
                {activeEmployees}
              </div>
              <div className="text-xs text-gray-400">
                {totalEmployees} total
              </div>
            </div>
          </div>

          {/* Locations */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col justify-between">
            <div className="text-xs font-medium uppercase text-gray-500 tracking-wide">
              Locations
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-2xl font-semibold text-gray-900">
                {activeLocations}
              </div>
              <div className="text-xs text-gray-400">
                {totalLocations} total
              </div>
            </div>
          </div>

          {/* Shifts today */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col justify-between">
            <div className="text-xs font-medium uppercase text-gray-500 tracking-wide">
              Shifts Today
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-2xl font-semibold text-gray-900">
                {totalShiftsToday}
              </div>
              <div className="text-xs text-gray-400">
                Today&apos;s activity
              </div>
            </div>
          </div>

          {/* Hours this week / ADHOC */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col justify-between">
            <div className="text-xs font-medium uppercase text-gray-500 tracking-wide">
              Hours &amp; ADHOC
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-2xl font-semibold text-gray-900">
                {totalHoursThisWeek.toFixed
                  ? totalHoursThisWeek.toFixed(1)
                  : totalHoursThisWeek}
              </div>
              <div className="text-xs text-gray-400">
                hrs this week • {adhocShiftCount} ADHOC
              </div>
            </div>
          </div>
        </section>

        {/* Main content: Recent Shifts + Top ADHOC users */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Recent Shifts */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">
                Recent Shifts
              </h2>
              <span className="text-xs text-gray-500">
                Last {recentShifts.length || 0} records
              </span>
            </div>

            {recentShifts.length === 0 ? (
              <p className="text-sm text-gray-500">
                No recent shifts recorded yet.
              </p>
            ) : (
              <div className="-mx-3 -my-2 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Employee
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Location
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Clock In
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Clock Out
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Type
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentShifts.map((shift) => (
                      <tr
                        key={shift.id}
                        className="border-b border-gray-100 hover:bg-gray-50/70 transition-colors"
                      >
                        <td className="px-3 py-2 text-gray-900">
                          {shift.userName || "Unknown"}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {shift.locationName ? (
                            shift.locationName
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-[11px] font-medium text-yellow-800 border border-yellow-200">
                              ADHOC
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {formatDateTime(shift.clockIn)}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {formatDateTime(shift.clockOut)}
                        </td>
                        <td className="px-3 py-2">
                          {shift.isAdhoc ? (
                            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 border border-red-200">
                              ADHOC
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top ADHOC users */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">
                ADHOC Activity
              </h2>
              <span className="text-xs text-gray-500">
                Most ADHOC logins (last 7 days)
              </span>
            </div>

            {topAdhocUsers.length === 0 ? (
              <p className="text-sm text-gray-500">
                No ADHOC logins detected in the current period.
              </p>
            ) : (
              <ul className="space-y-2">
                {topAdhocUsers.map((u) => (
                  <li
                    key={u.userId}
                    className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {u.name || "Unknown employee"}
                      </span>
                      <span className="text-xs text-gray-500">
                        ADHOC clock-ins
                      </span>
                    </div>
                    <span className="inline-flex items-center justify-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 border border-red-200">
                      {u.adhocCount}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 text-[11px] text-gray-400">
              Use ADHOC counts as a quick compliance flag — investigate repeat
              off-site clock-ins when needed.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}