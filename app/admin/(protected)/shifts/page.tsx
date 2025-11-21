"use client";

import { useEffect, useState, FormEvent } from "react";

type Shift = {
  id: string;
  userId: string;
  locationId: string | null;
  clockIn: string;
  clockOut: string | null;
  user?: {
    id: string;
    name: string;
    employeeCode: string | null;
  } | null;
  location?: {
    id: string;
    name: string;
    code: string;
  } | null;
};

type Employee = {
  id: string;
  name: string;
  employeeCode: string | null;
};

type Location = {
  id: string;
  name: string;
};

function safeHoursBetween(startISO: string, endISO: string | null): number | null {
  if (!endISO) return null;
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return null;
  return ms / (1000 * 60 * 60);
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual shift fields
  const [employeeId, setEmployeeId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");

  async function loadShifts() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/shifts");
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to load shifts");
      }
      setShifts(data);
    } catch (err: any) {
      setError(err.message || "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  }

  async function loadEmployeesAndLocations() {
    try {
      const [empRes, locRes] = await Promise.all([
        fetch("/api/admin/employees"),
        fetch("/api/admin/locations"),
      ]);

      const empData = await empRes.json();
      const locData = await locRes.json();

      if (!empRes.ok || empData.error) {
        throw new Error(empData.error || "Failed to load employees");
      }
      if (!locRes.ok || locData.error) {
        throw new Error(locData.error || "Failed to load locations");
      }

      setEmployees(empData);
      setLocations(locData);
    } catch (err: any) {
      setError(err.message || "Failed to load supporting data");
    }
  }

  useEffect(() => {
    loadShifts();
    loadEmployeesAndLocations();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!employeeId) {
        throw new Error("Employee is required.");
      }
      if (!clockIn) {
        throw new Error("Clock In is required.");
      }

      const start = new Date(clockIn);
      if (Number.isNaN(start.getTime())) {
        throw new Error(
          "Clock In must be a valid datetime, e.g. 2025-01-01T08:00:00"
        );
      }

      let endISO: string | null = null;
      if (clockOut) {
        const end = new Date(clockOut);
        if (Number.isNaN(end.getTime())) {
          throw new Error(
            "Clock Out must be a valid datetime, e.g. 2025-01-01T17:00:00"
          );
        }
        endISO = end.toISOString();
      }

      const res = await fetch("/api/admin/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,           // UI name
          locationId: locationId || null,
          clockIn: start.toISOString(),
          clockOut: endISO,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to create shift");
      }

      setEmployeeId("");
      setLocationId("");
      setClockIn("");
      setClockOut("");
      await loadShifts();
    } catch (err: any) {
      setError(
        err.message || "Failed to create shift (check date/time format)."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Shifts</h1>
          <p className="text-sm text-gray-600">
            Review and create manual shift entries.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Manual shift creation */}
      <form
        onSubmit={handleCreate}
        className="bg-white border rounded p-4 space-y-3"
      >
        <h2 className="font-semibold mb-1">Create Manual Shift</h2>
        <p className="text-xs text-gray-500">
          Use full datetime format, e.g.{" "}
          <span className="font-mono">2025-01-01T08:00:00</span>.
        </p>
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Employee</label>
            <select
              className="border rounded px-2 py-1 w-full text-sm"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            >
              <option value="">Select employee...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.employeeCode ? ` (${e.employeeCode})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Location</label>
            <select
              className="border rounded px-2 py-1 w-full text-sm"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">(none)</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Clock In (local)
            </label>
            <input
              className="border rounded px-2 py-1 w-full text-xs font-mono"
              placeholder="2025-01-01T08:00:00"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Clock Out (optional)
            </label>
            <input
              className="border rounded px-2 py-1 w-full text-xs font-mono"
              placeholder="2025-01-01T17:00:00"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-2 px-4 py-2 rounded bg-black text-white text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Saving..." : "Create Shift"}
        </button>
      </form>

      {/* Shifts table */}
      <div className="bg-white border rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                Employee
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                Location
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                Clock In
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                Clock Out
              </th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">
                Hours
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-3 text-center text-gray-400"
                >
                  Loading shifts...
                </td>
              </tr>
            ) : shifts.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-3 text-center text-gray-400"
                >
                  No shifts found yet.
                </td>
              </tr>
            ) : (
              shifts.map((s) => {
                const hrs = safeHoursBetween(s.clockIn, s.clockOut);
                return (
                  <tr key={s.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {s.user?.name || "Unknown"}
                      </div>
                      {s.user?.employeeCode && (
                        <div className="text-xs text-gray-500">
                          {s.user.employeeCode}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {s.location?.name || (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {s.clockIn}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {s.clockOut || (
                        <span className="text-gray-400">open</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {hrs == null ? "—" : hrs.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}