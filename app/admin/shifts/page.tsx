"use client";

import { useEffect, useState } from "react";

type ShiftRow = {
  id: string;
  employeeCode: string | null;
  employeeName: string;
  locationName: string;
  status: string;
  clockIn: string;
  clockOut: string | null;
  hours: number | null;
};

function formatDateTime(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function AdminShiftsPage() {
  // Default range: last 7 days
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });

  const [to, setTo] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadShifts() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/shifts?${params.toString()}`);
      const data = (await res.json()) as any;

      if (!res.ok) {
        throw new Error(data.error || "Failed to load shifts");
      }

      setShifts(data as ShiftRow[]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // load once initially

  const exportUrl = (() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/export/shifts?${params.toString()}`;
  })();

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto bg-white shadow-md rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Shifts / Time Entries</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              From (date)
            </label>
            <input
              type="date"
              className="border rounded px-2 py-1"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              To (date)
            </label>
            <input
              type="date"
              className="border rounded px-2 py-1"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <button
            onClick={loadShifts}
            disabled={loading}
            className="px-4 py-2 rounded bg-black text-white font-semibold disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          <a
            href={exportUrl}
            className="px-4 py-2 rounded border border-gray-400 text-sm"
          >
            Export CSV
          </a>
        </div>

        {error && (
          <div className="text-sm text-red-600 mb-2">
            Error: {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1 text-left">Employee</th>
                <th className="border px-2 py-1 text-left">Code</th>
                <th className="border px-2 py-1 text-left">Location</th>
                <th className="border px-2 py-1 text-left">Status</th>
                <th className="border px-2 py-1 text-left">Clock In</th>
                <th className="border px-2 py-1 text-left">Clock Out</th>
                <th className="border px-2 py-1 text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {shifts.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="border px-2 py-3 text-center text-gray-500"
                  >
                    No shifts found for this range.
                  </td>
                </tr>
              ) : (
                shifts.map((s) => (
                  <tr key={s.id}>
                    <td className="border px-2 py-1">{s.employeeName}</td>
                    <td className="border px-2 py-1">
                      {s.employeeCode ?? ""}
                    </td>
                    <td className="border px-2 py-1">
                      {s.locationName}
                    </td>
                    <td className="border px-2 py-1">{s.status}</td>
                    <td className="border px-2 py-1">
                      {formatDateTime(s.clockIn)}
                    </td>
                    <td className="border px-2 py-1">
                      {formatDateTime(s.clockOut)}
                    </td>
                    <td className="border px-2 py-1 text-right">
                      {s.hours !== null
                        ? s.hours.toFixed(2)
                        : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
