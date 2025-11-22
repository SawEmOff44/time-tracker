"use client";

import { useEffect, useMemo, useState } from "react";

type Role = "EMPLOYEE" | "ADMIN";

type User = {
  id: string;
  name: string;
  employeeCode: string | null;
  role: Role;
};

type Location = {
  id: string;
  name: string;
  code: string | null;
};

type Shift = {
  id: string;
  userId: string;
  locationId: string | null;
  clockIn: string; // ISO from API
  clockOut: string | null;
  clockInLat: number | null;
  clockInLng: number | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
  user: User | null;
  location: Location | null;
};

type AdhocAgg = {
  userId: string;
  name: string;
  employeeCode: string | null;
  count: number;
  lastAdhoc: Date | null;
};

export default function AdminDashboardPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadShifts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shifts");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to load shifts");
      }
      const json = (await res.json()) as Shift[];
      setShifts(json);
    } catch (err: any) {
      console.error("Error loading shifts:", err);
      setError(err.message || "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadShifts();
  }, []);

  // Time windows (computed fresh each render; good enough for a dashboard)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // --- Derived stats ---

  // Open shifts (no clockOut)
  const openShiftsCount = useMemo(
    () => shifts.filter((s) => !s.clockOut).length,
    [shifts]
  );

  // Total hours in last 7 days
  const totalHoursLast7Days = useMemo(() => {
    let totalMs = 0;
    for (const s of shifts) {
      if (!s.clockOut) continue;

      const ci = new Date(s.clockIn);
      const co = new Date(s.clockOut);

      if (ci >= sevenDaysAgo && ci <= now && co > ci) {
        totalMs += co.getTime() - ci.getTime();
      }
    }
    const hours = totalMs / (1000 * 60 * 60);
    return hours;
  }, [shifts, sevenDaysAgo, now]);

  // ADHOC stats (last 14 days)
  const adhocAggList: AdhocAgg[] = useMemo(() => {
    const map = new Map<string, AdhocAgg>();

    for (const s of shifts) {
      if (!s.location || s.location.code !== "ADHOC") continue;

      const ci = new Date(s.clockIn);
      if (ci < fourteenDaysAgo || ci > now) continue;

      const userId = s.userId;
      const existing = map.get(userId);
      if (!existing) {
        map.set(userId, {
          userId,
          name: s.user?.name || "Unknown",
          employeeCode: s.user?.employeeCode ?? null,
          count: 1,
          lastAdhoc: ci,
        });
      } else {
        existing.count += 1;
        if (!existing.lastAdhoc || ci > existing.lastAdhoc) {
          existing.lastAdhoc = ci;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const ad = a.lastAdhoc ? a.lastAdhoc.getTime() : 0;
      const bd = b.lastAdhoc ? b.lastAdhoc.getTime() : 0;
      return bd - ad;
    });
  }, [shifts, fourteenDaysAgo, now]);

  const totalAdhocShiftsLast14 = useMemo(
    () => adhocAggList.reduce((sum, a) => sum + a.count, 0),
    [adhocAggList]
  );

  const topAdhocList = useMemo(() => adhocAggList.slice(0, 5), [adhocAggList]);

  // Recent shifts (last 10 by clock-in time)
  const recentShifts = useMemo(() => {
    return [...shifts]
      .sort((a, b) => {
        const da = new Date(a.clockIn).getTime();
        const db = new Date(b.clockIn).getTime();
        return db - da;
      })
      .slice(0, 10);
  }, [shifts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-gray-600">
            Live view of shifts, hours, and ADHOC usage.
          </p>
        </div>
        <button
          onClick={() => void loadShifts()}
          disabled={loading}
          className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {/* Errors */}
      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Key Stats row */}
      <section className="grid gap-4 md:grid-cols-3">
        {/* Open shifts */}
        <div className="rounded border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-gray-500">
            Open Shifts
          </div>
          <div className="mt-2 text-3xl font-bold">{openShiftsCount}</div>
          <p className="mt-1 text-xs text-gray-500">
            Shifts currently in progress (no clock out yet).
          </p>
        </div>

        {/* Hours last 7 days */}
        <div className="rounded border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-gray-500">
            Hours (Last 7 Days)
          </div>
          <div className="mt-2 text-3xl font-bold">
            {totalHoursLast7Days.toFixed(1)}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Sum of completed shifts starting in the last 7 days.
          </p>
        </div>

        {/* ADHOC shifts */}
        <div className="rounded border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-gray-500">
            ADHOC Shifts (Last 14 Days)
          </div>
          <div className="mt-2 text-3xl font-bold">
            {totalAdhocShiftsLast14}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Total ADHOC clock-ins in the last 14 days across all employees.
          </p>
        </div>
      </section>

      {/* Top ADHOC Logins */}
      <section className="rounded border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Top ADHOC Logins (Last 14 Days)
          </h2>
          <span className="text-xs text-gray-500">
            Employees with frequent off-site or unassigned clock-ins.
          </span>
        </div>

        {topAdhocList.length === 0 ? (
          <div className="text-sm text-gray-500">
            No ADHOC shifts recorded in the last 14 days.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-semibold text-gray-700">
                  <th className="px-2 py-1">Employee</th>
                  <th className="px-2 py-1">ADHOC Shifts</th>
                  <th className="px-2 py-1">Last ADHOC</th>
                  <th className="px-2 py-1">Flag</th>
                </tr>
              </thead>
              <tbody>
                {topAdhocList.map((row) => {
                  const { userId, name, employeeCode, count, lastAdhoc } = row;
                  const flagHigh = count >= 3;

                  return (
                    <tr
                      key={userId}
                      className={`border-b last:border-0 ${
                        flagHigh ? "bg-red-50 text-red-800" : ""
                      }`}
                    >
                      <td className="px-2 py-1 text-sm">
                        {name}
                        {employeeCode && (
                          <span className="ml-1 text-xs text-gray-500">
                            ({employeeCode})
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-sm font-semibold">
                        {count}
                      </td>
                      <td className="px-2 py-1 text-xs">
                        {lastAdhoc ? lastAdhoc.toLocaleString() : "Unknown"}
                      </td>
                      <td className="px-2 py-1 text-xs">
                        {flagHigh ? (
                          <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                            HIGH ADHOC
                          </span>
                        ) : (
                          <span className="rounded bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-800">
                            ADHOC WATCH
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Shifts (with View in Map) */}
      <section className="rounded border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Shifts</h2>
          <span className="text-xs text-gray-500">
            Last 10 shifts by clock-in time.
          </span>
        </div>

        {recentShifts.length === 0 ? (
          <div className="text-sm text-gray-500">No shifts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-semibold text-gray-700">
                  <th className="px-2 py-1">Employee</th>
                  <th className="px-2 py-1">Location</th>
                  <th className="px-2 py-1">Clock In</th>
                  <th className="px-2 py-1">Clock Out</th>
                  <th className="px-2 py-1">Hours</th>
                  <th className="px-2 py-1">Map</th>
                </tr>
              </thead>
              <tbody>
                {recentShifts.map((s) => {
                  const ci = new Date(s.clockIn);
                  const co = s.clockOut ? new Date(s.clockOut) : null;
                  let hours: string | null = null;
                  if (co && co > ci) {
                    const diffMs = co.getTime() - ci.getTime();
                    hours = (diffMs / (1000 * 60 * 60)).toFixed(2);
                  }

                  const isAdhoc = s.location?.code === "ADHOC";

                  return (
                    <tr
                      key={s.id}
                      className={`border-b last:border-0 ${
                        isAdhoc ? "bg-yellow-50" : ""
                      }`}
                    >
                      <td className="px-2 py-1 text-sm">
                        {s.user?.name || "Unknown"}
                        {s.user?.employeeCode && (
                          <span className="ml-1 text-xs text-gray-500">
                            ({s.user.employeeCode})
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-sm">
                        {s.location?.name || "Unknown"}
                      </td>
                      <td className="px-2 py-1 text-xs">
                        {ci.toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-xs">
                        {co ? co.toLocaleString() : "—"}
                      </td>
                      <td className="px-2 py-1 text-xs">{hours ?? "—"}</td>
                      <td className="px-2 py-1 text-xs">
                        {s.clockInLat != null && s.clockInLng != null ? (
                          <a
                            href={`https://www.google.com/maps?q=${s.clockInLat},${s.clockInLng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            View in Map
                          </a>
                        ) : (
                          <span className="text-gray-400">No GPS</span>
                        )}
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
}