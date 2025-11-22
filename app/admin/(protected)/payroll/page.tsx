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
  clockIn: string;
  clockOut: string | null;
  user: User | null;
  location: Location | null;
};

type ApiError = string | null;

type EmployeeSummary = {
  userId: string;
  name: string;
  employeeCode: string | null;
  totalHours: number;
  shiftCount: number;
};

export default function PayrollPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError>(null);

  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

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
      console.error("Error loading payroll shifts:", err);
      setError(err.message || "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadShifts();
  }, []);

  // Default date range: last 14 days if user hasn't picked anything
  useEffect(() => {
    if (!fromDate && !toDate) {
      const now = new Date();
      const fourteenDaysAgo = new Date(
        now.getTime() - 14 * 24 * 60 * 60 * 1000
      );
      const pad = (n: number) => String(n).padStart(2, "0");
      const mkDate = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      setFromDate(mkDate(fourteenDaysAgo));
      setToDate(mkDate(now));
    }
  }, [fromDate, toDate]);

  const filteredShifts = useMemo(() => {
    if (!fromDate && !toDate) return shifts;

    return shifts.filter((s) => {
      if (!s.clockOut) return false; // only completed shifts count
      const ci = new Date(s.clockIn);

      if (fromDate) {
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);
        if (ci < from) return false;
      }

      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        if (ci > to) return false;
      }

      return true;
    });
  }, [shifts, fromDate, toDate]);

  const summaries: EmployeeSummary[] = useMemo(() => {
    const map = new Map<string, EmployeeSummary>();

    for (const s of filteredShifts) {
      if (!s.clockOut) continue;

      const ci = new Date(s.clockIn);
      const co = new Date(s.clockOut);
      if (co <= ci) continue;

      const diffHours =
        (co.getTime() - ci.getTime()) / (1000 * 60 * 60);

      const userId = s.userId;
      const existing = map.get(userId);
      if (!existing) {
        map.set(userId, {
          userId,
          name: s.user?.name || "Unknown",
          employeeCode: s.user?.employeeCode ?? null,
          totalHours: diffHours,
          shiftCount: 1,
        });
      } else {
        existing.totalHours += diffHours;
        existing.shiftCount += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [filteredShifts]);

  const grandTotalHours = useMemo(
    () => summaries.reduce((sum, s) => sum + s.totalHours, 0),
    [summaries]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payroll / Shift Summary</h1>
          <p className="text-sm text-gray-600">
            Hours per employee over a selected date range.
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

      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filters + summary card */}
      <section className="rounded border bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              From date
            </label>
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              To date
            </label>
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-2 rounded border bg-gray-50 p-3">
          <div className="text-xs font-semibold uppercase text-gray-600">
            Total Hours in Range
          </div>
          <div className="mt-1 text-2xl font-bold">
            {grandTotalHours.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Based on completed shifts with clock-in inside the selected range.
          </div>
        </div>
      </section>

      {/* Employee summaries */}
      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Hours by Employee</h2>

        {summaries.length === 0 ? (
          <div className="text-sm text-gray-500">
            No completed shifts in this range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-semibold text-gray-700">
                  <th className="px-2 py-1">Employee</th>
                  <th className="px-2 py-1">Shifts</th>
                  <th className="px-2 py-1">Total Hours</th>
                  <th className="px-2 py-1">Avg Hours / Shift</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => {
                  const avg =
                    s.shiftCount > 0
                      ? s.totalHours / s.shiftCount
                      : 0;
                  return (
                    <tr key={s.userId} className="border-b last:border-0">
                      <td className="px-2 py-1 text-sm">
                        {s.name}
                        {s.employeeCode && (
                          <span className="ml-1 text-xs text-gray-500">
                            ({s.employeeCode})
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-xs">{s.shiftCount}</td>
                      <td className="px-2 py-1 text-xs">
                        {s.totalHours.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 text-xs">
                        {avg.toFixed(2)}
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