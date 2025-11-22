"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Role = "ADMIN" | "WORKER";

type User = {
  id: string;
  name: string;
  employeeCode: string | null;
  role: Role;
};

type Location = {
  id: string;
  name: string;
};

type Shift = {
  id: string;
  clockIn: string | null;
  clockOut: string | null;
  hours: number | null;
  isAdhoc?: boolean | null;
  clockInLat?: number | null;
  clockInLng?: number | null;
  user?: User | null;
  location?: Location | null;
};

type ApiResponse = {
  shifts: Shift[];
};

export default function AdminShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterEmployee, setFilterEmployee] = useState<string>("");
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [filterAdhocOnly, setFilterAdhocOnly] = useState(false);

  async function loadShifts() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/shifts", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to load shifts");
      }

      const data = (await res.json()) as ApiResponse | Shift[];
      // Support either { shifts: [...] } or [...] directly
      const list = Array.isArray(data) ? data : data.shifts;

      setShifts(list ?? []);
    } catch (err) {
      console.error("Error fetching shifts:", err);
      setError("Failed to load shifts. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShifts();
  }, []);

  function formatDateTime(value: string | null | undefined) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  }

  function formatHours(value: number | null | undefined) {
    if (value == null || isNaN(value)) return "—";
    return value.toFixed(2);
  }

  function buildMapUrl(shift: Shift) {
    if (
      !shift.clockInLat ||
      !shift.clockInLng ||
      isNaN(shift.clockInLat) ||
      isNaN(shift.clockInLng)
    ) {
      return null;
    }
    return `https://www.google.com/maps?q=${shift.clockInLat},${shift.clockInLng}`;
  }

  const filteredShifts = shifts.filter((s) => {
    if (filterEmployee) {
      const matchCode =
        s.user?.employeeCode &&
        s.user.employeeCode.toLowerCase().includes(filterEmployee.toLowerCase());
    const matchName =
        s.user?.name &&
        s.user.name.toLowerCase().includes(filterEmployee.toLowerCase());

      if (!matchCode && !matchName) return false;
    }

    if (filterLocation) {
      const locName = s.location?.name?.toLowerCase() ?? "";
      if (!locName.includes(filterLocation.toLowerCase())) return false;
    }

    if (filterAdhocOnly && !s.isAdhoc) return false;

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Shifts
          </h2>
          <p className="text-xs text-gray-500">
            Review and audit clock-in / clock-out activity.
          </p>
        </div>
        <button
          onClick={loadShifts}
          className="px-3 py-1.5 text-xs rounded-md border border-gray-300 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="grid gap-2 md:grid-cols-3 text-xs">
        <div className="flex flex-col">
          <label className="font-medium mb-1">Filter by employee</label>
          <input
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="border rounded px-2 py-1 text-xs"
            placeholder="Name or code"
          />
        </div>

        <div className="flex flex-col">
          <label className="font-medium mb-1">Filter by location</label>
          <input
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="border rounded px-2 py-1 text-xs"
            placeholder="Location name"
          />
        </div>

        <div className="flex items-end gap-2">
          <label className="inline-flex items-center text-xs">
            <input
              type="checkbox"
              className="mr-2"
              checked={filterAdhocOnly}
              onChange={(e) => setFilterAdhocOnly(e.target.checked)}
            />
            Show ADHOC only
          </label>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-xs text-gray-500">Loading shifts…</div>
      ) : error ? (
        <div className="text-xs text-red-600">{error}</div>
      ) : filteredShifts.length === 0 ? (
        <div className="text-xs text-gray-500">
          No shifts found for the current filters.
        </div>
      ) : (
        <div className="border rounded-md overflow-x-auto bg-white">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-100 text-[11px] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-left">Clock In</th>
                <th className="px-3 py-2 text-left">Clock Out</th>
                <th className="px-3 py-2 text-right">Hours</th>
                <th className="px-3 py-2 text-center">ADHOC</th>
                <th className="px-3 py-2 text-center">Map</th>
              </tr>
            </thead>
            <tbody>
              {filteredShifts.map((shift) => {
                const mapUrl = buildMapUrl(shift);

                return (
                  <tr key={shift.id} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium text-[11px]">
                        {shift.user?.name ?? "Unknown"}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {shift.user?.employeeCode ?? "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[11px]">
                      {shift.location?.name ?? (shift.isAdhoc ? "ADHOC" : "—")}
                    </td>
                    <td className="px-3 py-2 text-[11px]">
                      {formatDateTime(shift.clockIn)}
                    </td>
                    <td className="px-3 py-2 text-[11px]">
                      {formatDateTime(shift.clockOut)}
                    </td>
                    <td className="px-3 py-2 text-right text-[11px]">
                      {formatHours(shift.hours)}
                    </td>
                    <td className="px-3 py-2 text-center text-[11px]">
                      {shift.isAdhoc ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          ADHOC
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-[11px]">
                      {mapUrl ? (
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}