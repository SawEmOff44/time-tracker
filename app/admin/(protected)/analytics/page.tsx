// app/admin/(protected)/analytics/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";

type EmployeeBreakdown = {
  userId: string;
  userName: string;
  hours: number;
  shifts: number;
  cost: number;
};

type JobSiteRow = {
  locationId: string | null;
  locationName: string | null;
  totalHours: number;
  totalCost: number;
  workerCount: number;
  shiftCount: number;
  employees?: EmployeeBreakdown[];
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

type DatePreset = 'today' | 'week' | 'lastWeek' | 'month' | 'lastMonth' | 'custom';

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

function getPresetRange(preset: DatePreset): { start: string; end: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  switch (preset) {
    case 'today':
      return { start: fmt(today), end: fmt(today) };
    case 'week': {
      const day = today.getDay();
      const daysSinceMonday = (day + 6) % 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() - daysSinceMonday);
      const saturday = new Date(monday);
      saturday.setDate(monday.getDate() + 5);
      return { start: fmt(monday), end: fmt(saturday) };
    }
    case 'lastWeek': {
      const day = today.getDay();
      const daysSinceMonday = (day + 6) % 7;
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() - daysSinceMonday);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSaturday = new Date(lastMonday);
      lastSaturday.setDate(lastMonday.getDate() + 5);
      return { start: fmt(lastMonday), end: fmt(lastSaturday) };
    }
    case 'month': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: fmt(firstDay), end: fmt(lastDay) };
    }
    case 'lastMonth': {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: fmt(firstDay), end: fmt(lastDay) };
    }
    default:
      return null;
  }
}

export default function AdminAnalyticsPage() {
  const defaultRange = getDefaultRange();

  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [preset, setPreset] = useState<DatePreset>('custom');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<JobSiteAnalyticsResponse | null>(null);

  // series for line chart (hours per day)
  const [series, setSeries] = useState<{ date: string; hours: number }[]>([]);
  // dynamically loaded chart library to avoid import-time failures in some deploys
  const [chartLib, setChartLib] = useState<any>(null);

  // simple client-side filter by location name
  const [locationFilter, setLocationFilter] = useState("");
  // track which locations are expanded to show employee breakdown
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());

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

  async function loadEmployeeBreakdown(locationId: string | null): Promise<EmployeeBreakdown[]> {
    const params = new URLSearchParams();
    if (startDate) params.set("start", startDate);
    if (endDate) params.set("end", endDate);
    if (locationId) params.set("locationId", locationId);

    const res = await fetch(`/api/admin/analytics/employees?${params.toString()}`, {
      credentials: "include",
    });

    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
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

  // load Recharts dynamically on the client so import-time errors don't break the page
  useEffect(() => {
    let mounted = true;
    void import("recharts")
      .then((mod) => {
        if (mounted) setChartLib(mod);
      })
      .catch((err) => {
        console.error("Failed to load chart library:", err);
      });
    return () => {
      mounted = false;
    };
  }, []);

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

  function handlePresetChange(newPreset: DatePreset) {
    setPreset(newPreset);
    const range = getPresetRange(newPreset);
    if (range) {
      setStartDate(range.start);
      setEndDate(range.end);
    }
  }

  async function toggleLocationExpand(locationId: string | null) {
    const key = locationId ?? 'null';
    const newExpanded = new Set(expandedLocations);
    
    if (expandedLocations.has(key)) {
      newExpanded.delete(key);
      setExpandedLocations(newExpanded);
    } else {
      newExpanded.add(key);
      setExpandedLocations(newExpanded);
      
      // Load employee breakdown if not already loaded
      const row = rows.find(r => (r.locationId ?? 'null') === key);
      if (row && !row.employees) {
        const employees = await loadEmployeeBreakdown(locationId);
        const updatedRows = rows.map(r => 
          (r.locationId ?? 'null') === key ? { ...r, employees } : r
        );
        setData(data ? { ...data, rows: updatedRows } : null);
      }
    }
  }

  const filteredRows = rows.filter((row) => {
    const term = locationFilter.trim().toLowerCase();
    if (!term) return true;
    return row.locationName.toLowerCase().includes(term);
  });

  // Calculate top performers
  const allEmployees = new Map<string, { name: string; hours: number; shifts: number; cost: number }>();
  rows.forEach(row => {
    row.employees?.forEach(emp => {
      const existing = allEmployees.get(emp.userId);
      if (existing) {
        existing.hours += emp.hours;
        existing.shifts += emp.shifts;
        existing.cost += emp.cost;
      } else {
        allEmployees.set(emp.userId, {
          name: emp.userName,
          hours: emp.hours,
          shifts: emp.shifts,
          cost: emp.cost
        });
      }
    });
  });
  
  const topPerformers = Array.from(allEmployees.values())
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10);

  const maxHours = filteredRows.length > 0 ? Math.max(...filteredRows.map((r) => r.totalHours)) : 0;

  // --- Derived summary numbers with fallbacks ------------------------------
  const summaryTotalHours = data?.totalHours ?? rows.reduce((sum, r) => sum + (r.totalHours || 0), 0);

  const summaryTotalCost = data?.totalCost ?? rows.reduce((sum, r) => sum + (r.totalCost || 0), 0);

  const summaryTotalLocations = data?.totalLocations ?? new Set(rows.map((r) => r.locationId ?? r.locationName)).size;

  const summaryTotalWorkers = data?.totalWorkers ?? rows.reduce((sum, r) => sum + (r.workerCount || 0), 0);

  // Prepare pie data for top locations
  const pieData = filteredRows
    .slice()
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, 8)
    .map((r) => ({ name: r.locationName ?? "Unknown", value: Number(r.totalHours.toFixed(2)) }));

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
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {(['today', 'week', 'lastWeek', 'month', 'lastMonth', 'custom'] as DatePreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePresetChange(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  preset === p
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p === 'today' && 'Today'}
                {p === 'week' && 'This Week'}
                {p === 'lastWeek' && 'Last Week'}
                {p === 'month' && 'This Month'}
                {p === 'lastMonth' && 'Last Month'}
                {p === 'custom' && 'Custom'}
              </button>
            ))}
          </div>
          <form
            className="flex flex-wrap gap-3 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
          >
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-1">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPreset('custom');
                }}
                className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-1">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPreset('custom');
                }}
                className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-100"
              />
            </div>
            <button type="submit" disabled={loading} className="h-9 rounded-full bg-amber-400 px-4 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60">{loading ? "Loading…" : "Refresh"}</button>
          </form>
        </div>
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
            <div className="mt-1 text-xl font-semibold text-emerald-300">${(summaryTotalCost ?? 0).toFixed(2)}</div>
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
            {chartLib ? (
              <chartLib.ResponsiveContainer width="100%" height="100%">
                <chartLib.LineChart data={series}>
                  <chartLib.XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <chartLib.YAxis tick={{ fontSize: 11 }} />
                  <chartLib.Tooltip />
                  <chartLib.Line type="monotone" dataKey="hours" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2 }} />
                </chartLib.LineChart>
              </chartLib.ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading charts…</div>
            )}
          </div>
        </div>

        <div className="card bg-slate-900/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">Top locations (hours share)</h3>
            <div className="text-xs text-slate-400">Top {pieData.length}</div>
          </div>
          <div style={{ height: 220 }} className="flex items-center justify-center">
            {chartLib ? (
              <chartLib.ResponsiveContainer width="100%" height="100%">
                <chartLib.PieChart>
                  <chartLib.Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={{ fontSize: 11 }}>
                    {pieData.map((entry: any, idx: number) => (
                      <chartLib.Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </chartLib.Pie>
                  <chartLib.Legend wrapperStyle={{ fontSize: 11 }} />
                  <chartLib.Tooltip />
                </chartLib.PieChart>
              </chartLib.ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading charts…</div>
            )}
          </div>
        </div>
      </div>

      {/* Top Performers & Cost Efficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {topPerformers.length > 0 && (
          <div className="card bg-slate-900/80 p-4">
            <h3 className="text-sm font-semibold text-slate-100 mb-3">Top performers (by hours)</h3>
            <div className="space-y-2">
              {topPerformers.map((emp, idx) => (
                <div key={emp.name} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-100">{emp.name}</div>
                      <div className="text-[10px] text-slate-500">{emp.shifts} shifts</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-amber-300">{emp.hours.toFixed(1)}h</div>
                    <div className="text-[10px] text-emerald-400">${emp.cost.toFixed(0)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card bg-slate-900/80 p-4">
          <h3 className="text-sm font-semibold text-slate-100 mb-3">Cost efficiency by location</h3>
          <div className="space-y-2">
            {filteredRows.slice(0, 10).map((row) => {
              const costPerHour = row.totalHours > 0 ? row.totalCost / row.totalHours : 0;
              return (
                <div key={row.locationId ?? row.locationName} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
                  <div className="text-xs text-slate-100 truncate max-w-[200px]">{row.locationName}</div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-emerald-300">${costPerHour.toFixed(2)}/hr</div>
                    <div className="text-[10px] text-slate-500">{row.totalHours.toFixed(1)}h total</div>
                  </div>
                </div>
              );
            })}
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
                  const key = row.locationId ?? 'null';
                  const isExpanded = expandedLocations.has(key);
                  return (
                    <>
                      <tr key={row.locationId ?? row.locationName ?? Math.random().toString(36)} className="hover:bg-slate-800/40">
                        <td className="px-3 py-2 align-middle">
                          <button
                            onClick={() => toggleLocationExpand(row.locationId)}
                            className="flex items-center gap-2 text-slate-200 hover:text-amber-300 transition-colors"
                          >
                            <span className="text-[10px]">{isExpanded ? '▼' : '▶'}</span>
                            <span>{row.locationName ?? "Unknown"}</span>
                          </button>
                        </td>
                        <td className="px-3 py-2 align-middle text-slate-200">{row.workerCount}</td>
                        <td className="px-3 py-2 align-middle text-slate-200">{row.shiftCount}</td>
                        <td className="px-3 py-2 align-middle text-right text-slate-50">{row.totalHours.toFixed(2)}h</td>
                        <td className="px-3 py-2 align-middle text-right text-emerald-300">${(row.totalCost ?? 0).toFixed(2)}</td>
                        <td className="px-3 py-2 align-middle">
                          <div className="w-full max-w-xs">
                            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div className="h-full rounded-full bg-amber-400" style={{ width: `${widthPct}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && row.employees && row.employees.length > 0 && (
                        <tr key={`${key}-employees`}>
                          <td colSpan={6} className="px-3 py-3 bg-slate-950/40">
                            <div className="pl-6 space-y-1">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Employee breakdown</div>
                              {row.employees.map(emp => (
                                <div key={emp.userId} className="flex items-center justify-between py-1.5 text-xs">
                                  <span className="text-slate-300">{emp.userName}</span>
                                  <div className="flex items-center gap-4">
                                    <span className="text-slate-400">{emp.shifts} shifts</span>
                                    <span className="text-amber-300 font-medium">{emp.hours.toFixed(1)}h</span>
                                    <span className="text-emerald-400">${emp.cost.toFixed(2)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
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
