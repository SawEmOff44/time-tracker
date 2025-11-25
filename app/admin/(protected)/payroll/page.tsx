// app/admin/(protected)/payroll/page.tsx
"use client";

import { useEffect, useState } from "react";

// Shape of what /api/admin/payroll returns per employee
type PayrollRow = {
  userId: string;
  name: string;
  employeeCode: string | null;
  totalHours: number;
  shiftCount?: number | null;
};

// ---- Date helpers (UTC-safe, Friday–Thursday periods) ----------------------

// Turn a Date (assumed to be in UTC) into "YYYY-MM-DD"
function toISODateUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Add days to an ISO date string (YYYY-MM-DD) in UTC space
function addDaysISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toISODateUTC(dt);
}

/**
 * Returns the Friday–Thursday period that contains "today".
 * Friday is the START of the period, Thursday is the END.
 */
function getCurrentPayPeriod(today = new Date()) {
  // Work in UTC to avoid weird timezone shifts
  const utcToday = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const day = utcToday.getUTCDay(); // 0 = Sun … 5 = Fri, 6 = Sat

  // How many days since last Friday?
  // e.g. Fri(5) -> 0, Sat(6) -> 1, Sun(0) -> 2, Mon(1) -> 3, ..., Thu(4) -> 6
  const daysSinceFriday = (day - 5 + 7) % 7;

  const startUTC = new Date(utcToday);
  startUTC.setUTCDate(startUTC.getUTCDate() - daysSinceFriday);

  const endUTC = new Date(startUTC);
  endUTC.setUTCDate(endUTC.getUTCDate() + 6);

  return {
    startDateStr: toISODateUTC(startUTC),
    endDateStr: toISODateUTC(endUTC),
  };
}

// For the *labels* we just want local calendar dates, not UTC parsing
function parseISOToLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  return new Date(y, m - 1, d); // local midnight
}

export default function AdminPayrollPage() {
  const { startDateStr, endDateStr } = getCurrentPayPeriod();

  const [startDate, setStartDate] = useState(startDateStr);
  const [endDate, setEndDate] = useState(endDateStr);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalHours, setTotalHours] = useState<number>(0);

  // Move by whole pay periods (7 days).
  // IMPORTANT: always recompute end = start + 6 so we never drift.
  function shiftPayPeriod(offsetWeeks: number) {
    const newStartStr = addDaysISO(startDate, offsetWeeks * 7);
    const newEndStr = addDaysISO(newStartStr, 6);

    setStartDate(newStartStr);
    setEndDate(newEndStr);
  }

  async function loadPayroll() {
    if (!startDate || !endDate) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
      });

      const res = await fetch(`/api/admin/payroll?${params.toString()}`);

      if (!res.ok) {
        throw new Error("Failed to load payroll data");
      }

      const data = (await res.json()) as PayrollRow[];

      setRows(data);
      const sum = data.reduce(
        (acc, row) =>
          acc + (typeof row.totalHours === "number" ? row.totalHours : 0),
        0
      );
      setTotalHours(Number(sum.toFixed(2)));
    } catch (err) {
      console.error(err);
      setError("Could not load payroll data for this period.");
      setRows([]);
      setTotalHours(0);
    } finally {
      setLoading(false);
    }
  }

  // CSV export for whatever period is currently selected
  function downloadCsv() {
    if (rows.length === 0) return;

    const header = [
      "Employee",
      "Employee Code",
      "Shift Count",
      "Total Hours",
      "Period Start (Fri)",
      "Period End (Thu)",
    ];

    const lines = [
      header.join(","),
      ...rows.map((row) => {
        const safeName = (row.name || "Unnamed worker").replace(/,/g, " ");
        const safeCode = (row.employeeCode ?? "").replace(/,/g, " ");
        const shiftCount =
          typeof row.shiftCount === "number" ? row.shiftCount : "";
        const hours = row.totalHours.toFixed(2);

        return [
          `"${safeName}"`,
          `"${safeCode}"`,
          shiftCount,
          hours,
          startDate,
          endDate,
        ].join(",");
      }),
    ];

    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_${startDate}_to_${endDate}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  }

  // Initial load for the current pay period
  useEffect(() => {
    void loadPayroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const periodLabel = (() => {
    if (!startDate || !endDate) return "";
    const s = parseISOToLocalDate(startDate);
    const e = parseISOToLocalDate(endDate);

    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });

    return `${fmt(s)} – ${fmt(e)} (Fri–Thu)`;
  })();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Payroll</h1>
        <p className="mt-1 text-sm text-slate-400">
          Review total hours by worker for the selected pay period (Friday
          through Thursday).
        </p>
      </div>

      {/* Filters & actions */}
      <div className="card bg-slate-900/80 border border-slate-700/80">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Pay period
            </p>
            <p className="mt-1 text-sm text-slate-100">{periodLabel}</p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Start (Friday)
              </label>
              <input
                type="date"
                className="mt-1 w-40 bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                End (Thursday)
              </label>
              <input
                type="date"
                className="mt-1 w-40 bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <button
              type="button"
              onClick={() => shiftPayPeriod(-1)}
              className="rounded-full border border-slate-700/70 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              ◀ Previous period
            </button>

            <button
              type="button"
              onClick={() => shiftPayPeriod(1)}
              className="rounded-full border border-slate-700/70 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              Next period ▶
            </button>

            <button
              type="button"
              onClick={loadPayroll}
              disabled={loading}
              className="rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
            >
              {loading ? "Loading…" : "Apply"}
            </button>

            <button
              type="button"
              onClick={downloadCsv}
              disabled={rows.length === 0}
              className="rounded-full border border-amber-400/70 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/10 disabled:opacity-40"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="mt-3 text-xs text-red-300">
            {error}
          </p>
        )}

        {/* Summary */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
          <p className="text-xs text-slate-400">
            {rows.length === 0
              ? "No hours recorded in this period."
              : `${rows.length} worker${
                  rows.length === 1 ? "" : "s"
                } with hours in this period.`}
          </p>
          <p className="text-xs font-semibold text-slate-100">
            Total hours this period:{" "}
            <span className="text-amber-300">{totalHours.toFixed(2)}h</span>
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="card bg-slate-900/80 border border-slate-700/80">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-slate-100">
            Hours by worker
          </h2>
          <p className="text-[11px] text-slate-400">
            Based on all approved shifts within the selected dates.
          </p>
        </div>

        <div className="mt-2 overflow-x-auto">
          <table className="admin-table min-w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800/80">
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-right">Shift count</th>
                <th className="px-3 py-2 text-right">Total hours</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-slate-400"
                  >
                    No data for this period.
                  </td>
                </tr>
              )}

              {rows.map((row) => (
                <tr key={row.userId} className="border-b border-slate-800/80">
                  <td className="px-3 py-2 align-middle">
                    <div className="text-sm text-slate-50">
                      {row.name || "Unnamed worker"}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle text-slate-200">
                    {row.employeeCode ?? "—"}
                  </td>
                  <td className="px-3 py-2 align-middle text-right text-slate-200">
                    {typeof row.shiftCount === "number" ? row.shiftCount : "—"}
                  </td>
                  <td className="px-3 py-2 align-middle text-right text-slate-50">
                    {row.totalHours.toFixed(2)}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}