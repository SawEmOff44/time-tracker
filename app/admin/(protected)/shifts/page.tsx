"use client";

import { useEffect, useMemo, useState } from "react";

type Role = "EMPLOYEE" | "ADMIN";

type User = {
  id: string;
  name: string;
  employeeCode: string | null;
  role: Role;
};

type Location = {
  id: string;
  name: string;
  code: string | null;
};

type Shift = {
  id: string;
  userId: string;
  locationId: string | null;
  clockIn: string; // ISO string from API
  clockOut: string | null; // ISO or null
  clockInLat: number | null;
  clockInLng: number | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
  user: User | null;
  location: Location | null;
};

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters (purely client-side)
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [employeeFilter, setEmployeeFilter] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState<string>("");

  // Derived lists for filters
  const employees = useMemo(() => {
    const map = new Map<string, { id: string; name: string; employeeCode: string | null }>();
    for (const s of shifts) {
      if (s.user) {
        map.set(s.user.id, {
          id: s.user.id,
          name: s.user.name,
          employeeCode: s.user.employeeCode,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [shifts]);

  const locations = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string | null }>();
    for (const s of shifts) {
      if (s.location) {
        map.set(s.location.id, {
          id: s.location.id,
          name: s.location.name,
          code: s.location.code,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [shifts]);

  async function loadShifts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shifts");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to load shifts");
      }
      const json = (await res.json()) as Shift[];
      setShifts(json);
    } catch (err: any) {
      console.error("Error loading shifts:", err);
      setError(err.message || "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadShifts();
  }, []);

  // Apply filters on the client
  const filteredShifts = useMemo(() => {
    let result = [...shifts];

    // Filter by date range (based on clockIn)
    if (startDate) {
      const start = new Date(startDate);
      result = result.filter((s) => {
        const ci = new Date(s.clockIn);
        return ci >= start;
      });
    }

    if (endDate) {
      const end = new Date(endDate);
      // add 1 day to include the end date fully
      end.setHours(23, 59, 59, 999);
      result = result.filter((s) => {
        const ci = new Date(s.clockIn);
        return ci <= end;
      });
    }

    // Filter by employee
    if (employeeFilter) {
      result = result.filter((s) => s.userId === employeeFilter);
    }

    // Filter by location (including ADHOC by code)
    if (locationFilter) {
      if (locationFilter === "ADHOC") {
        result = result.filter((s) => s.location?.code === "ADHOC");
      } else {
        result = result.filter((s) => s.locationId === locationFilter);
      }
    }

    // Sort most recent first
    result.sort((a, b) => {
      const da = new Date(a.clockIn).getTime();
      const db = new Date(b.clockIn).getTime();
      return db - da;
    });

    return result;
  }, [shifts, startDate, endDate, employeeFilter, locationFilter]);

  // Count ADHOC shifts per user *in the current filtered set*
  const adhocCountsByUser: Record<string, number> = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of filteredShifts) {
      if (s.location?.code === "ADHOC" && s.userId) {
        counts[s.userId] = (counts[s.userId] || 0) + 1;
      }
    }
    return counts;
  }, [filteredShifts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Shifts</h1>
        <button
          onClick={() => void loadShifts()}
          disabled={loading}
          className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {/* Errors */}
      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Filters</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              className="w-full rounded border px-2 py-1 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              className="w-full rounded border px-2 py-1 text-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Employee</label>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
            >
              <option value="">All</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                  {emp.employeeCode ? ` (${emp.employeeCode})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="">All</option>
              {/* Explicit ADHOC option if present in data */}
              <option value="ADHOC">ADHOC</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                  {loc.code ? ` (${loc.code})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Shifts Table */}
      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Shifts</h2>

        {loading && shifts.length === 0 ? (
          <div className="text-sm text-gray-600">Loading shifts...</div>
        ) : filteredShifts.length === 0 ? (
          <div className="text-sm text-gray-500">No shifts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-semibold text-gray-700">
                  <th className="px-2 py-1">Employee</th>
                  <th className="px-2 py-1">Location</th>
                  <th className="px-2 py-1">Clock In</th>
                  <th className="px-2 py-1">Clock Out</th>
                  <th className="px-2 py-1">Hours</th>
                  <th className="px-2 py-1">Map</th>
                  <th className="px-2 py-1">Flag</th>
                </tr>
              </thead>
              <tbody>
                {filteredShifts.map((shift) => {
                  const isAdhoc = shift.location?.code === "ADHOC";
                  const adhocCountForUser = adhocCountsByUser[shift.userId] || 0;
                  const highlightAdhoc = isAdhoc && adhocCountForUser >= 3;

                  const clockInDate = shift.clockIn ? new Date(shift.clockIn) : null;
                  const clockOutDate = shift.clockOut ? new Date(shift.clockOut) : null;

                  let hours: string | null = null;
                  if (clockInDate && clockOutDate) {
                    const diffMs = clockOutDate.getTime() - clockInDate.getTime();
                    const diffHours = diffMs / (1000 * 60 * 60);
                    hours = diffHours.toFixed(2);
                  }

                  return (
                    <tr
                      key={shift.id}
                      className={`border-b last:border-0 ${
                        highlightAdhoc ? "bg-red-50 text-red-800" : ""
                      }`}
                    >
                      <td className="px-2 py-1 text-sm">
                        {shift.user?.name || "Unknown"}
                        {shift.user?.employeeCode && (
                          <span className="ml-1 text-xs text-gray-500">
                            ({shift.user.employeeCode})
                          </span>
                        )}
                      </td>

                      <td className="px-2 py-1 text-sm">
                        {shift.location?.name || "Unknown"}
                      </td>

                      <td className="px-2 py-1 text-xs">
                        {clockInDate ? clockInDate.toLocaleString() : "—"}
                      </td>

                      <td className="px-2 py-1 text-xs">
                        {clockOutDate ? clockOutDate.toLocaleString() : "—"}
                      </td>

                      <td className="px-2 py-1 text-xs">{hours ?? "—"}</td>

                      {/* View in Map (clock-in GPS) */}
                      <td className="px-2 py-1 text-xs">
                        {shift.clockInLat != null && shift.clockInLng != null ? (
                          <a
                            href={`https://www.google.com/maps?q=${shift.clockInLat},${shift.clockInLng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            View in Map
                          </a>
                        ) : (
                          <span className="text-gray-400">No GPS</span>
                        )}
                      </td>

                      {/* ADHOC flag */}
                      <td className="px-2 py-1 text-xs">
                        {isAdhoc ? (
                          adhocCountForUser >= 3 ? (
                            <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                              ADHOC – HIGH ({adhocCountForUser})
                            </span>
                          ) : (
                            <span className="rounded bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-800">
                              ADHOC ({adhocCountForUser})
                            </span>
                          )
                        ) : (
                          <span className="text-gray-300 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}