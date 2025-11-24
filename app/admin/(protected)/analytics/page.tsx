// app/admin/(protected)/analytics/page.tsx
import { prisma } from "@/lib/prisma";

// Sunday–Saturday current week (local time)
function getCurrentWeekRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay(); // 0 = Sunday
  start.setDate(start.getDate() - day); // go back to Sunday

  const end = new Date(start);
  end.setDate(end.getDate() + 7); // next Sunday (exclusive)
  return { start, end };
}

// Current calendar month
function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

function diffHours(clockIn: Date | null, clockOut: Date | null): number {
  if (!clockIn || !clockOut) return 0;
  const startMs = new Date(clockIn).getTime();
  const endMs = new Date(clockOut).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return 0;
  const hours = (endMs - startMs) / (1000 * 60 * 60);
  return Number(hours.toFixed(2));
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function AnalyticsPage() {
  const { start: weekStart, end: weekEnd } = getCurrentWeekRange();
  const { start: monthStart, end: monthEnd } = getCurrentMonthRange();

  const [weeklyShifts, monthlyShifts] = await Promise.all([
    prisma.shift.findMany({
      where: {
        clockIn: { gte: weekStart },
        clockOut: { not: null, lt: weekEnd },
      },
      select: { clockIn: true, clockOut: true },
    }),
    prisma.shift.findMany({
      where: {
        clockIn: { gte: monthStart, lt: monthEnd },
        clockOut: { not: null },
      },
      include: {
        user: true,
        location: true,
      },
    }),
  ]);

  // ---- Weekly hours by day (Sun–Sat) ----
  const weeklyBuckets = DAY_LABELS.map((label) => ({
    label,
    hours: 0,
  }));

  for (const shift of weeklyShifts) {
    const hours = diffHours(shift.clockIn, shift.clockOut);
    if (hours <= 0) continue;
    const dayIndex = new Date(shift.clockIn).getDay(); // 0–6
    weeklyBuckets[dayIndex].hours += hours;
  }

  const totalHoursThisWeek = weeklyBuckets.reduce((sum, d) => sum + d.hours, 0);
  const maxDayHours = weeklyBuckets.reduce(
    (max, d) => (d.hours > max ? d.hours : max),
    0
  );
  const scaleMax = maxDayHours > 0 ? maxDayHours : 1; // avoid 0/0

  // ---- Monthly totals & ADHOC / locations / employees ----
  let totalHoursThisMonth = 0;
  let adhocShiftCount = 0;

  const locationTotals = new Map<
    string,
    { name: string; hours: number; shiftCount: number }
  >();

  const employeeTotals = new Map<
    string,
    { name: string; code: string | null; hours: number }
  >();

  for (const shift of monthlyShifts) {
    const hours = diffHours(shift.clockIn, shift.clockOut);
    if (hours <= 0) continue;

    totalHoursThisMonth += hours;

    // ADHOC = radiusMeters === 0
    if (shift.location && shift.location.radiusMeters === 0) {
      adhocShiftCount += 1;
    }

    // per-location totals
    if (shift.location) {
      const locKey = shift.location.id;
      const locExisting = locationTotals.get(locKey);
      if (locExisting) {
        locExisting.hours += hours;
        locExisting.shiftCount += 1;
      } else {
        locationTotals.set(locKey, {
          name: shift.location.name,
          hours,
          shiftCount: 1,
        });
      }
    }

    // per-employee totals
    if (shift.user) {
      const userKey = shift.user.id;
      const empExisting = employeeTotals.get(userKey);
      if (empExisting) {
        empExisting.hours += hours;
      } else {
        employeeTotals.set(userKey, {
          name: shift.user.name,
          code: shift.user.employeeCode,
          hours,
        });
      }
    }
  }

  const activeJobSitesThisMonth = locationTotals.size;

  const topEmployees = Array.from(employeeTotals.values())
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 3);

  const topLocations = Array.from(locationTotals.values())
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 3);

  return (
    <div className="space-y-8 text-slate-100">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Analytics</h1>
        <p className="mt-1 text-sm text-slate-400">
          Deeper insight into hours, job site usage, and ADHOC activity.
        </p>
      </div>

      {/* TOP SUMMARY CARDS */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Total hours this week
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">
            {totalHoursThisWeek.toFixed(2)}
          </div>
          <p className="mt-1 text-xs text-slate-500">Sunday–Saturday</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Total hours this month
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">
            {totalHoursThisMonth.toFixed(2)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            All completed shifts this month.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Active job sites (this month)
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">
            {activeJobSitesThisMonth}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Locations with at least one shift.
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-950/600/10 px-4 py-3 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-300">
            ADHOC shifts this month
          </div>
          <div className="mt-2 text-2xl font-semibold text-amber-100">
            {adhocShiftCount}
          </div>
          <p className="mt-1 text-xs text-amber-200">
            Clock-ins at zero-radius locations.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* WEEKLY BAR CHART */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-50">
                Weekly hours by day
              </h2>
              <p className="text-xs text-slate-400">
                Aggregate hours worked this week.
              </p>
            </div>
          </div>

          <div className="mt-6 flex h-40 items-end justify-between gap-3">
            {weeklyBuckets.map((day) => {
              const pct = (day.hours / scaleMax) * 100;
              return (
                <div
                  key={day.label}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div className="flex h-28 w-7 items-end rounded-full bg-slate-800 overflow-hidden">
                    {/* inner bar */}
                    <div
                      className="w-full rounded-full bg-amber-400 transition-all"
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] font-medium text-slate-300">
                    {day.hours.toFixed(2)}h
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    {day.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LOCATION UTILIZATION */}
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              Location utilization
            </h2>
            <p className="text-xs text-slate-400">
              Shift volume by job site this month.
            </p>
          </div>

          <div className="space-y-3">
            {topLocations.length === 0 && (
              <p className="text-xs text-slate-500">No shifts this month.</p>
            )}

            {topLocations.map((loc) => {
              const pct =
                totalHoursThisMonth > 0
                  ? (loc.hours / totalHoursThisMonth) * 100
                  : 0;
              return (
                <div key={loc.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-100">
                      {loc.name}
                    </span>
                    <span className="text-slate-400">
                      {loc.hours.toFixed(2)}h
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-sky-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: TOP EMPLOYEES + ADHOC NOTE */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-50">
              Top employees (this month)
            </h2>
            <p className="text-xs text-slate-400">
              Ranked by total hours on all job sites.
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {topEmployees.length === 0 && (
              <p className="text-xs text-slate-500">No shifts this month.</p>
            )}

            {topEmployees.map((emp, index) => (
              <div
                key={emp.name + (emp.code ?? "")}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-100">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-50">
                      {emp.name}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                      {emp.code ?? "No code"}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-100">
                  {emp.hours.toFixed(2)}h
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/40 bg-amber-950/600/10 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-amber-100">
            ADHOC trend (this month)
          </h2>
          <p className="mt-1 text-xs text-amber-200">
            Weekly count of ADHOC shifts (zero-radius locations). Use this to
            spot off-site / non-GPS usage patterns.
          </p>
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-950/600/10 px-3 py-2 text-xs text-amber-100">
            <div className="flex items-center justify-between">
              <span>This month</span>
              <span className="font-semibold">{adhocShiftCount} ADHOC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}