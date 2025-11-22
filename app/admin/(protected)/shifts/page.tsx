"use client";

import { useEffect, useMemo, useState } from "react";

type Employee = {
  id: string;
  name: string | null;
  employeeCode: string | null;
  role: string;
  active: boolean;
};

type Location = {
  id: string;
  name: string;
  code: string;
  active: boolean;
};

type Shift = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  clockInLat: number | null;
  clockInLng: number | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
  user: {
    id: string;
    name: string | null;
    employeeCode: string | null;
  } | null;
  location: {
    id: string;
    name: string;
    code: string;
  } | null;
};

function formatDateTime(dt: string | null | undefined) {
  if (!dt) return "";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function toInputDateTime(dt: string | null): { date: string; time: string } {
  if (!dt) return { date: "", time: "" };
  const d = new Date(dt);
  if (isNaN(d.getTime())) return { date: "", time: "" };

  const iso = d.toISOString(); // "2025-11-22T20:15:30.000Z"
  const [date, fullTime] = iso.split("T");
  const time = fullTime.slice(0, 5); // "HH:MM"
  return { date, time };
}

function combineDateTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  // Let the browser interpret local time
  return `${date}T${time}:00`;
}

function hoursBetween(clockIn: string, clockOut: string | null): number {
  const start = new Date(clockIn);
  const end = clockOut ? new Date(clockOut) : new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60);
}

export default function AdminShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("");
  const [filterLocationId, setFilterLocationId] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [adhocOnly, setAdhocOnly] = useState<boolean>(false);

  // Manual create / edit
  const [formEmployeeId, setFormEmployeeId] = useState<string>("");
  const [formLocationId, setFormLocationId] = useState<string>("");
  const [formClockInDate, setFormClockInDate] = useState<string>("");
  const [formClockInTime, setFormClockInTime] = useState<string>("");
  const [formClockOutDate, setFormClockOutDate] = useState<string>("");
  const [formClockOutTime, setFormClockOutTime] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);

  // Load base data
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        setLoading(true);
        setError(null);

        const [shiftsRes, employeesRes, locationsRes] = await Promise.all([
          fetch("/api/shifts"),
          fetch("/api/admin/employees"),
          fetch("/api/admin/locations"),
        ]);

        if (!shiftsRes.ok) throw new Error("Failed to load shifts");
        if (!employeesRes.ok) throw new Error("Failed to load employees");
        if (!locationsRes.ok) throw new Error("Failed to load locations");

        const [shiftsJson, employeesJson, locationsJson] = await Promise.all([
          shiftsRes.json(),
          employeesRes.json(),
          locationsRes.json(),
        ]);

        if (!cancelled) {
          setShifts(shiftsJson);
          setEmployees(employeesJson);
          setLocations(locationsJson);
        }
      } catch (err: any) {
        console.error("Error loading shifts page data:", err);
        if (!cancelled) {
          setError(err?.message || "Failed to load data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered list
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      if (filterEmployeeId && s.user?.id !== filterEmployeeId) {
        return false;
      }
      if (filterLocationId && s.location?.id !== filterLocationId) {
        return false;
      }

      if (adhocOnly) {
        if (!s.location || s.location.code !== "ADHOC") return false;
      }

      if (filterFrom) {
        const fromDate = new Date(filterFrom);
        const clockIn = new Date(s.clockIn);
        if (clockIn < fromDate) return false;
      }

      if (filterTo) {
        const toDate = new Date(filterTo);
        const clockIn = new Date(s.clockIn);
        if (clockIn > toDate) return false;
      }

      return true;
    });
  }, [shifts, filterEmployeeId, filterLocationId, filterFrom, filterTo, adhocOnly]);

  const totalFilteredHours = useMemo(() => {
    return filteredShifts.reduce((sum, s) => {
      return sum + hoursBetween(s.clockIn, s.clockOut);
    }, 0);
  }, [filteredShifts]);

  function resetForm() {
    setFormEmployeeId("");
    setFormLocationId("");
    setFormClockInDate("");
    setFormClockInTime("");
    setFormClockOutDate("");
    setFormClockOutTime("");
    setEditingShiftId(null);
    setSaveError(null);
  }

  function startEdit(shift: Shift) {
    setEditingShiftId(shift.id);
    setFormEmployeeId(shift.user?.id ?? "");
    setFormLocationId(shift.location?.id ?? "");

    const ci = toInputDateTime(shift.clockIn);
    const co = toInputDateTime(shift.clockOut);

    setFormClockInDate(ci.date);
    setFormClockInTime(ci.time);
    setFormClockOutDate(co.date);
    setFormClockOutTime(co.time);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);

    try {
      if (!formEmployeeId || !formLocationId || !formClockInDate || !formClockInTime) {
        setSaveError("Employee, location, and clock-in date/time are required.");
        return;
      }

      const clockInIso = combineDateTime(formClockInDate, formClockInTime);
      if (!clockInIso) {
        setSaveError("Invalid clock-in date/time.");
        return;
      }

      let clockOutIso: string | null = null;
      if (formClockOutDate && formClockOutTime) {
        clockOutIso = combineDateTime(formClockOutDate, formClockOutTime);
        if (!clockOutIso) {
          setSaveError("Invalid clock-out date/time.");
          return;
        }
      }

      if (editingShiftId) {
        // Update existing via /api/admin/shifts/:id
        const res = await fetch(`/api/admin/shifts/${editingShiftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clockIn: clockInIso,
            clockOut: clockOutIso,
            locationId: formLocationId,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update shift");
        }

        const updated = (await res.json()) as Shift;
        setShifts((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
      } else {
        // Create new via /api/shifts
        const res = await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: formEmployeeId,
            locationId: formLocationId,
            clockIn: clockInIso,
            clockOut: clockOutIso,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create shift");
        }

        const created = (await res.json()) as Shift;
        setShifts((prev) => [created, ...prev]);
      }

      resetForm();
    } catch (err: any) {
      console.error("Error saving shift:", err);
      setSaveError(err?.message || "Error saving shift");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(shiftId: string) {
    if (!window.confirm("Delete this shift? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/admin/shifts/${shiftId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete shift");
      }

      setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    } catch (err: any) {
      console.error("Error deleting shift:", err);
      alert(err?.message || "Error deleting shift");
    }
  }

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Shifts</h1>
          <p className="text-sm text-gray-600">
            View, filter, create, edit, and delete shifts. ADHOC shifts are highlighted.
          </p>
        </div>
      </header>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-800 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <section className="bg-white rounded-lg shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-semibold">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Employee
            </label>
            <select
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              className="border rounded px-2 py-1 w-full text-sm"
            >
              <option value="">All</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name || "(no name)"}{" "}
                  {emp.employeeCode ? `(${emp.employeeCode})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Location
            </label>
            <select
              value={filterLocationId}
              onChange={(e) => setFilterLocationId(e.target.value)}
              className="border rounded px-2 py-1 w-full text-sm"
            >
              <option value="">All</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              From (Clock In)
            </label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="border rounded px-2 py-1 w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              To (Clock In)
            </label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="border rounded px-2 py-1 w-full text-sm"
            />
          </div>

          <div className="flex items-center mt-5 md:mt-0">
            <label className="inline-flex items-center text-xs font-medium text-gray-700">
              <input
                type="checkbox"
                checked={adhocOnly}
                onChange={(e) => setAdhocOnly(e.target.checked)}
                className="mr-2"
              />
              ADHOC only
            </label>
          </div>
        </div>

        <div className="text-xs text-gray-600 mt-1">
          Showing {filteredShifts.length} shifts | Total hours (filtered):{" "}
          {totalFilteredHours.toFixed(2)}
        </div>
      </section>

      {/* Manual create / edit */}
      <section className="bg-white rounded-lg shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-semibold">
          {editingShiftId ? "Edit Shift" : "Create Manual Shift"}
        </h2>

        {saveError && (
          <div className="border border-red-300 bg-red-50 text-red-800 px-3 py-2 rounded text-xs">
            {saveError}
          </div>
        )}

        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Employee
            </label>
            <select
              value={formEmployeeId}
              onChange={(e) => setFormEmployeeId(e.target.value)}
              className="border rounded px-2 py-1 w-full text-sm"
              required
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name || "(no name)"}{" "}
                  {emp.employeeCode ? `(${emp.employeeCode})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Location
            </label>
            <select
              value={formLocationId}
              onChange={(e) => setFormLocationId(e.target.value)}
              className="border rounded px-2 py-1 w-full text-sm"
              required
            >
              <option value="">Select location</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Clock In
            </label>
            <div className="flex gap-1">
              <input
                type="date"
                value={formClockInDate}
                onChange={(e) => setFormClockInDate(e.target.value)}
                className="border rounded px-2 py-1 w-full text-sm"
                required
              />
              <input
                type="time"
                value={formClockInTime}
                onChange={(e) => setFormClockInTime(e.target.value)}
                className="border rounded px-2 py-1 w-full text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Clock Out (optional)
            </label>
            <div className="flex gap-1">
              <input
                type="date"
                value={formClockOutDate}
                onChange={(e) => setFormClockOutDate(e.target.value)}
                className="border rounded px-2 py-1 w-full text-sm"
              />
              <input
                type="time"
                value={formClockOutTime}
                onChange={(e) => setFormClockOutTime(e.target.value)}
                className="border rounded px-2 py-1 w-full text-sm"
              />
            </div>
          </div>

          <div className="md:col-span-4 flex items-center justify-between mt-2">
            <div className="space-x-2">
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1 rounded bg-black text-white text-sm font-semibold disabled:opacity-60"
              >
                {saving
                  ? editingShiftId
                    ? "Saving..."
                    : "Creating..."
                  : editingShiftId
                  ? "Save Changes"
                  : "Create Shift"}
              </button>
              {editingShiftId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1 rounded border text-sm"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </form>
      </section>

      {/* Shifts table */}
      <section className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-sm font-semibold mb-3">Shifts</h2>

        {loading ? (
          <div className="text-sm text-gray-600">Loading shifts…</div>
        ) : filteredShifts.length === 0 ? (
          <div className="text-sm text-gray-600">No shifts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-600">
                  <th className="text-left py-2 pr-2">Employee</th>
                  <th className="text-left py-2 pr-2">Location</th>
                  <th className="text-left py-2 pr-2">Clock In</th>
                  <th className="text-left py-2 pr-2">Clock Out</th>
                  <th className="text-left py-2 pr-2">Hours</th>
                  <th className="text-left py-2 pr-2">ADHOC / GPS</th>
                  <th className="text-right py-2 pl-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredShifts.map((s) => {
                  const isAdhoc = s.location?.code === "ADHOC";
                  const hours = hoursBetween(s.clockIn, s.clockOut);

                  const clockInMapUrl =
                    isAdhoc && s.clockInLat != null && s.clockInLng != null
                      ? `https://www.google.com/maps?q=${s.clockInLat},${s.clockInLng}`
                      : null;

                  const clockOutMapUrl =
                    isAdhoc && s.clockOutLat != null && s.clockOutLng != null
                      ? `https://www.google.com/maps?q=${s.clockOutLat},${s.clockOutLng}`
                      : null;

                  return (
                    <tr
                      key={s.id}
                      className={
                        "border-b last:border-0" +
                        (isAdhoc ? " bg-red-50" : "")
                      }
                    >
                      <td className="py-2 pr-2">
                        {s.user?.name || "(unknown)"}{" "}
                        {s.user?.employeeCode
                          ? `(${s.user.employeeCode})`
                          : ""}
                      </td>
                      <td className="py-2 pr-2">
                        {s.location
                          ? `${s.location.name} (${s.location.code})`
                          : "Unknown"}
                      </td>
                      <td className="py-2 pr-2">
                        {formatDateTime(s.clockIn)}
                      </td>
                      <td className="py-2 pr-2">
                        {formatDateTime(s.clockOut)}
                      </td>
                      <td className="py-2 pr-2">
                        {hours.toFixed(2)}
                      </td>
                      <td className="py-2 pr-2 text-xs">
                        {isAdhoc ? (
                          <div className="space-y-1">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold">
                              ADHOC
                            </span>
                            {clockInMapUrl && (
                              <div>
                                <a
                                  href={clockInMapUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  View clock-in on map
                                </a>
                              </div>
                            )}
                            {clockOutMapUrl && (
                              <div>
                                <a
                                  href={clockOutMapUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  View clock-out on map
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="py-2 pl-2 text-right space-x-2">
                        <button
                          className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                          onClick={() => startEdit(s)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs px-2 py-1 border rounded text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(s.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}