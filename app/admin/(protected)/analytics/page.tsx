"use client";

import { useEffect, useMemo, useState } from "react";

type JobSiteRow = {
  locationId: string | null;
  locationName: string | null;
  totalHours: number;
  totalWages: number;
  shiftCount: number;
  workerCount: number;
};

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// same Mon–Sat pay period as payroll
function getCurrentPayPeriod(today = new Date()) {
  const day = today.getDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (day + 6) % 7;
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - daysSinceMonday
  );
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 5
  );
  return {
    startDateStr: formatDateInput(start),
    endDateStr: formatDateInput(end),
  };
}

export default function AdminAnalyticsPage() {
  const { startDateStr, endDateStr } = getCurrentPayPeriod();

  const [startDate, setStartDate] = useState(startDateStr);
  const [endDate, setEndDate] = useState(endDateStr);
  const [rows, setRows] = useState<JobSiteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalHours = useMemo(
    () =>
      rows.reduce((acc, r) => acc + (r.totalHours ?? 0), 0),
    [rows]
  );
  const totalWages = useMemo(
    () =>
      rows.reduce((acc, r) => acc + (r.totalWages ?? 0), 0),
    [rows]
  );

  function shiftPeriod(offsetWeeks: number) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    start.setDate(start.getDate() + offsetWeeks * 7);
    end.setDate(end.getDate() + offsetWeeks * 7);

    setStartDate(formatDateInput(start));
    setEndDate(formatDateInput(end));
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
      });

      const res = await fetch(
        `/api/admin/analytics/job-sites?${params.toString()}`
      );

      if (!res.ok) {
        throw new Error("Failed");
      }

      const data = (await res.json()) as JobSiteRow[];
      setRows(data);
    } catch (err) {
      console.error(err);
      setError("Could not load job-site analytics for this period.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const periodLabel = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
    return `${fmt(s)} – ${fmt(e)} (Mon–Sat)`;
  }, [startDate, endDate]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Analytics</h1>
        <p className="mt-1 text-sm text-slate-400">
          Job-site hours and labor cost for the selected pay period (Monday
          through Saturday).
        </p>
      </div>

      {/* Filters */}
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
              onClick={() => shiftPeriod(-1)}
              className="rounded-full border border-slate-700/70 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              ◀ Previous period
            </button>

            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              className="rounded-full border border-slate-700/70 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              Next period ▶
            </button>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
            >
              {loading ? "Loading…" : "Apply"}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-300">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
          <p className="text-xs text-slate-400">
            {rows.length === 0
              ? "No hours recorded in this period."
              : `${rows.length} job site${
                  rows.length === 1 ? "" : "s"
                } with hours in this period.`}
          </p>
          <p className="text-xs font-semibold text-slate-100 space-x-4">
            <span>
              Total hours:{" "}
              <span className="text-amber-300">
                {totalHours.toFixed(2)}h
              </span>
            </span>
            <span>
              Total labor cost:{" "}
              <span className="text-emerald-300">
                ${totalWages.toFixed(2)}
              </span>
            </span>
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="card bg-slate-900/80 border border-slate-700/80">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-slate-100">
            Job-site hours & labor cost
          </h2>
          <p className="text-[11px] text-slate-400">
            Based on all completed shifts within the selected dates.
          </p>
        </div>

        <div className="mt-2 overflow-x-auto">
          <table className="admin-table min-w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800/80">
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-right">Workers</th>
                <th className="px-3 py-2 text-right">Shifts</th>
                <th className="px-3 py-2 text-right">Total hours</th>
                <th className="px-3 py-2 text-right">Labor cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-slate-400"
                  >
                    No data for this period.
                  </td>
                </tr>
              )}

              {rows.map((row) => (
                <tr key={row.locationId ?? row.locationName ?? "adhoc"}>
                  <td className="px-3 py-2 align-middle text-slate-50">
                    {row.locationName ?? "ADHOC job site"}
                  </td>
                  <td className="px-3 py-2 align-middle text-right text-slate-100">
                    {row.workerCount}
                  </td>
                  <td className="px-3 py-2 align-middle text-right text-slate-100">
                    {row.shiftCount}
                  </td>
                  <td className="px-3 py-2 align-middle text-right text-amber-300">
                    {row.totalHours.toFixed(2)}h
                  </td>
                  <td className="px-3 py-2 align-middle text-right text-emerald-300">
                    ${row.totalWages.toFixed(2)}
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