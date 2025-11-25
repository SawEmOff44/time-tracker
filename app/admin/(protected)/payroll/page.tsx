// app/admin/(protected)/payroll/page.tsx
"use client";

import { useEffect, useState } from "react";

type PayrollSummaryRow = {
  userId: string;
  name: string;
  employeeCode: string | null;
  totalHours: number;
  shiftCount: number;
};

type PayrollBreakdownRow = {
  userId: string;
  name: string;
  employeeCode: string | null;
  locationId: string | null;
  locationName: string | null;
  workDate: string; // YYYY-MM-DD
  hours: number;
};

type PayrollResponse = {
  summary: PayrollSummaryRow[];
  breakdown: PayrollBreakdownRow[];
  meta: {
    startDate: string; // Monday
    endDate: string; // Saturday
    payday: string; // following Friday
  };
};

// --- Date helpers for the UI (Mon–Sat periods) -----------------------------

// "YYYY-MM-DD" format
function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Parse "YYYY-MM-DD" as local date
function parseISOToLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  return new Date(y, m - 1, d);
}

// Get Mon–Sat period containing "today"
function getCurrentPayPeriod(today = new Date()) {
  const day = today.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const daysSinceMonday = (day - 1 + 7) % 7;

  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - daysSinceMonday
  );
  const end = new Date(start);
  end.setDate(end.getDate() + 5); // Monday + 5 = Saturday

  return {
    startDateStr: formatDateInput(start),
    endDateStr: formatDateInput(end),
  };
}

// Add days to an ISO date string, in local time
function addDaysISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return formatDateInput(dt);
}

// CSV export helper
function downloadCsv(
  summary: PayrollSummaryRow[],
  breakdown: PayrollBreakdownRow[],
  startDate: string,
  endDate: string
) {
  if (summary.length === 0 && breakdown.length === 0) return;

  const header = [
    "Employee",
    "Employee Code",
    "Location",
    "Work Date",
    "Hours",
    "Total Hours (Worker)",
    "Shift Count (Worker)",
    "Period Start (Mon)",
    "Period End (Sat)",
  ];

  const lines: string[] = [header.join(",")];

  // Make lookup for summary by userId
  const summaryMap = new Map<string, PayrollSummaryRow>();
  for (const row of summary) {
    summaryMap.set(row.userId, row);
  }

  // For each breakdown row, include summary info
  for (const row of breakdown) {
    const s = summaryMap.get(row.userId);
    const safeName = (row.name || "Unnamed worker").replace(/,/g, " ");
    const safeCode = (row.employeeCode ?? "").replace(/,/g, " ");
    const safeLoc = (row.locationName ?? "Unassigned").replace(/,/g, " ");

    const totalHours = s ? s.totalHours.toFixed(2) : "";
    const shiftCount = s ? s.shiftCount : "";

    lines.push(
      [
        `"${safeName}"`,
        `"${safeCode}"`,
        `"${safeLoc}"`,
        row.workDate,
        row.hours.toFixed(2),
        totalHours,
        shiftCount,
        startDate,
        endDate,
      ].join(",")
    );
  }

  const csvContent = lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll_${startDate}_to_${endDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPayrollPage() {
  const { startDateStr, endDateStr } = getCurrentPayPeriod();

  const [startDate, setStartDate] = useState(startDateStr);
  const [endDate, setEndDate] = useState(endDateStr);

  const [summary, setSummary] = useState<PayrollSummaryRow[]>([]);
  const [breakdown, setBreakdown] = useState<PayrollBreakdownRow[]>([]);
  const [metaPayday, setMetaPayday] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalHours, setTotalHours] = useState<number>(0);

  // Move by whole 7-day pay periods (Mon–Sat)
  function shiftPayPeriod(offsetWeeks: number) {
    const newStart = addDaysISO(startDate, offsetWeeks * 7);
    const newEnd = addDaysISO(newStart, 5); // Monday + 5 = Saturday
    setStartDate(newStart);
    setEndDate(newEnd);
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

      const data = (await res.json()) as PayrollResponse;

      setSummary(data.summary);
      setBreakdown(data.breakdown);
      setMetaPayday(data.meta?.payday ?? null);

      const sum = data.summary.reduce(
        (acc, row) =>
          acc + (typeof row.totalHours === "number" ? row.totalHours : 0),
        0
      );
      setTotalHours(Number(sum.toFixed(2)));
    } catch (err) {
      console.error(err);
      setError("Could not load payroll data for this period.");
      setSummary([]);
      setBreakdown([]);
      setTotalHours(0);
      setMetaPayday(null);
    } finally {
      setLoading(false);
    }
  }

  // Initial load
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

    return `${fmt(s)} – ${fmt(e)} (Mon–Sat)`;
  })();

  const paydayLabel = (() => {
    if (!metaPayday) return "";
    const d = parseISOToLocalDate(metaPayday);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  })();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Payroll</h1>
        <p className="mt-1 text-sm text-slate-400">
          Monday–Saturday pay period. Payday is the following Friday.
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
            {paydayLabel && (
              <p className="mt-1 text-xs text-amber-300">
                Payday: {paydayLabel}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Start (Monday)
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
                End (Saturday)
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
              onClick={() =>
                downloadCsv(summary, breakdown, startDate, endDate)
              }
              disabled={summary.length === 0 && breakdown.length === 0}
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
            {summary.length === 0
              ? "No hours recorded in this period."
              : `${summary.length} worker${
                  summary.length === 1 ? "" : "s"
                } with hours in this period.`}
          </p>
          <p className="text-xs font-semibold text-slate-100">
            Total hours this period:{" "}
            <span className="text-amber-300">{totalHours.toFixed(2)}h</span>
          </p>
        </div>
      </div>

      {/* Table 1: Summary by worker */}
      <div className="card bg-slate-900/80 border border-slate-700/80">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-slate-100">
            Hours by worker
          </h2>
          <p className="text-[11px] text-slate-400">
            Aggregated per worker for this pay period.
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
              {summary.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-slate-400"
                  >
                    No data for this period.
                  </td>
                </tr>
              )}

              {summary.map((row) => (
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
                    {row.shiftCount}
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

      {/* Table 2: Detailed breakdown by person / location / day */}
      <div className="card bg-slate-900/80 border border-slate-700/80">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-slate-100">
            Daily hours by job site
          </h2>
          <p className="text-[11px] text-slate-400">
            Broken down by worker, location, and calendar day.
          </p>
        </div>

        <div className="mt-2 overflow-x-auto">
          <table className="admin-table min-w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800/80">
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-slate-400"
                  >
                    No detailed records for this period.
                  </td>
                </tr>
              )}

              {breakdown.map((row, idx) => (
                <tr key={`${row.userId}-${row.locationId}-${row.workDate}-${idx}`} className="border-b border-slate-800/80">
                  <td className="px-3 py-2 align-middle">
                    <div className="text-sm text-slate-50">
                      {row.name || "Unnamed worker"}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle text-slate-200">
                    {row.employeeCode ?? "—"}
                  </td>
                  <td className="px-3 py-2 align-middle text-slate-200">
                    {row.locationName ?? "Unassigned"}
                  </td>
                  <td className="px-3 py-2 align-middle text-slate-300">
                    {parseISOToLocalDate(row.workDate).toLocaleDateString(
                      "en-US",
                      {
                        weekday: "short",
                        month: "2-digit",
                        day: "2-digit",
                        year: "numeric",
                      }
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle text-right text-slate-50">
                    {row.hours.toFixed(2)}h
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