// app/admin/(protected)/page.tsx
import { prisma } from "@/lib/prisma";

function hoursBetween(clockIn: Date, clockOut: Date | null): number | null {
  if (!clockOut) return null;
  const ms = clockOut.getTime() - clockIn.getTime();
  if (ms <= 0) return null;
  return ms / (1000 * 60 * 60);
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const fourteenDaysAgo = new Date(
    now.getTime() - 14 * 24 * 60 * 60 * 1000
  );

  const [
    activeEmployees,
    activeLocations,
    recentShifts,
    shiftsLast14,
    adhocShiftsLast14,
  ] = await Promise.all([
    prisma.user.count({ where: { active: true } }),
    prisma.location.count({ where: { active: true } }),
    prisma.shift.findMany({
      orderBy: { clockIn: "desc" },
      include: {
        user: true,
        location: true,
      },
      take: 10,
    }),
    prisma.shift.findMany({
      where: {
        clockIn: { gte: fourteenDaysAgo },
      },
        select: {
          clockIn: true,
          clockOut: true,
        },
    }),
    // ADHOC definition: locationId is null
    prisma.shift.count({
      where: {
        clockIn: { gte: fourteenDaysAgo },
        locationId: null,
      },
    }),
  ]);

  let totalHoursLast14 = 0;
  for (const s of shiftsLast14) {
    const h = hoursBetween(s.clockIn, s.clockOut);
    if (h && h > 0) {
      totalHoursLast14 += h;
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">
              High-level overview of hours, locations, and ADHOC activity.
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Active Employees
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {activeEmployees}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Active Locations
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {activeLocations}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              ADHOC Shifts (Last 14 Days)
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {adhocShiftsLast14}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Shifts where GPS did not match any active location
              (locationId is null).
            </p>
          </div>
        </div>

        {/* Hours summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Total Hours (Last 14 Days)
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {totalHoursLast14.toFixed(1)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Based on completed shifts in the last 14 days.
            </p>
          </div>
        </div>

        {/* Recent Shifts */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Recent Shifts</h2>
          </div>

          {recentShifts.length === 0 ? (
            <p className="text-sm text-gray-500">No shifts recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-500">
                    <th className="text-left px-2 py-1">Employee</th>
                    <th className="text-left px-2 py-1">Location</th>
                    <th className="text-left px-2 py-1">Clock In</th>
                    <th className="text-left px-2 py-1">Clock Out</th>
                    <th className="text-left px-2 py-1">Hours</th>
                    <th className="text-left px-2 py-1">ADHOC</th>
                  </tr>
                </thead>
                <tbody>
                  {recentShifts.map((s) => {
                    const clockInStr = s.clockIn.toLocaleString();
                    const clockOutStr = s.clockOut
                      ? s.clockOut.toLocaleString()
                      : "—";

                    const hrs = hoursBetween(s.clockIn, s.clockOut);
                    const hoursStr =
                      hrs !== null ? hrs.toFixed(2) : "—";

                    // ADHOC = no linked location
                    const isAdhoc = !s.location;
                    const adhocLabel = isAdhoc ? "ADHOC" : "Standard";

                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="px-2 py-1">
                          {s.user?.name ??
                            s.user?.employeeCode ??
                            "Unknown"}
                        </td>
                        <td className="px-2 py-1">
                          {s.location
                            ? s.location.name
                            : isAdhoc
                            ? "ADHOC"
                            : "—"}
                        </td>
                        <td className="px-2 py-1">{clockInStr}</td>
                        <td className="px-2 py-1">{clockOutStr}</td>
                        <td className="px-2 py-1">{hoursStr}</td>
                        <td className="px-2 py-1">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              isAdhoc
                                ? "bg-red-100 text-red-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {adhocLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}