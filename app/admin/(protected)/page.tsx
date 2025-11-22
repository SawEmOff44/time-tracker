// app/admin/(protected)/page.tsx
import { prisma } from "@/lib/prisma";

function getStartOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function getStartOfDaysAgo(days: number) {
  const now = new Date();
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - days,
    0,
    0,
    0,
    0
  );
  return d;
}

export default async function AdminDashboardPage() {
  // Basic stats
  const [employeeCount, locationCount] = await Promise.all([
    prisma.user.count({
      where: { active: true },
    }),
    prisma.location.count({
      where: { active: true },
    }),
  ]);

  const startOfToday = getStartOfToday();

  // Today's shifts for total hours + recent
  const todayShifts = await prisma.shift.findMany({
    where: {
      clockIn: {
        gte: startOfToday,
      },
    },
    orderBy: { clockIn: "desc" },
    include: {
      user: {
        select: { id: true, name: true, employeeCode: true },
      },
      location: {
        select: { id: true, name: true, code: true },
      },
    },
  });

  const totalHoursToday = todayShifts.reduce((sum, s) => {
    const start = s.clockIn;
    const end = s.clockOut ?? new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    return sum + (hours > 0 ? hours : 0);
  }, 0);

  const recentShifts = await prisma.shift.findMany({
    take: 10,
    orderBy: { clockIn: "desc" },
    include: {
      user: {
        select: { id: true, name: true, employeeCode: true },
      },
      location: {
        select: { id: true, name: true, code: true },
      },
    },
  });

  // ADHOC review (last 14 days)
  const adhocLocation = await prisma.location.findFirst({
    where: { code: "ADHOC" },
  });

  let adhocTotal = 0;
  let adhocByUser: {
    userId: string | null;
    name: string | null;
    employeeCode: string | null;
    count: number;
  }[] = [];

  if (adhocLocation) {
    const fourteenDaysAgo = getStartOfDaysAgo(14);

    const adhocShifts = await prisma.shift.findMany({
      where: {
        locationId: adhocLocation.id,
        clockIn: {
          gte: fourteenDaysAgo,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, employeeCode: true },
        },
      },
    });

    adhocTotal = adhocShifts.length;

    const map = new Map<
      string | null,
      { userId: string | null; name: string | null; employeeCode: string | null; count: number }
    >();

    for (const s of adhocShifts) {
      const key = s.user?.id ?? null;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          userId: s.user?.id ?? null,
          name: s.user?.name ?? null,
          employeeCode: s.user?.employeeCode ?? null,
          count: 1,
        });
      }
    }

    adhocByUser = Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="text-sm text-gray-600">
            Overview of today&apos;s activity and ADHOC clock-ins.
          </p>
        </div>
      </header>

      {/* Top stats row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-xs text-gray-500">Active Employees</div>
          <div className="text-2xl font-semibold mt-1">{employeeCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-xs text-gray-500">Active Locations</div>
          <div className="text-2xl font-semibold mt-1">{locationCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-xs text-gray-500">Total Hours Today</div>
          <div className="text-2xl font-semibold mt-1">
            {totalHoursToday.toFixed(2)}
          </div>
        </div>
      </section>

      {/* ADHOC + Recent Shifts */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ADHOC card */}
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-2">
          <h2 className="text-sm font-semibold">
            ADHOC Clock-ins (Last 14 Days)
          </h2>
          {adhocLocation ? (
            <>
              <div className="text-xs text-gray-600">
                Total ADHOC shifts:{" "}
                <span className="font-semibold">{adhocTotal}</span>
              </div>
              {adhocByUser.length === 0 ? (
                <div className="text-sm text-gray-600 mt-2">
                  No ADHOC shifts in the last 14 days.
                </div>
              ) : (
                <div className="mt-2">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b text-[11px] text-gray-600">
                        <th className="text-left py-1 pr-2">Employee</th>
                        <th className="text-right py-1 pl-2">ADHOC Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adhocByUser.map((u) => (
                        <tr key={u.userId ?? "unknown"} className="border-b last:border-0">
                          <td className="py-1 pr-2">
                            {u.name || "(unknown)"}{" "}
                            {u.employeeCode ? `(${u.employeeCode})` : ""}
                          </td>
                          <td className="py-1 pl-2 text-right font-semibold">
                            {u.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[11px] text-gray-500 mt-2">
                    Employees with frequent ADHOC clock-ins may warrant a quick
                    review in the Shifts view.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-600">
              No ADHOC location configured yet. Create a location with code{" "}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">
                ADHOC
              </code>{" "}
              to track out-of-bounds clock-ins.
            </div>
          )}
        </div>

        {/* Recent shifts */}
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-2">
          <h2 className="text-sm font-semibold">Recent Shifts</h2>
          {recentShifts.length === 0 ? (
            <div className="text-sm text-gray-600">No recent shifts.</div>
          ) : (
            <ul className="divide-y text-sm">
              {recentShifts.map((s) => {
                const isAdhoc = s.location?.code === "ADHOC";
                const clockIn = s.clockIn.toLocaleString();
                const clockOut = s.clockOut
                  ? s.clockOut.toLocaleString()
                  : "—";

                return (
                  <li key={s.id} className="py-2 flex items-start justify-between">
                    <div>
                      <div className="font-medium">
                        {s.user?.name || "(unknown)"}{" "}
                        {s.user?.employeeCode
                          ? `(${s.user.employeeCode})`
                          : ""}
                      </div>
                      <div className="text-xs text-gray-600">
                        {s.location
                          ? `${s.location.name} (${s.location.code})`
                          : "Unknown location"}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        In: {clockIn} | Out: {clockOut}
                      </div>
                    </div>
                    {isAdhoc && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold">
                        ADHOC
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}