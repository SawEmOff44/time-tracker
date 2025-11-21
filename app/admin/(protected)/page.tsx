// app/admin/(protected)/page.tsx
"use client";

import { useEffect, useState } from "react";

type RecentShift = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  user?: {
    id: string;
    name: string;
    employeeCode: string | null;
  } | null;
  location?: {
    id: string;
    name: string;
    code: string;
  } | null;
};

type AdminStats = {
  totalEmployees: number;
  activeEmployees: number;
  totalLocations: number;
  activeLocations: number;
  openShifts: number;
  todaysShifts: number;
  recentShifts: RecentShift[];
};

function hoursBetween(startISO: string, endISO: string | null): number {
  if (!endISO) return 0;
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return ms / (1000 * 60 * 60);
}

function formatHoursDisplay(startISO: string, endISO: string | null): string {
  const hrs = hoursBetween(startISO, endISO);
  if (hrs <= 0) return "—";
  return hrs.toFixed(2);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStats() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/stats");
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to load stats");
      }

      setStats(data);
    } catch (err: any) {
      setError(err.message || "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStats();
  }, []);

  // Compute total hours in the recent shifts list
  const totalRecentHours =
    stats?.recentShifts?.reduce((acc, s) => {
      return acc + hoursBetween(s.clockIn, s.clockOut);
    }, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-gray-600">
            Overview of employees, locations, and recent shifts.
          </p>
        </div>
        <button
          type="button"
          onClick={loadStats}
          disabled={loading}
          className="px-4 py-2 rounded bg-black text-white text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Stat cards in a single row (responsive) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Total Employees"
          value={stats?.totalEmployees ?? 0}
        />
        <StatCard
          label="Active Employees"
          value={stats?.activeEmployees ?? 0}
        />
        <StatCard
          label="Total Locations"
          value={stats?.totalLocations ?? 0}
        />
        <StatCard
          label="Active Locations"
          value={stats?.activeLocations ?? 0}
        />
        <StatCard
          label="Open Shifts"
          value={stats?.openShifts ?? 0}
        />
        <StatCard
          label="Today's Shifts"
          value={stats?.todaysShifts ?? 0}
        />
      </div>

      {/* Extra overview row (total hours in recent shifts) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Hours in Recent Shifts"
          value={Number.isFinite(totalRecentHours) ? totalRecentHours : 0}
          valueFormatter={(v) => v.toFixed(2)}
        />
      </div>

      {/* Recent Shifts - full width */}
      <div className="bg-white border rounded overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm">Recent Shifts</h2>
          <span className="text-xs text-gray-500">
            {stats?.recentShifts?.length ?? 0} entries
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">
                  Employee
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">
                  Location
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">
                  Clock In
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">
                  Clock Out
                </th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">
                  Hours
                </th>
              </tr>
            </thead>
            <tbody>
              {!stats || stats.recentShifts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-4 text-center text-gray-400"
                  >
                    No recent shifts found.
                  </td>
                </tr>
              ) : (
                stats.recentShifts.map((shift) => (
                  <tr
                    key={shift.id}
                    className="border-b last:border-b-0"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {shift.user?.name || "Unknown"}
                      </div>
                      {shift.user?.employeeCode && (
                        <div className="text-[0.7rem] text-gray-500">
                          {shift.user.employeeCode}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div>
                        {shift.location?.name || (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                      {shift.location?.code && (
                        <div className="text-[0.7rem] text-gray-500">
                          {shift.location.code}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {formatDateTime(shift.clockIn)}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {formatDateTime(shift.clockOut)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatHoursDisplay(shift.clockIn, shift.clockOut)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueFormatter,
}: {
  label: string;
  value: number;
  valueFormatter?: (v: number) => string;
}) {
  const display = valueFormatter ? valueFormatter(value) : String(value);
  return (
    <div className="bg-white border rounded p-4">
      <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-2xl font-semibold">{display}</div>
    </div>
  );
}