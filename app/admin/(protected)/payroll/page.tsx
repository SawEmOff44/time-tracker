// app/admin/(protected)/payroll/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";

type Shift = {
  id: string;
  userId: string;
  clockIn: string;
  clockOut: string | null;
  user?: {
    name: string;
    employeeCode: string | null;
  } | null;
};

type EmployeeSummary = {
  userId: string;
  name: string;
  employeeCode: string | null;
  hours: number;
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

export default function PayrollPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [summaries, setSummaries] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to current week on first load
  useEffect(() => {
    const today = new Date();
    const day = today.getDay(); // 0..6
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    setFrom(fmt(monday));
    setTo(fmt(today));
  }, []);

  async function loadShifts(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!from || !to) {
      setError("Please pick a From and To date.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/admin/shifts?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to load shifts");
      }

      const shifts: Shift[] = data;
      setShifts(shifts);

      const byEmployee = new Map<string, EmployeeSummary>();

      for (const s of shifts) {
        const hrs = hoursBetween(s.clockIn, s.clockOut);
        if (!byEmployee.has(s.userId)) {
          byEmployee.set(s.userId, {
            userId: s.userId,
            name: s.user?.name ?? "Unknown",
            employeeCode: s.user?.employeeCode ?? null,
            hours: 0,
          });
        }
        const sum = byEmployee.get(s.userId)!;
        sum.hours += hrs;
      }

      setSummaries(Array.from(byEmployee.values()));
    } catch (err: any) {
      setError(err.message || "Failed to load payroll data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (from && to) {
      void loadShifts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function handleExport() {
    if (!from || !to) return;
    const params = new URLSearchParams({ from, to });
    const url = `/api/export/shifts?${params.toString()}`;
    window.location.href = url;
  }

  // Total hours across all employees in the range
  const totalHours = summaries.reduce((acc, s) => acc + s.hours, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payroll / Shift Summary</h1>
          <p className="text-sm text-gray-600">
            Summarize hours by employee for a date range and export to CSV.
          </p>
        </div>
      </div>

      {/* Filters */}
      <form
        onSubmit={loadShifts}
        className="bg-white border rounded p-4 flex flex-col md:flex-row gap-4 items-start md:items-end"
      >
        <div>
          <label className="block text-xs font-semibold mb-1">From</label>
          <input
            type="date"
            className="border rounded px-2 py-1 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">To</label>
          <input
            type="date"
            className="border rounded px-2 py-1 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded bg-black text-white text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="px-4 py-2 rounded border border-gray-300 text-sm font-semibold hover:bg-gray-50"
        >
          Export CSV
        </button>
      </form>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Summary header bar */}
      <div className="bg-white border rounded px-4 py-2 text-sm flex flex-wrap gap-4 justify-between">
        <div>
          <span className="font-semibold">Employees in range:</span>{" "}
          {summaries.length}
        </div>
        <div>
          <span className="font-semibold">Total hours in range:</span>{" "}
          {totalHours.toFixed(2)}
        </div>
      </div>

      {/* Summary table */}
      <div className="bg-white border rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                Employee
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                Code
              </th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">
                Hours
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-4 text-center text-gray-400"
                >
                  Loading…
                </td>
              </tr>
            ) : summaries.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-4 text-center text-gray-400"
                >
                  No shifts found for this date range.
                </td>
              </tr>
            ) : (
              summaries.map((s) => (
                <tr key={s.userId} className="border-b last:border-b-0">
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2">
                    {s.employeeCode || (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {s.hours.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}