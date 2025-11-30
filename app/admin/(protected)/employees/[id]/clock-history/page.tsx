"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminFetch } from "@/lib/adminFetch";

type Shift = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  clockInLat: number | null;
  clockInLng: number | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
  notes: string | null;
  location: {
    id: string;
    name: string;
    code: string;
  } | null;
};

type Employee = {
  id: string;
  name: string;
  employeeCode: string | null;
  hourlyRate: number | null;
};

function computeHours(clockIn: string, clockOut: string | null) {
  if (!clockOut) return null;
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function EmployeeClockHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    
    setStartDate(fmt(thirtyDaysAgo));
    setEndDate(fmt(today));
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, startDate, endDate]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const [empRes, shiftsRes] = await Promise.all([
        adminFetch(`/api/admin/employees/${employeeId}`),
        adminFetch(
          `/api/admin/employees/${employeeId}/shifts?start=${startDate}&end=${endDate}`
        ),
      ]);

      if (!empRes.ok || !shiftsRes.ok) {
        throw new Error("Failed to load employee or shifts");
      }

      const empData = await empRes.json();
      const shiftsData = await shiftsRes.json();

      setEmployee(empData);
      setShifts(shiftsData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  const totalHours = shifts.reduce((sum, shift) => {
    const hours = computeHours(shift.clockIn, shift.clockOut);
    return sum + (hours ?? 0);
  }, 0);

  const totalCost = totalHours * (employee?.hourlyRate ?? 0);

  const openShifts = shifts.filter((s) => !s.clockOut);
  const completedShifts = shifts.filter((s) => s.clockOut);

  // Group by date
  const shiftsByDate = completedShifts.reduce((acc, shift) => {
    const date = formatDate(shift.clockIn);
    if (!acc[date]) acc[date] = [];
    acc[date].push(shift);
    return acc;
  }, {} as Record<string, Shift[]>);

  const dates = Object.keys(shiftsByDate).sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="text-xs text-slate-400 hover:text-amber-300 mb-2"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold text-slate-100">
            {employee?.name || "Employee"} - Clock History
          </h1>
          {employee?.employeeCode && (
            <p className="text-sm text-slate-400">Code: {employee.employeeCode}</p>
          )}
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
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
          <label className="block text-xs font-medium text-slate-400 mb-1">
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
          onClick={loadData}
          disabled={loading}
          className="h-9 rounded-full bg-amber-400 px-4 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Total shifts
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-50">
            {shifts.length}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Open shifts
          </div>
          <div className="mt-1 text-xl font-semibold text-amber-300">
            {openShifts.length}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Total hours
          </div>
          <div className="mt-1 text-xl font-semibold text-amber-300">
            {totalHours.toFixed(2)}h
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Total cost
          </div>
          <div className="mt-1 text-xl font-semibold text-emerald-300">
            ${totalCost.toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            @ ${employee?.hourlyRate?.toFixed(2) ?? "0.00"}/hr
          </div>
        </div>
      </div>

      {/* Open shifts */}
      {openShifts.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <h3 className="text-sm font-semibold text-amber-200 mb-2">
            Open Shifts ({openShifts.length})
          </h3>
          <div className="space-y-2">
            {openShifts.map((shift) => (
              <div
                key={shift.id}
                className="flex items-center justify-between text-xs text-slate-200"
              >
                <div>
                  <span className="font-medium">
                    {shift.location?.name || "ADHOC"}
                  </span>
                  <span className="text-slate-400 ml-2">
                    Clocked in: {formatDateTime(shift.clockIn)}
                  </span>
                </div>
                <span className="text-amber-300 font-semibold">OPEN</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shifts by date */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-100">
          Completed Shifts by Date
        </h2>

        {loading && (
          <div className="text-center py-8 text-slate-400">Loading shifts…</div>
        )}

        {!loading && dates.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            No completed shifts in this date range.
          </div>
        )}

        {dates.map((date) => {
          const dayShifts = shiftsByDate[date];
          const dayHours = dayShifts.reduce((sum, s) => {
            const h = computeHours(s.clockIn, s.clockOut);
            return sum + (h ?? 0);
          }, 0);

          return (
            <div
              key={date}
              className="rounded-2xl border border-slate-700 bg-slate-900/80 overflow-hidden"
            >
              <div className="px-4 py-3 bg-slate-950/60 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">{date}</h3>
                <span className="text-xs text-amber-300 font-medium">
                  {dayHours.toFixed(2)}h total
                </span>
              </div>
              <div className="divide-y divide-slate-800/60">
                {dayShifts.map((shift) => {
                  const hours = computeHours(shift.clockIn, shift.clockOut);
                  const mapUrl = shift.clockInLat && shift.clockInLng
                    ? `https://www.google.com/maps?q=${shift.clockInLat},${shift.clockInLng}`
                    : null;

                  return (
                    <div key={shift.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-100">
                          {shift.location?.name || "ADHOC"}
                        </span>
                        <span className="text-xs text-amber-300 font-semibold">
                          {hours?.toFixed(2)}h
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <div className="space-x-3">
                          <span>In: {formatDateTime(shift.clockIn)}</span>
                          <span>Out: {formatDateTime(shift.clockOut)}</span>
                        </div>
                        {mapUrl && (
                          <a
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            Map
                          </a>
                        )}
                      </div>
                      {shift.notes && (
                        <div className="mt-1 text-[11px] text-slate-500">
                          Note: {shift.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
