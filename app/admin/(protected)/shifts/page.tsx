"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";

type Employee = {
  id: string;
  name: string;
  employeeCode: string | null;
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
  userId: string;
  locationId: string | null;
  clockIn: string;
  clockOut: string | null;
  notes: string | null;
  user?: {
    id: string;
    name: string;
    employeeCode: string | null;
  };
  location?: {
    id: string;
    name: string;
    code: string;
  } | null;
};

function formatDateTime(dt: string | null) {
  if (!dt) return "";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function toDateTimeLocalValue(dt: string | null): string {
  if (!dt) return "";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function diffHours(clockIn: string, clockOut: string | null): number | null {
  if (!clockIn || !clockOut) return null;
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  if (isNaN(start) || isNaN(end)) return null;
  const ms = end - start;
  if (ms <= 0) return 0;
  return ms / (1000 * 60 * 60);
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterLocationId, setFilterLocationId] = useState("");

  // Editing
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editLocationId, setEditLocationId] = useState<string>("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---------------------------
  // Load employees & locations
  // ---------------------------
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
      console.error(err);
      setError(err.message || "Failed to load employees/locations");
    }
  }

  // ---------------------------
  // Load shifts with filters
  // ---------------------------
  async function loadShifts() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (fromDate) {
        // Convert date-only to an ISO so backend can just new Date()
        params.set(fromDateKey, new Date(fromDate + "T00:00:00").toISOString());
      }
      if (toDate) {
        params.set(toDateKey, new Date(toDate + "T23:59:59").toISOString());
      }
      if (filterEmployeeId) {
        params.set("employeeId", filterEmployeeId);
      }
      if (filterLocationId) {
        params.set("locationId", filterLocationId);
      }

      // To keep things explicit:
      const query = params.toString();
      const url = query ? `/api/shifts?${query}` : "/api/shifts";

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to load shifts");
      }

      setShifts(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  }

  // NOTE: these keys must match the API implementation above
  const fromDateKey = "from";
  const toDateKey = "to";

  useEffect(() => {
    (async () => {
      await loadEmployeesAndLocations();
      await loadShifts();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------
  // Filter submit
  // ---------------------------
  function handleFilterSubmit(e: FormEvent) {
    e.preventDefault();
    loadShifts();
  }

  // ---------------------------
  // Open edit form
  // ---------------------------
  function startEdit(shift: Shift) {
    setEditingShift(shift);
    setEditClockIn(toDateTimeLocalValue(shift.clockIn));
    setEditClockOut(toDateTimeLocalValue(shift.clockOut));
    setEditLocationId(shift.locationId || "");
    setEditNotes(shift.notes || "");
  }

  // ---------------------------
  // Save edit
  // ---------------------------
  async function handleEditSave(e: FormEvent) {
    e.preventDefault();
    if (!editingShift) return;

    setSavingEdit(true);
    setError(null);

    try {
      const payload: any = {};

      if (editClockIn) {
        payload.clockIn = new Date(editClockIn).toISOString();
      }
      if (editClockOut) {
        payload.clockOut = new Date(editClockOut).toISOString();
      } else {
        payload.clockOut = null;
      }

      payload.locationId = editLocationId || null;
      payload.notes = editNotes;

      const res = await fetch(`/api/admin/shifts/${editingShift.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to update shift");
      }

      setEditingShift(null);
      await loadShifts();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to update shift");
    } finally {
      setSavingEdit(false);
    }
  }

  // ---------------------------
  // Delete shift
  // ---------------------------
  async function handleDelete(id: string) {
    const shift = shifts.find((s) => s.id === id);
    const label = shift
      ? `${shift.user?.name ?? "Unknown"} @ ${shift.location?.name ?? "Unknown"}`
      : id;

    const ok = window.confirm(`Delete this shift for "${label}"?`);
    if (!ok) return;

    setDeletingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/shifts/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to delete shift");
      }

      await loadShifts();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to delete shift");
    } finally {
      setDeletingId(null);
    }
  }

  const totalHours = useMemo(() => {
    let sum = 0;
    for (const s of shifts) {
      const h = diffHours(s.clockIn, s.clockOut);
      if (h && h > 0) sum += h;
    }
    return sum;
  }, [shifts]);

  return (
    <div className="max-w-6xl mx-auto py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Shifts</h1>
        <div className="text-sm text-gray-600">
          Total hours in view:{" "}
          <span className="font-semibold">
            {totalHours.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-100 text-red-800 px-4 py-2 rounded">
          {error}
        </div>
      )}

      {/* Filters */}
      <form
        onSubmit={handleFilterSubmit}
        className="bg-white shadow rounded p-4 grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div>
          <label className="text-sm font-medium">From Date</label>
          <input
            type="date"
            className="border rounded px-2 py-1 w-full"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium">To Date</label>
          <input
            type="date"
            className="border rounded px-2 py-1 w-full"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Employee</label>
          <select
            className="border rounded px-2 py-1 w-full"
            value={filterEmployeeId}
            onChange={(e) => setFilterEmployeeId(e.target.value)}
          >
            <option value="">All</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} {emp.employeeCode ? `(${emp.employeeCode})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Location</label>
          <select
            className="border rounded px-2 py-1 w-full"
            value={filterLocationId}
            onChange={(e) => setFilterLocationId(e.target.value)}
          >
            <option value="">All</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.code})
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-4 flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 rounded bg-black text-white text-sm"
          >
            Apply Filters
          </button>
        </div>
      </form>

      {/* Shifts Table */}
      <div className="bg-white shadow rounded p-4">
        {loading ? (
          <p>Loading shifts...</p>
        ) : shifts.length === 0 ? (
          <p className="text-sm text-gray-500">No shifts found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Employee</th>
                  <th className="text-left py-2 px-2">Location</th>
                  <th className="text-left py-2 px-2">Clock In</th>
                  <th className="text-left py-2 px-2">Clock Out</th>
                  <th className="text-right py-2 px-2">Hours</th>
                  <th className="text-left py-2 px-2">Notes</th>
                  <th className="text-right py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => {
                  const h = diffHours(s.clockIn, s.clockOut);
                  return (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-1 px-2">
                        {s.user?.name ?? "Unknown"}
                        {s.user?.employeeCode
                          ? ` (${s.user.employeeCode})`
                          : ""}
                      </td>
                      <td className="py-1 px-2">
                        {s.location?.name ?? "Unknown"}
                      </td>
                      <td className="py-1 px-2">
                        {formatDateTime(s.clockIn)}
                      </td>
                      <td className="py-1 px-2">
                        {formatDateTime(s.clockOut)}
                      </td>
                      <td className="py-1 px-2 text-right">
                        {h != null ? h.toFixed(2) : "-"}
                      </td>
                      <td className="py-1 px-2 max-w-xs truncate">
                        {s.notes || ""}
                      </td>
                      <td className="py-1 px-2 text-right space-x-2">
                        <button
                          onClick={() => startEdit(s)}
                          className="text-xs px-2 py-1 border rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={deletingId === s.id}
                          className="text-xs px-2 py-1 border border-red-500 text-red-600 rounded disabled:opacity-50"
                        >
                          {deletingId === s.id ? "Deleting..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Panel */}
      {editingShift && (
        <form
          onSubmit={handleEditSave}
          className="bg-white shadow rounded p-4 space-y-3"
        >
          <h2 className="text-lg font-semibold">
            Edit Shift – {editingShift.user?.name ?? "Unknown"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Clock In</label>
              <input
                type="datetime-local"
                className="border rounded px-2 py-1 w-full"
                value={editClockIn}
                onChange={(e) => setEditClockIn(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Clock Out</label>
              <input
                type="datetime-local"
                className="border rounded px-2 py-1 w-full"
                value={editClockOut}
                onChange={(e) => setEditClockOut(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Leave blank to keep shift open (no clock out yet).
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Location</label>
              <select
                className="border rounded px-2 py-1 w-full"
                value={editLocationId}
                onChange={(e) => setEditLocationId(e.target.value)}
              >
                <option value="">(None)</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <textarea
                className="border rounded px-2 py-1 w-full"
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingShift(null)}
              className="px-4 py-2 border rounded text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-4 py-2 bg-black text-white rounded text-sm disabled:opacity-50"
            >
              {savingEdit ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}