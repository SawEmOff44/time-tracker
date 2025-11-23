// app/admin/(protected)/analytics/page.tsx
import { prisma } from "@/lib/prisma";
import { startOfWeek, addDays, startOfMonth } from "date-fns";

function getWeekRange() {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
  const end = addDays(start, 7);
  return { start, end };
}

function formatHoursNumber(hours: number) {
  return hours.toFixed(2);
}

export default async function AnalyticsPage() {
  const now = new Date();
  const { start: weekStart, end: weekEnd } = getWeekRange();
  const monthStart = startOfMonth(now);

  const [shiftsThisWeek, shiftsThisMonth] = await Promise.all([
    prisma.shift.findMany({
      where: {
        clockIn: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      include: {
        location: true,
      },
    }),
    prisma.shift.findMany({
      where: {
        clockIn: { gte: monthStart },
      },
      include: {
        location: true,
      },
    }),
  ]);

  // Weekly hours by day (Sun–Sat)
  const weeklyHours = Array(7).fill(0) as number[];

  for (const shift of shiftsThisWeek) {
    if (!shift.clockIn || !shift.clockOut) continue;
    const startMs = shift.clockIn.getTime();
    const endMs = shift.clockOut.getTime();
    if (endMs <= startMs) continue;
    const hours = (endMs - startMs) / (1000 * 60 * 60);
    const dayIndex = shift.clockIn.getDay(); // 0–6
    weeklyHours[dayIndex] += hours;
  }

  const maxHours = weeklyHours.reduce((m, h) => (h > m ? h : m), 0);

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Location utilization (this month)
  const locationCounts = new Map<
    string,
    { name: string; count: number }
  >();

  for (const shift of shiftsThisMonth) {
    const locationName = shift.location?.name ?? "Unknown";
    const key = shift.location?.id ?? `unknown-${locationName}`;
    const existing = locationCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      locationCounts.set(key, { name: locationName, count: 1 });
    }
  }

  const locationUsage = Array.from(locationCounts.values()).sort(
    (a, b) => b.count - a.count
  );

  const totalShiftsThisWeek = shiftsThisWeek.length;
  const totalHoursThisWeek = weeklyHours.reduce((sum, h) => sum + h, 0);

  // ADHOC = zero-radius locations
  const adhocShiftsThisMonth = shiftsThisMonth.filter(
    (s) => s.location && s.location.radiusMeters === 0
  );
  const totalAdhocThisMonth = adhocShiftsThisMonth.length;
  const totalShiftsThisMonth = shiftsThisMonth.length;

  const adhocRatio =
    totalShiftsThisMonth === 0
      ? 0
      : (totalAdhocThisMonth / totalShiftsThisMonth) * 100;

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-600">
          Deeper insight into weekly hours, job site usage, and ADHOC activity.
        </p>
      </div>

      {/* TOP CARDS */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <div className="card-label">Total hours this week</div>
          <div className="card-value">{formatHoursNumber(totalHoursThisWeek)}</div>
          <p className="card-sub">
            Sunday–Saturday, based on local (Central) time.
          </p>
        </div>

        <div className="card">
          <div className="card-label">Shifts this week</div>
          <div className="card-value">{totalShiftsThisWeek}</div>
          <p className="card-sub">
            All clock-ins between {weekStart.toLocaleDateString("en-US")} and{" "}
            {addDays(weekEnd, -1).toLocaleDateString("en-US")}.
          </p>
        </div>

        <div className="card card-amber">
          <div className="card-label text-amber-900">ADHOC shifts this month</div>
          <div className="card-value text-amber-950">
            {totalAdhocThisMonth}
          </div>
          <p className="card-sub text-amber-900/80">
            {totalShiftsThisMonth === 0
              ? "No shifts recorded yet this month."
              : `${totalAdhocThisMonth} of ${totalShiftsThisMonth} shifts (${adhocRatio.toFixed(
                  1
                )}%) at zero-radius locations.`}
          </p>
        </div>
      </div>

      {/* GRID: Weekly hours & Location usage */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Weekly hours by day */}
        <section className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Weekly hours by day
              </h2>
              <p className="text-xs text-slate-500">
                Aggregate hours worked this week.
              </p>
            </div>
          </div>

          <div className="mt-2 flex h-48 items-end gap-3">
            {weeklyHours.map((hours, idx) => {
              const pct = maxHours > 0 ? (hours / maxHours) * 100 : 0;
              return (
                <div
                  key={dayLabels[idx]}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div className="flex h-full w-full items-end">
                    <div className="relative flex-1 rounded-full bg-slate-100">
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-full bg-slate-900"
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-[11px] font-medium text-slate-600">
                    {dayLabels[idx]}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {hours === 0 ? "—" : `${hours.toFixed(2)}h`}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Location utilization */}
        <section className="card">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Location utilization
            </h2>
            <p className="text-xs text-slate-500">
              Shift volume by job site this month.
            </p>
          </div>

          {locationUsage.length === 0 && (
            <p className="text-xs text-slate-500">
              No shifts recorded yet this month.
            </p>
          )}

          <div className="space-y-2">
            {locationUsage.map((loc) => {
              const pct =
                totalShiftsThisMonth === 0
                  ? 0
                  : (loc.count / totalShiftsThisMonth) * 100;
              return (
                <div
                  key={loc.name}
                  className="space-y-1 rounded-lg border border-slate-100 bg-slate-50/60 p-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">
                      {loc.name}
                    </span>
                    <span className="text-slate-500">
                      {loc.count} shift{loc.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-slate-900"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ADHOC trend card */}
      <section className="card bg-amber-50/70 border-amber-200">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-amber-950">
              ADHOC trend (this month)
            </h2>
            <p className="text-xs text-amber-900/80">
              Quick view of how often ADHOC is used relative to all shifts.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-amber-900">
            <span>ADHOC share</span>
            <span>{adhocRatio.toFixed(1)}%</span>
          </div>
          <div className="h-2 rounded-full bg-amber-100">
            <div
              className="h-2 rounded-full bg-amber-500"
              style={{ width: `${adhocRatio}%` }}
            />
          </div>
          <p className="pt-1 text-[11px] leading-snug text-amber-900/90">
            Use this as a sanity check: a sudden spike in ADHOC percentage
            compared to your normal pattern probably deserves a closer look at
            the Shifts tab.
          </p>
        </div>
      </section>
    </div>
  );
}