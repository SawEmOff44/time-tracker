"use client";

import { useEffect, useMemo, useState } from "react";

type PayrollLocationBreakdown = {
  locationId: string | null;
  locationName: string | null;
  totalHours: number;
  totalWages: number;
};

type PayrollDayBreakdown = {
  date: string; // YYYY-MM-DD
  weekday: string;
  totalHours: number;
  totalWages: number;
  perLocation: PayrollLocationBreakdown[];
};

type PayrollRow = {
  userId: string;
  name: string;
  employeeCode: string | null;
  hourlyRate: number | null;
  totalHours: number;
  totalWages: number;
  shiftCount: number;
  perLocation: PayrollLocationBreakdown[];
  perDay: PayrollDayBreakdown[];
};

// === Helpers ===============================================================

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Mon–Sat pay period that contains "today"
function getCurrentPayPeriod(today = new Date()) {
  const day = today.getDay(); // 0=Sun..6=Sat

  // We want Monday as the start.
  const daysSinceMonday = (day + 6) % 7; // Mon(1)->0, Tue(2)->1, ..., Sun(0)->6
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - daysSinceMonday
  );
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 5
  ); // Mon + 5 = Sat

  return {
    startDateStr: formatDateInput(start),
    endDateStr: formatDateInput(end),
  };
}

// ==========================================================================

export default function AdminPayrollPage() {
  const { startDateStr, endDateStr } = getCurrentPayPeriod();

  const [startDate, setStartDate] = useState(startDateStr);
  const [endDate, setEndDate] = useState(endDateStr);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalHours, setTotalHours] = useState<number>(0);
  const [totalWages, setTotalWages] = useState<number>(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // shift forward/back by 7-day pay period (Mon–Sat)
  function shiftPayPeriod(offsetWeeks: number) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    start.setDate(start.getDate() + offsetWeeks * 7);
    end.setDate(end.getDate() + offsetWeeks * 7);

    const newStartStr = formatDateInput(start);
    const newEndStr = formatDateInput(end);

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

      const hoursSum = data.reduce(
        (acc, row) => acc + (row.totalHours ?? 0),
        0
      );
      const wagesSum = data.reduce(
        (acc, row) => acc + (row.totalWages ?? 0),
        0
      );

      setTotalHours(Number(hoursSum.toFixed(2)));
      setTotalWages(Number(wagesSum.toFixed(2)));

      // Reset selection if current selection vanished
      if (selectedUserId && !data.find((r) => r.userId === selectedUserId)) {
        setSelectedUserId(null);
      }
    } catch (err) {
      console.error(err);
      setError("Could not load payroll data for this period.");
      setRows([]);
      setTotalHours(0);
      setTotalWages(0);
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    void loadPayroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const periodLabel = useMemo(() => {
    if (!startDate || !endDate) return "";
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

  const selectedRow = useMemo(
    () => rows.find((r) => r.userId === selectedUserId) ?? null,
    [rows, selectedUserId]
  );

  // CSV export (flat: user, date, weekday, location, hours, wages)
  function exportCsv() {
    if (rows.length === 0) return;

    const lines: string[] = [];
    lines.push(
      [
        "Employee",
        "Code",
        "Date",
        "Weekday",
        "Location",
        "Hours",
        "Hourly Rate",
        "Wages",
      ].join(",")
    );

    for (const row of rows) {
      for (const day of row.perDay) {
        for (const loc of day.perLocation) {
          lines.push(
            [
              JSON.stringify(row.name ?? ""),
              JSON.stringify(row.employeeCode ?? ""),
              day.date,
              day.weekday,
              JSON.stringify(loc.locationName ?? ""),
              day.totalHours.toFixed(2),
              (row.hourlyRate ?? 0).toFixed(2),
              loc.totalWages.toFixed(2),
            ].join(",")
          );
        }
      }
    }

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Payroll</h1>
        <p className="mt-1 text-sm text-slate-400">
          Review total hours and wages by worker for the selected pay period
          (Monday through Saturday).
        </p>
      </div>

      {/* Filters / summary */}
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
              : `${rows.length} worker${rows.length === 1 ? "" : "s"} with hours in this period.`}
          </p>
          <p className="text-xs font-semibold text-slate-100 space-x-4">
            <span>
              Total hours:{" "}
              <span className="text-amber-300">{totalHours.toFixed(2)}h</span>
            </span>
            <span>
              Total wages:{" "}
              <span className="text-emerald-300">
                ${totalWages.toFixed(2)}
              </span>
            </span>
          </p>
        </div>
      </div>

      {/* Main table + CSV */}
      <div className="card bg-slate-900/80 border border-slate-700/80">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-slate-100">
            Hours & wages by worker
          </h2>
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="rounded-full border border-slate-600 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>

        <div className="mt-2 overflow-x-auto">
          <table className="admin-table min-w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800/80">
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-right">Shift count</th>
                <th className="px-3 py-2 text-right">Total hours</th>
                <th className="px-3 py-2 text-right">Total wages</th>
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

              {rows.map((row) => {
                const isSelected = row.userId === selectedUserId;
                return (
                  <tr
                    key={row.userId}
                    className={`border-b border-slate-800/80 cursor-pointer transition ${
                      isSelected ? "bg-slate-800/80" : "hover:bg-slate-800/40"
                    }`}
                    onClick={() =>
                      setSelectedUserId(
                        isSelected ? null : row.userId
                      )
                    }
                  >
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
                    <td className="px-3 py-2 align-middle text-right text-emerald-300">
                      ${row.totalWages.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Breakdown for selected worker */}
      {selectedRow && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* By location */}
          <div className="card bg-slate-900/80 border border-slate-700/80">
            <h3 className="text-sm font-semibold text-slate-100 mb-2">
              {selectedRow.name} – by job site
            </h3>
            <div className="overflow-x-auto">
              <table className="admin-table min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80">
                    <th className="px-3 py-2 text-left">Location</th>
                    <th className="px-3 py-2 text-right">Hours</th>
                    <th className="px-3 py-2 text-right">Wages</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRow.perLocation.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-4 text-center text-slate-400"
                      >
                        No shifts in this period.
                      </td>
                    </tr>
                  )}
                  {selectedRow.perLocation.map((loc) => (
                    <tr key={loc.locationId ?? loc.locationName ?? "adhoc"}>
                      <td className="px-3 py-2 align-middle text-slate-50">
                        {loc.locationName ?? "ADHOC"}
                      </td>
                      <td className="px-3 py-2 align-middle text-right text-slate-100">
                        {loc.totalHours.toFixed(2)}h
                      </td>
                      <td className="px-3 py-2 align-middle text-right text-emerald-300">
                        ${loc.totalWages.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* By day */}
          <div className="card bg-slate-900/80 border border-slate-700/80">
            <h3 className="text-sm font-semibold text-slate-100 mb-2">
              {selectedRow.name} – by day
            </h3>
            <div className="overflow-x-auto">
              <table className="admin-table min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80">
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Hours</th>
                    <th className="px-3 py-2 text-right">Wages</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRow.perDay.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-4 text-center text-slate-400"
                      >
                        No shifts in this period.
                      </td>
                    </tr>
                  )}
                  {selectedRow.perDay.map((day) => (
                    <tr key={day.date}>
                      <td className="px-3 py-2 align-middle text-slate-50">
                        {day.weekday} {day.date}
                      </td>
                      <td className="px-3 py-2 align-middle text-right text-slate-100">
                        {day.totalHours.toFixed(2)}h
                      </td>
                      <td className="px-3 py-2 align-middle text-right text-emerald-300">
                        ${day.totalWages.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}