import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function hoursBetween(clockIn: Date, clockOut: Date | null): number {
  if (!clockOut) return 0;
  const ms = clockOut.getTime() - clockIn.getTime();
  if (ms <= 0) return 0;
  return ms / (1000 * 60 * 60);
}

export default async function AdminDashboardPage() {
  // Basic counts
  const [employeeCount, locationCount, totalShiftCount] = await Promise.all([
    prisma.user.count({ where: { active: true, role: "WORKER" } }),
    prisma.location.count({ where: { active: true } }),
    prisma.shift.count(),
  ]);

  // Recent shifts with user + location
  const recentShifts = (await prisma.shift.findMany({
    orderBy: { clockIn: "desc" },
    take: 10,
    include: {
      user: true,
      location: true,
    },
  })) as any[]; // cast to any so we can safely use isAdhoc / adhocLocationName

  const totalHours = recentShifts.reduce((sum, s) => {
    return sum + hoursBetween(s.clockIn, s.clockOut ?? null);
  }, 0);

  // Simple ADHOC summary based on recent shifts only
  const adhocCounts = new Map<string, { userName: string; count: number }>();

  for (const s of recentShifts) {
    if (!s.isAdhoc || !s.user) continue;
    const id = s.user.id as string;
    const current =
      adhocCounts.get(id) ?? { userName: s.user.name ?? "Unknown", count: 0 };
    current.count += 1;
    adhocCounts.set(id, current);
  }

  const topAdhoc = Array.from(adhocCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Overview of time tracking activity.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase text-gray-500">
            Active employees
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {employeeCount}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase text-gray-500">
            Active locations
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {locationCount}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase text-gray-500">
            Total shifts
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {totalShiftCount}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase text-gray-500">
            Hours in last 10 shifts
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {totalHours.toFixed(1)}
          </div>
        </div>
      </div>

      {/* ADHOC summary + notes */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-semibold text-gray-900">
            ADHOC activity (recent)
          </div>
          {topAdhoc.length === 0 ? (
            <p className="text-xs text-gray-500">
              No ADHOC shifts in the last 10 records.
            </p>
          ) : (
            <ul className="space-y-1 text-xs text-gray-700">
              {topAdhoc.map((item) => (
                <li
                  key={item.userName}
                  className="flex items-center justify-between"
                >
                  <span>{item.userName}</span>
                  <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-[11px] font-medium text-yellow-800">
                    {item.count} ADHOC shifts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-semibold text-gray-900">Notes</div>
          <p className="text-xs text-gray-500">
            Use the tabs above to manage employees, locations, shifts, and
            payroll exports.
          </p>
        </div>
      </div>

      {/* Recent shifts table */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Recent shifts
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-left">Clock in</th>
                <th className="px-3 py-2 text-left">Clock out</th>
                <th className="px-3 py-2 text-right">Hours</th>
                <th className="px-3 py-2 text-center">ADHOC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentShifts.map((s) => {
                const label =
                  s.location?.name ??
                  s.adhocLocationName ??
                  (s.isAdhoc ? "Adhoc Job Site" : "—");
                const hrs = hoursBetween(
                  s.clockIn as Date,
                  (s.clockOut ?? null) as Date | null
                );

                return (
                  <tr key={s.id}>
                    <td className="px-3 py-2">
                      <div className="text-gray-900">
                        {s.user?.name ?? "—"}
                      </div>
                      {s.user?.employeeCode && (
                        <div className="text-xs text-gray-500">
                          {s.user.employeeCode}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{label}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {new Date(s.clockIn).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {s.clockOut
                        ? new Date(s.clockOut).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900">
                      {hrs ? hrs.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {s.isAdhoc ? (
                        <span className="inline-flex rounded-full bg-yellow-50 px-2 py-0.5 text-[11px] font-medium text-yellow-800">
                          ADHOC
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {recentShifts.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-4 text-center text-sm text-gray-500"
                  >
                    No shifts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}