// app/admin/(protected)/page.tsx
export const dynamic = "force-dynamic";

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

type DashboardResponse = {
  totalEmployees?: number;
  activeEmployees?: number;
  totalLocations?: number;
  activeLocations?: number;
  totalShiftsToday?: number;
  totalHoursThisWeek?: number;
  adhocShiftCount?: number;
  recentShifts?: RecentShift[];
  topAdhocUsers?: TopAdhocUser[];
};

async function getDashboardData(): Promise<DashboardResponse> {
  const res = await fetch("/api/admin/dashboard", {
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("Failed to load dashboard:", res.status, await res.text());
    return {};
  }

  return (await res.json()) as DashboardResponse;
}

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
  const data = await getDashboardData();

  const totalEmployees = data.totalEmployees ?? 0;
  const activeEmployees = data.activeEmployees ?? 0;
  const totalLocations = data.totalLocations ?? 0;
  const activeLocations = data.activeLocations ?? 0;
  const totalShiftsToday = data.totalShiftsToday ?? 0;
  const totalHoursThisWeek = data.totalHoursThisWeek ?? 0;
  const adhocShiftCount = data.adhocShiftCount ?? 0;

  const recentShifts = data.recentShifts ?? [];
  const topAdhocUsers = data.topAdhocUsers ?? [];

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
                          {shift.locationName || (
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
                Most ADHOC logins
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