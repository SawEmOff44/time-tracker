// app/admin/(protected)/payroll/page.tsx
"use client";

import { useEffect, useState } from "react";

type PayrollRow = {
  userId: string;
  userName: string;
  employeeCode: string | null;
  locationId: string | null;
  locationName: string;
  date: string; // YYYY-MM-DD
  totalHours: number;
  hourlyRate: number | null;
  laborCost: number | null;
};

type PayrollResponse = {
  start: string;
  end: string;
  count: number;
  totalHours: number;
  totalCost: number;
  rows: PayrollRow[];
};

function getDefaultRange() {
  const today = new Date();
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);

  const start = new Date(end.getTime() - 13 * 24 * 60 * 60 * 1000);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;

  return { start: fmt(start), end: fmt(end) };
}

export default function AdminPayrollPage() {
  const defaultRange = getDefaultRange();

  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PayrollResponse | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);

      const res = await fetch(`/api/admin/payroll?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "Failed to load payroll data.");
      }

      const json = (await res.json()) as PayrollResponse;
      setData(json);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to load payroll data.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = data?.rows ?? [];

  // CSV Export handler
  function handleExportCsv() {
    if (!data || !data.rows || data.rows.length === 0) {
      if (typeof window !== "undefined") {
        window.alert("No payroll data to export for this range.");
      }
      return;
    }

    const header = [
      "Date",
      "Location",
      "Employee",
      "Employee Code",
      "Total Hours",
      "Hourly Rate",
      "Labor Cost",
    ];

    const lines: string[] = [];
    lines.push(header.join(","));

    for (const row of data.rows) {
      const values = [
        row.date,
        row.locationName,
        row.userName,
        row.employeeCode ?? "",
        row.totalHours.toFixed(2),
        row.hourlyRate != null ? row.hourlyRate.toFixed(2) : "",
        row.laborCost != null ? row.laborCost.toFixed(2) : "",
      ];

      const escaped = values.map((v) => {
        const needsQuotes = v.includes(",") || v.includes("\"") || v.includes("\n");
        const safe = v.replace(/\"/g, '""');
        return needsQuotes ? `"${safe}"` : safe;
      });

      lines.push(escaped.join(","));
    }

    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const filename = `payroll_${startDate}_to_${endDate}.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Group rows by location name
  const groupedByLocation: Record<string, PayrollRow[]> = {};
  for (const row of rows) {
    const key = row.locationName;
    if (!groupedByLocation[key]) groupedByLocation[key] = [];
    groupedByLocation[key].push(row);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Payroll</h1>
          <p className="mt-1 text-sm text-slate-400">
            Hours and labor cost by employee, location, and day. Use this to
            see how many man-hours are going into each job site.
          </p>
        </div>

        {/* Range picker */}
        <form
          className="flex flex-wrap gap-3 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-1">
              Start date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-1">
              End date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-9 rounded-full bg-amber-400 px-4 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || !data || !data.rows || data.rows.length === 0}
            className="h-9 rounded-full border border-slate-600 px-4 text-xs font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-60"
          >
            Export CSV
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Summary */}
      {data && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Range
            </div>
            <div className="mt-1 text-sm text-slate-100">
              {startDate} → {endDate}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Total rows
            </div>
            <div className="mt-1 text-xl font-semibold text-slate-50">
              {data.count}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Total hours
            </div>
            <div className="mt-1 text-xl font-semibold text-amber-300">
              {data.totalHours.toFixed(2)}h
            </div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Total labor cost
            </div>
            <div className="mt-1 text-xl font-semibold text-emerald-300">
              ${data.totalCost.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Tables grouped by location */}
      <div className="space-y-8">
        {Object.keys(groupedByLocation).length === 0 &&
          !loading &&
          !error && (
            <p className="text-sm text-slate-400">
              No payroll data in range.
            </p>
          )}

        {Object.entries(groupedByLocation).map(([locationName, locRows]) => (
          <section key={locationName} className="card bg-slate-900/80">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold text-slate-100">
                {locationName}
              </h2>
              <div className="text-[11px] text-slate-400">
                {locRows.length} rows •{" "}
                {locRows
                  .reduce((sum, r) => sum + r.totalHours, 0)
                  .toFixed(2)}
                h • $
                {locRows
                  .reduce((sum, r) => sum + (r.laborCost ?? 0), 0)
                  .toFixed(2)}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="admin-table min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-900/60">
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Employee</th>
                    <th className="px-3 py-2 text-left">Code</th>
                    <th className="px-3 py-2 text-right">Hours</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {locRows.map((row, idx) => (
                    <tr key={`${row.userId}-${row.date}-${idx}`}>
                      <td className="px-3 py-2 align-middle text-slate-200">
                        {row.date}
                      </td>
                      <td className="px-3 py-2 align-middle text-slate-200">
                        {row.userName}
                      </td>
                      <td className="px-3 py-2 align-middle text-slate-400">
                        {row.employeeCode ?? "—"}
                      </td>
                      <td className="px-3 py-2 align-middle text-right text-slate-50">
                        {row.totalHours.toFixed(2)}h
                      </td>
                      <td className="px-3 py-2 align-middle text-right text-slate-200">
                        {row.hourlyRate != null
                          ? `$${row.hourlyRate.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 align-middle text-right text-emerald-300">
                        {row.laborCost != null
                          ? `$${row.laborCost.toFixed(2)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}