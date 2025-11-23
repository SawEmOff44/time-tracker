// app/admin/(protected)/analytics/page.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek, startOfMonth } from "date-fns";

interface ShiftWithLocation {
  clockIn: Date | null;
  clockOut: Date | null;
  location: {
    id: string;
    name: string;
    radiusMeters: number | null;
  } | null;
}

function formatHours(clockIn: Date | null, clockOut: Date | null) {
  if (!clockIn || !clockOut) return 0;
  const startMs = clockIn.getTime();
  const endMs = clockOut.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return 0;
  const diffHours = (endMs - startMs) / (1000 * 60 * 60);
  return diffHours;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function AnalyticsPage() {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
  const monthStart = startOfMonth(now);

  // Pull shifts for this week and month, including locations
  const [shiftsThisWeekRaw, shiftsThisMonthRaw] = await Promise.all([
    prisma.shift.findMany({
      where: {
        clockIn: { gte: weekStart, lt: weekEnd },
      },
      include: {
        location: true,
      },
      orderBy: { clockIn: "asc" },
    }),
    prisma.shift.findMany({
      where: {
        clockIn: { gte: monthStart, lte: now },
      },
      include: {
        location: true,
      },
    }),
  ]);

  const shiftsThisWeek = shiftsThisWeekRaw as unknown as ShiftWithLocation[];
  const shiftsThisMonth = shiftsThisMonthRaw as unknown as ShiftWithLocation[];

  // ---- Top summary metrics ----
  // Total hours this week
  const totalHoursThisWeek = shiftsThisWeek.reduce((sum, shift) => {
    return sum + formatHours(shift.clockIn, shift.clockOut);
  }, 0);

  // Active job sites this month (locations with at least one shift)
  const activeLocationIds = new Set<string>();
  for (const s of shiftsThisMonth) {
    if (s.location && s.location.radiusMeters !== 0) {
      activeLocationIds.add(s.location.id);
    }
  }
  const activeJobSitesThisMonth = activeLocationIds.size;

  // ADHOC shifts this month (radiusMeters === 0)
  const adhocShiftsThisMonth = shiftsThisMonth.filter(
    (s) => s.location && s.location.radiusMeters === 0
  );
  const adhocShiftCountThisMonth = adhocShiftsThisMonth.length;

  // ---- Weekly hours by day (Sun–Sat) ----
  const weeklyHoursByDay = new Array<number>(7).fill(0);
  for (const shift of shiftsThisWeek) {
    if (!shift.clockIn || !shift.clockOut) continue;
    const dayIndex = shift.clockIn.getDay(); // 0–6
    weeklyHoursByDay[dayIndex] += formatHours(shift.clockIn, shift.clockOut);
  }

  const maxHoursInWeek = weeklyHoursByDay.reduce(
    (max, h) => (h > max ? h : max),
    0
  );

  // ---- Location utilization (month) ----
  type LocAgg = { name: string; count: number; isAdhoc: boolean };
  const locationMap = new Map<string, LocAgg>();

  for (const s of shiftsThisMonth) {
    if (!s.location) continue;
    const id = s.location.id;
    const existing = locationMap.get(id);
    if (existing) {
      existing.count += 1;
    } else {
      locationMap.set(id, {
        name: s.location.name,
        count: 1,
        isAdhoc: s.location.radiusMeters === 0,
      });
    }
  }

  const locationUtilization = Array.from(locationMap.values()).sort(
    (a, b) => b.count - a.count
  );

  // For the "ADHOC trend" card we’ll just show this week vs 0 baseline
  const adhocThisWeek = shiftsThisWeek.filter(
    (s) => s.location && s.location.radiusMeters === 0
  ).length;

  const formattedWeekRange = `${weekStart.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
  })} – ${weekEnd.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
  })}`;

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Deeper insight into hours, job site usage, and ADHOC activity.
        </p>
      </div>

      {/* TOP CARDS */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-xs font-medium text-gray-500">
            Total hours this week
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {totalHoursThisWeek.toFixed(2)}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Sunday–Saturday based on local time.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-xs font-medium text-gray-500">
            Active job sites (this month)
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {activeJobSitesThisMonth}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Locations with at least one shift this month.
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <div className="text-xs font-medium text-amber-700">
            ADHOC shifts this month
          </div>
          <div className="mt-2 text-2xl font-semibold text-amber-900">
            {adhocShiftCountThisMonth}
          </div>
          <p className="mt-1 text-xs text-amber-800">
            Clock-ins at zero-radius locations.
          </p>
        </div>
      </div>

      {/* MAIN GRID: weekly chart + location utilization + adhoc trend */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Weekly hours by day */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            Weekly hours by day
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Aggregate hours worked this week.
          </p>

          <div className="flex items-end gap-3 h-40">
            {weeklyHoursByDay.map((hours, idx) => {
              const normalized =
                maxHoursInWeek > 0 ? hours / maxHoursInWeek : 0;
              const barHeight = Math.max(normalized * 100, 4); // keep tiny bar visible

              return (
                <div
                  key={DAY_LABELS[idx]}
                  className="flex flex-1 flex-col items-center justify-end"
                >
                  <div
                    className="w-6 rounded-t-md bg-slate-800"
                    style={{ height: `${barHeight}%` }}
                  ></div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    {DAY_LABELS[idx]}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {hours.toFixed(2)}h
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Location utilization */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            Location utilization
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Shift volume by job site this month.
          </p>

          <div className="space-y-3">
            {locationUtilization.length === 0 && (
              <p className="text-xs text-gray-400">
                No shifts recorded for this month yet.
              </p>
            )}

            {locationUtilization.map((loc) => (
              <div key={loc.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={
                      loc.isAdhoc
                        ? "font-medium text-amber-800"
                        : "font-medium text-gray-900"
                    }
                  >
                    {loc.name}
                    {loc.isAdhoc && (
                      <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        ADHOC
                      </span>
                    )}
                  </span>
                  <span className="text-gray-500">
                    {loc.count} {loc.count === 1 ? "shift" : "shifts"}
                  </span>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={
                      "absolute inset-y-0 left-0 rounded-full " +
                      (loc.isAdhoc ? "bg-amber-400" : "bg-slate-800")
                    }
                    style={{
                      width: `${Math.min(
                        (loc.count /
                          (locationUtilization[0]?.count || 1)) *
                          100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ADHOC trend card */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-amber-900">
            ADHOC trend (this month)
          </h2>
          <span className="text-[11px] text-amber-800">
            Week of {formattedWeekRange}
          </span>
        </div>
        <p className="text-xs text-amber-800 mb-3">
          Weekly count of ADHOC shifts (zero-radius locations).
        </p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-amber-100">
          <div
            className="h-full rounded-full bg-amber-500"
            style={{
              width:
                adhocShiftCountThisMonth === 0
                  ? "0%"
                  : `${Math.min(
                      (adhocThisWeek / adhocShiftCountThisMonth) * 100,
                      100
                    )}%`,
            }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-amber-900">
          <span>{adhocThisWeek} ADHOC this week</span>
          <span>{adhocShiftCountThisMonth} this month</span>
        </div>
      </div>
    </div>
  );
}