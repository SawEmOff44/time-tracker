// app/admin/(protected)/analytics/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type JobSiteRow = {
  locationId: string | null;
  locationName: string;
  totalHours: number;
  totalCost: number;
  distinctWorkers: number;
  shiftCount: number;
};

type JobSiteAnalyticsResponse = {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  rows: JobSiteRow[];

  totalHours?: number;
  totalCost?: number;
  totalLocations?: number;
  totalWorkers?: number;
};

function getDefaultRange() {
  const today = new Date();
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);

  const start = new Date(end.getTime() - 13 * 24 * 60 * 60 * 1000);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  return { start: fmt(start), end: fmt(end) };
}

export default function AdminAnalyticsPage() {
  const defaultRange = getDefaultRange();

  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<JobSiteAnalyticsResponse | null>(null);

  // series for line chart (hours per day)
  const [series, setSeries] = useState<{ date: string; hours: number }[]>([]);

  // simple client-side filter by location name
  const [locationFilter, setLocationFilter] = useState("");

  const pollRef = useRef<number | null>(null);

  async function loadJobSites() {
    const params = new URLSearchParams();
    if (startDate) params.set("start", startDate);
    if (endDate) params.set("end", endDate);

    const res = await fetch(`/api/admin/analytics/job-sites?${params.toString()}`, {
      credentials: "include",
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Failed to load job-site analytics.");
    }

    const json = (await res.json()) as JobSiteAnalyticsResponse | JobSiteRow[];

    if (Array.isArray(json)) {
      setData({ start: startDate, end: endDate, rows: json });
    } else {
      setData(json as JobSiteAnalyticsResponse);
    }
  }

  async function loadSeries() {
    const params = new URLSearchParams();
    if (startDate) params.set("start", startDate);
    if (endDate) params.set("end", endDate);

    const res = await fetch(`/api/admin/analytics/hours?${params.toString()}`, {
      credentials: "include",
    });

    if (!res.ok) return;
    const json = await res.json().catch(() => null);
    if (!json || !Array.isArray(json.series)) return;
    setSeries(json.series);
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);

      await Promise.all([loadJobSites(), loadSeries()]);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to load analytics.");
      setData(null);
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }

  // initial load and whenever date range changes
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  // polling for near-real-time updates while page is visible
  useEffect(() => {
    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = window.setInterval(() => {
        void load();
      }, 5000) as unknown as number;
    };

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") startPolling();
      else stopPolling();
    };

    if (typeof document !== "undefined" && document.visibilityState === "visible") startPolling();

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const rows = data?.rows ?? [];

  const filteredRows = rows.filter((row) => {
    const term = locationFilter.trim().toLowerCase();
    if (!term) return true;
    return row.locationName.toLowerCase().includes(term);
  });

  const maxHours = filteredRows.length > 0 ? Math.max(...filteredRows.map((r) => r.totalHours)) : 0;

  // --- Derived summary numbers with fallbacks ------------------------------
  const summaryTotalHours = data?.totalHours ?? rows.reduce((sum, r) => sum + (r.totalHours || 0), 0);

  const summaryTotalCost = data?.totalCost ?? rows.reduce((sum, r) => sum + (r.totalCost || 0), 0);

  const summaryTotalLocations = data?.totalLocations ?? new Set(rows.map((r) => r.locationId ?? r.locationName)).size;

  const summaryTotalWorkers = data?.totalWorkers ?? rows.reduce((sum, r) => sum + (r.distinctWorkers || 0), 0);

  // Prepare pie data for top locations
  const pieData = filteredRows
    .slice()
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, 8)
    .map((r) => ({ name: r.locationName, value: Number(r.totalHours.toFixed(2)) }));

  const COLORS = ["#F59E0B", "#10B981", "#60A5FA", "#A78BFA", "#F97316", "#EF4444", "#14B8A6", "#FBBF24"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Job-Site Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">Man-hours and labor cost per location. Charts update while the page is visible to reflect recent shifts.</p>
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
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-1">Start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-100" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-1">End date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-100" />
          </div>
          <button type="submit" disabled={loading} className="h-9 rounded-full bg-amber-400 px-4 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60">{loading ? "Loading…" : "Refresh"}</button>
        </form>
      </div>

      {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      {/* Summary cards */}
      {data && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Range</div>
            <div className="mt-1 text-sm text-slate-100">{startDate} → {endDate}</div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Locations with hours</div>
            <div className="mt-1 text-xl font-semibold text-slate-50">{summaryTotalLocations}</div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Total hours</div>
            <div className="mt-1 text-xl font-semibold text-amber-300">{summaryTotalHours.toFixed(2)}h</div>
            <div className="mt-1 text-[11px] text-slate-500">Across {summaryTotalWorkers} workers</div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Total labor cost</div>
            <div className="mt-1 text-xl font-semibold text-emerald-300">${summaryTotalCost.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card bg-slate-900/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">Hours over time</h3>
            <div className="text-xs text-slate-400">Last {series.length} days</div>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="hours" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card bg-slate-900/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">Top locations (hours share)</h3>
            <div className="text-xs text-slate-400">Top {pieData.length}</div>
          </div>
          <div style={{ height: 220 }} className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={{ fontSize: 11 }}>
                  {pieData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-1">Filter by location</label>
          <input type="text" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} placeholder="e.g. Main Shop, Lake House" className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-100" />
        </div>
      </div>

      {/* Location table with hours bar */}
      <div className="card bg-slate-900/80">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-slate-100">Locations (sorted by hours)</h2>
          <div className="text-[11px] text-slate-400">{filteredRows.length} locations in view</div>
        </div>

        {filteredRows.length === 0 && !loading && !error && (
          <p className="text-sm text-slate-400">No locations with hours in this range (or matching the filter).</p>
        )}

        {filteredRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="admin-table min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/60">
                  <th className="px-3 py-2 text-left">Location</th>
                  <th className="px-3 py-2 text-left">Workers</th>
                  <th className="px-3 py-2 text-left">Shifts</th>
                  <th className="px-3 py-2 text-right">Hours</th>
                  <th className="px-3 py-2 text-right">Labor cost</th>
                  <th className="px-3 py-2 text-left">Hours share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredRows.slice().sort((a,b) => b.totalHours - a.totalHours).map((row) => {
                  const widthPct = maxHours > 0 ? Math.max(4, (row.totalHours / maxHours) * 100) : 0;
                  return (
                    <tr key={row.locationId ?? row.locationName}>
                      <td className="px-3 py-2 align-middle text-slate-200">{row.locationName}</td>
                      <td className="px-3 py-2 align-middle text-slate-200">{row.distinctWorkers}</td>
                      <td className="px-3 py-2 align-middle text-slate-200">{row.shiftCount}</td>
                      <td className="px-3 py-2 align-middle text-right text-slate-50">{row.totalHours.toFixed(2)}h</td>
                      <td className="px-3 py-2 align-middle text-right text-emerald-300">${row.totalCost.toFixed(2)}</td>
                      <td className="px-3 py-2 align-middle">
                        <div className="w-full max-w-xs">
                          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${widthPct}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
