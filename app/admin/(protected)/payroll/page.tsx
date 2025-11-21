"use client";

import { useEffect, useMemo, useState } from "react";

type Shift = {
  id: string;
  clockIn: string; // ISO from API
  clockOut: string | null;
  user: {
    id: string;
    name: string;
    employeeCode: string | null;
  } | null;
  location: {
    id: string;
    name: string;
    code: string;
  } | null;
};

type SummaryRow = {
  employeeId: string;
  name: string;
  employeeCode: string;
  totalHours: number;
  totalShifts: number;
};

function hoursBetween(clockIn: string, clockOut: string | null): number {
  if (!clockOut) return 0;
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  const ms = end - start;
  if (!isFinite(ms) || ms <= 0) return 0;
  return ms / (1000 * 60 * 60);
}

function formatHours(h: number) {
  return h.toFixed(2);
}

function formatDateInput(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function PayrollPage() {
  const today = useMemo(() => new Date(), []);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    // default: 7 days ago
    d.setDate(d.getDate() - 7);
    return formatDateInput(d);
  });
  const [toDate, setToDate] = useState(() => formatDateInput(today));

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [autoLoaded, setAutoLoaded] = useState(false); // load once on mount

  async function loadShifts() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`/api/shifts?${params.toString()}`);

      const data = (await res.json().catch(() => ({}))) as
        | Shift[]
        | { error?: string };

      if (!res.ok) {
        const msg =
          (data as any).error ||
          `Failed to load shifts (status ${res.status})`;
        throw new Error(msg);
      }

      setShifts(data as Shift[]);
    } catch (err: any) {
      console.error("loadShifts error:", err);
      setError(err.message || "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  }

  // auto-load once with default dates
  useEffect(() => {
    if (!autoLoaded) {
      setAutoLoaded(true);
      loadShifts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoaded]);

  // Aggregate per employee
  const summary: SummaryRow[] = useMemo(() => {
    const byEmployee = new Map<string, SummaryRow>();

    for (const shift of shifts) {
      if (!shift.user) continue;
      const id = shift.user.id;
      const key = id;

      const hours = hoursBetween(shift.clockIn, shift.clockOut);

      if (!byEmployee.has(key)) {
        byEmployee.set(key, {
          employeeId: id,
          name: shift.user.name || "Unknown",
          employeeCode: shift.user.employeeCode || "",
          totalHours: 0,
          totalShifts: 0,
        });
      }

      const row = byEmployee.get(key)!;
      row.totalHours += hours;
      row.totalShifts += 1;
    }

    // sort by name or hours descending if you prefer
    return Array.from(byEmployee.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [shifts]);

  const totalHoursAll = useMemo(
    () => summary.reduce((sum, r) => sum + r.totalHours, 0),
    [summary]
  );

  const totalShiftsAll = useMemo(
    () => summary.reduce((sum, r) => sum + r.totalShifts, 0),
    [summary]
  );

  function exportSummaryCsv() {
    if (summary.length === 0) {
      alert("No data to export for this date range.");
      return;
    }

    const header = [
      "Employee Name",
      "Employee Code",
      "Total Hours",
      "Total Shifts",
      "From Date",
      "To Date",
    ];

    const rows = summary.map((row) => [
      row.name,
      row.employeeCode,
      formatHours(row.totalHours),
      String(row.totalShifts),
      fromDate,
      toDate,
    ]);

    const csvLines = [header, ...rows]
      .map((cols) =>
        cols
          .map((c) => {
            const s = c ?? "";
            // basic CSV escaping
            if (s.includes(",") || s.includes('"') || s.includes("\n")) {
              return `"${String(s).replace(/"/g, '""')}"`;
            }
            return String(s);
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvLines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-summary_${fromDate}_to_${toDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  function openDetailedCsv() {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);

    // hits your existing detailed export API (if implemented)
    window.open(`/api/export/shifts?${params.toString()}`, "_blank");
  }

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payroll / Shift Summary</h1>
          <p className="text-sm text-gray-600">
            Aggregate hours per employee for a chosen date range.
          </p>
        </div>
      </header>

      {/* Filters */}
      <section className="bg-white shadow rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-semibold">Filters</h2>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">From date</label>
            <input
              type="date"
              className="border rounded px-2 py-1 w-full"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">To date</label>
            <input
              type="date"
              className="border rounded px-2 py-1 w-full"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadShifts}
              disabled={loading}
              className="px-4 py-2 rounded bg-black text-white text-sm font-semibold disabled:opacity-60"
            >
              {loading ? "Loading..." : "Apply"}
            </button>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={exportSummaryCsv}
              className="px-3 py-2 rounded border text-xs font-semibold"
            >
              Export Summary CSV
            </button>
            <button
              type="button"
              onClick={openDetailedCsv}
              className="px-3 py-2 rounded border text-xs font-semibold"
            >
              Export Detailed CSV
            </button>
          </div>
        </div>
        {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
      </section>

      {/* Summary table */}
      <section className="bg-white shadow rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Summary by Employee</h2>
          <div className="text-xs text-gray-500">
            {summary.length} employees • {totalShiftsAll} shifts •{" "}
            {formatHours(totalHoursAll)} hrs
          </div>
        </div>

        {loading && (
          <div className="text-sm text-gray-500">Loading shifts...</div>
        )}

        {!loading && summary.length === 0 ? (
          <div className="text-sm text-gray-500">
            No completed shifts in this date range.
          </div>
        ) : null}

        {!loading && summary.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 pr-2">Employee</th>
                  <th className="text-left py-1 pr-2">Code</th>
                  <th className="text-right py-1 pr-2">Total Hours</th>
                  <th className="text-right py-1 pr-2">Shifts</th>
                  <th className="text-right py-1 pr-2">Avg Hours / Shift</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => {
                  const avg =
                    row.totalShifts > 0
                      ? row.totalHours / row.totalShifts
                      : 0;
                  return (
                    <tr key={row.employeeId} className="border-b">
                      <td className="py-1 pr-2">{row.name}</td>
                      <td className="py-1 pr-2">{row.employeeCode || "—"}</td>
                      <td className="py-1 pr-2 text-right">
                        {formatHours(row.totalHours)}
                      </td>
                      <td className="py-1 pr-2 text-right">
                        {row.totalShifts}
                      </td>
                      <td className="py-1 pr-2 text-right">
                        {formatHours(avg)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="py-1 pr-2">Total</td>
                  <td className="py-1 pr-2">—</td>
                  <td className="py-1 pr-2 text-right">
                    {formatHours(totalHoursAll)}
                  </td>
                  <td className="py-1 pr-2 text-right">{totalShiftsAll}</td>
                  <td className="py-1 pr-2 text-right">
                    {totalShiftsAll > 0
                      ? formatHours(totalHoursAll / totalShiftsAll)
                      : "0.00"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}