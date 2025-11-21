// app/admin/(protected)/page.tsx
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

type ShiftWithRelations = {
  id: string;
  clockIn: Date;
  clockOut: Date | null;
  user: {
    id: string;
    name: string;
    employeeCode: string | null;
  };
  location: {
    id: string;
    name: string;
    code: string;
  } | null;
};

function startOfWeekMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0 (Sun) - 6 (Sat)
  const diff = (day + 6) % 7; // days since Monday
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - diff);
  return date;
}

function startOfDay(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function hoursBetween(clockIn: Date, clockOut: Date | null): number {
  if (!clockOut) return 0;
  const ms = clockOut.getTime() - clockIn.getTime();
  if (ms <= 0) return 0;
  return ms / (1000 * 60 * 60);
}

function formatHours(h: number) {
  return h.toFixed(2);
}

function formatDateTime(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const weekStart = startOfWeekMonday(now);
  const todayStart = startOfDay(now);

  // 1) All shifts this week (for summary + recent list)
  const weekShifts = (await prisma.shift.findMany({
    where: {
      clockIn: { gte: weekStart },
    },
    include: {
      user: true,
      location: true,
    },
    orderBy: { clockIn: "desc" },
  })) as ShiftWithRelations[];

  // 2) Currently clocked in (clockOut is null)
  const activeShifts = (await prisma.shift.findMany({
    where: {
      clockOut: null,
    },
    include: {
      user: true,
      location: true,
    },
    orderBy: { clockIn: "asc" },
  })) as ShiftWithRelations[];

  // 3) Recent activity (last 10 shifts regardless of week)
  const recentShifts = (await prisma.shift.findMany({
    include: {
      user: true,
      location: true,
    },
    orderBy: { clockIn: "desc" },
    take: 10,
  })) as ShiftWithRelations[];

  // Derived summary stats (for this week)
  let totalHoursWeek = 0;
  const employeeIds = new Set<string>();

  for (const shift of weekShifts) {
    totalHoursWeek += hoursBetween(shift.clockIn, shift.clockOut);
    if (shift.user?.id) {
      employeeIds.add(shift.user.id);
    }
  }

  const totalShiftsWeek = weekShifts.length;
  const uniqueEmployeesWeek = employeeIds.size;

  // How many shifts started today
  const todaysShifts = weekShifts.filter(
    (s) => s.clockIn >= todayStart && s.clockIn <= now
  ).length;

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-gray-600">
            High-level view of hours, who&apos;s on the clock, and recent
            activity.
          </p>
        </div>
      </header>

      {/* Top summary cards */}
      <section className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <div className="bg-white shadow rounded-lg p-4 space-y-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Hours This Week
          </div>
          <div className="text-2xl font-bold">
            {formatHours(totalHoursWeek)}{" "}
            <span className="text-sm font-normal text-gray-500">hrs</span>
          </div>
          <div className="text-xs text-gray-500">
            {totalShiftsWeek} shifts • {uniqueEmployeesWeek} employees
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4 space-y-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Currently Clocked In
          </div>
          <div className="text-2xl font-bold">{activeShifts.length}</div>
          <div className="text-xs text-gray-500">
            Live count across all active locations
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4 space-y-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Shifts Started Today
          </div>
          <div className="text-2xl font-bold">{todaysShifts}</div>
          <div className="text-xs text-gray-500">
            Since midnight local time ({todayStart.toLocaleDateString()})
          </div>
        </div>
      </section>

      {/* Active shifts */}
      <section className="bg-white shadow rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">On the Clock Now</h2>
          <div className="text-xs text-gray-500">
            {activeShifts.length === 0
              ? "No one is currently clocked in."
              : "Live from the last clock-ins."}
          </div>
        </div>

        {activeShifts.length === 0 ? (
          <div className="text-sm text-gray-500">
            All employees are clocked out.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 pr-2">Employee</th>
                  <th className="text-left py-1 pr-2">Code</th>
                  <th className="text-left py-1 pr-2">Location</th>
                  <th className="text-left py-1 pr-2">Clocked In</th>
                  <th className="text-left py-1 pr-2">Hours So Far</th>
                </tr>
              </thead>
              <tbody>
                {activeShifts.map((shift) => {
                  const hoursSoFar = hoursBetween(shift.clockIn, new Date());
                  return (
                    <tr key={shift.id} className="border-b">
                      <td className="py-1 pr-2">
                        {shift.user?.name || "Unknown"}
                      </td>
                      <td className="py-1 pr-2">
                        {shift.user?.employeeCode || "—"}
                      </td>
                      <td className="py-1 pr-2">
                        {shift.location?.name || "Unknown"}
                      </td>
                      <td className="py-1 pr-2">
                        {formatDateTime(shift.clockIn)}
                      </td>
                      <td className="py-1 pr-2">
                        {formatHours(hoursSoFar)} hrs
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent shifts */}
      <section className="bg-white shadow rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Shifts</h2>
          <div className="text-xs text-gray-500">
            Last {recentShifts.length} shifts (any location)
          </div>
        </div>

        {recentShifts.length === 0 ? (
          <div className="text-sm text-gray-500">No shifts recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 pr-2">Employee</th>
                  <th className="text-left py-1 pr-2">Code</th>
                  <th className="text-left py-1 pr-2">Location</th>
                  <th className="text-left py-1 pr-2">Clock In</th>
                  <th className="text-left py-1 pr-2">Clock Out</th>
                  <th className="text-left py-1 pr-2">Hours</th>
                </tr>
              </thead>
              <tbody>
                {recentShifts.map((shift) => {
                  const duration = hoursBetween(
                    shift.clockIn,
                    shift.clockOut
                  );
                  return (
                    <tr key={shift.id} className="border-b">
                      <td className="py-1 pr-2">
                        {shift.user?.name || "Unknown"}
                      </td>
                      <td className="py-1 pr-2">
                        {shift.user?.employeeCode || "—"}
                      </td>
                      <td className="py-1 pr-2">
                        {shift.location?.name || "Unknown"}
                      </td>
                      <td className="py-1 pr-2">
                        {formatDateTime(shift.clockIn)}
                      </td>
                      <td className="py-1 pr-2">
                        {formatDateTime(shift.clockOut)}
                      </td>
                      <td className="py-1 pr-2">
                        {shift.clockOut ? `${formatHours(duration)} hrs` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}