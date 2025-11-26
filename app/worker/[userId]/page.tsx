"use client";

import { useEffect, useMemo, useState } from "react";

type PayrollLocationBreakdown = {
  locationId: string | null;
  locationName: string | null;
  totalHours: number;
  totalWages: number;
};

type PayrollDayBreakdown = {
  date: string;
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

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

interface WorkerPageProps {
  params: { userId: string };
}

export default function WorkerPayrollPage({ params }: WorkerPageProps) {
  const userId = params.userId;

  const { startDateStr, endDateStr } = getCurrentPayPeriod();
  const [startDate, setStartDate] = useState(startDateStr);
  const [endDate, setEndDate] = useState(endDateStr);
  const [row, setRow] = useState<PayrollRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        userId,
      });

      const res = await fetch(`/api/admin/payroll?${params.toString()}`);

      if (!res.ok) {
        throw new Error("Failed");
      }

      const data = (await res.json()) as PayrollRow[];

      setRow(data[0] ?? null);
    } catch (err) {
      console.error(err);
      setError("Could not load hours for this period.");
      setRow(null);
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
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-3xl rounded-3xl bg-slate-900/90 border border-slate-700/80 shadow-[0_40px_120px_rgba(15,23,42,0.95)] px-6 py-6 sm:px-8 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold">
              My hours & pay summary
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Pay period: {periodLabel}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
          <div className="flex gap-3">
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Start (Mon)
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
                End (Sat)
              </label>
              <input
                type="date"
                className="mt-1 w-40 bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              className="rounded-full border border-slate-700/70 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              ◀ Prev
            </button>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              className="rounded-full border border-slate-700/70 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              Next ▶
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
          <p className="mb-3 text-xs text-red-300">{error}</p>
        )}

        {!row && !loading && (
          <p className="mt-4 text-sm text-slate-300">
            No hours recorded in this period.
          </p>
        )}

        {row && (
          <>
            {/* Summary */}
            <div className="grid gap-3 sm:grid-cols-3 mb-6">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700/80">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Employee
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {row.name}
                </p>
                <p className="text-xs text-slate-400">
                  Code: {row.employeeCode ?? "—"}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700/80">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Total hours
                </p>
                <p className="mt-2 text-2xl font-semibold text-amber-300">
                  {row.totalHours.toFixed(2)}h
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700/80">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Est. pay
                </p>
                <p className="mt-2 text-2xl font-semibold text-emerald-300">
                  ${row.totalWages.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Rate used: ${(row.hourlyRate ?? 0).toFixed(2)}/hr
                </p>
              </div>
            </div>

            {/* By day */}
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 px-3 py-3 sm:px-4 sm:py-4">
              <h2 className="text-sm font-semibold text-slate-100 mb-2">
                Breakdown by day
              </h2>
              <div className="overflow-x-auto">
                <table className="admin-table min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800/80">
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Job site(s)</th>
                      <th className="px-3 py-2 text-right">Hours</th>
                      <th className="px-3 py-2 text-right">Est. pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.perDay.map((d) => (
                      <tr key={d.date}>
                        <td className="px-3 py-2 align-middle text-slate-50">
                          {d.weekday} {d.date}
                        </td>
                        <td className="px-3 py-2 align-middle text-slate-200">
                          {d.perLocation
                            .map((l) => l.locationName ?? "ADHOC")
                            .join(", ")}
                        </td>
                        <td className="px-3 py-2 align-middle text-right text-slate-100">
                          {d.totalHours.toFixed(2)}h
                        </td>
                        <td className="px-3 py-2 align-middle text-right text-emerald-300">
                          ${d.totalWages.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}