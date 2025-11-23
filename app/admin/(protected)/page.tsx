// app/admin/(protected)/page.tsx
import { prisma } from "@/lib/prisma";

function hoursBetween(clockIn: Date, clockOut: Date | null): number {
  const end = clockOut ?? new Date();
  const diffMs = end.getTime() - clockIn.getTime();
  if (diffMs <= 0) return 0;
  return diffMs / (1000 * 60 * 60);
}

export default async function AdminDashboardPage() {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalEmployees,
      activeEmployees,
      totalLocations,
      activeLocations,
      totalShiftsLast7,
      shiftsLast7,
      recentShifts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.location.count(),
      prisma.location.count({ where: { active: true } }),
      prisma.shift.count({
        where: {
          clockIn: { gte: sevenDaysAgo },
        },
      }),
      prisma.shift.findMany({
        where: {
          clockIn: { gte: sevenDaysAgo },
        },
        select: {
          clockIn: true,
          clockOut: true,
        },
      }),
      prisma.shift.findMany({
        orderBy: {
          clockIn: "desc",
        },
        take: 10,
        include: {
          user: true,
          location: true,
        },
      }),
    ]);

    const totalHoursLast7 = shiftsLast7
      .map((s) => hoursBetween(s.clockIn, s.clockOut))
      .reduce((acc, h) => acc + h, 0);

    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Overview of workforce time tracking and activity.
            </p>
          </div>
        </div>

        {/* Metric cards */}
        <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">
              Active Employees
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-2xl font-semibold">{activeEmployees}</div>
              <div className="text-xs text-gray-500">
                {totalEmployees} total employees
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">
              Active Locations
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-2xl font-semibold">{activeLocations}</div>
              <div className="text-xs text-gray-500">
                {totalLocations} total locations
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">
              Shifts (last 7 days)
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-2xl font-semibold">{totalShiftsLast7}</div>
              <div className="text-xs text-gray-500">clocked shifts</div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">
              Hours (last 7 days)
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-2xl font-semibold">
                {totalHoursLast7.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500">approximate hours</div>
            </div>
          </div>
        </section>

        {/* Recent shifts */}
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-3">Recent Shifts</h2>
          {recentShifts.length === 0 ? (
            <p className="text-xs text-gray-500">No shifts recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="text-left py-1 pr-4 font-medium">
                      Employee
                    </th>
                    <th className="text-left py-1 pr-4 font-medium">
                      Location
                    </th>
                    <th className="text-left py-1 pr-4 font-medium">
                      Clock In
                    </th>
                    <th className="text-left py-1 pr-4 font-medium">
                      Clock Out
                    </th>
                    <th className="text-right py-1 font-medium">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {recentShifts.map((s) => {
                    const clockIn = new Date(s.clockIn);
                    const clockOut = s.clockOut ? new Date(s.clockOut) : null;
                    const hours = hoursBetween(clockIn, clockOut);

                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-1 pr-4">
                          {s.user?.name ||
                            s.user?.employeeCode ||
                            "Unknown"}
                        </td>
                        <td className="py-1 pr-4">
                          {s.location?.name || "ADHOC / Unknown"}
                        </td>
                        <td className="py-1 pr-4">
                          {clockIn.toLocaleString()}
                        </td>
                        <td className="py-1 pr-4">
                          {clockOut ? clockOut.toLocaleString() : "—"}
                        </td>
                        <td className="py-1 text-right">
                          {hours.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  } catch (err) {
    console.error("Error rendering admin dashboard:", err);
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Admin Dashboard
        </h1>
        <p className="text-sm text-red-600">
          There was an error loading dashboard data. Other admin pages should
          still work (Employees, Locations, Shifts, Payroll).
        </p>
      </div>
    );
  }
}