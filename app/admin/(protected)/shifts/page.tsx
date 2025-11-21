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

function formatDateTime(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// For <input type="datetime-local"> (YYYY-MM-DDTHH:MM)
function toLocalInputValue(isoString: string | null): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${mins}`;
}

function fromLocalInputValue(val: string): string | null {
  if (!val) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatDateInput(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type EditState = {
  clockIn: string;
  clockOut: string;
};

export default function ShiftsAdminPage() {
  const today = useMemo(() => new Date(), []);

  // default range: last 7 days
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatDateInput(d);
  });
  const [toDate, setToDate] = useState(() => formatDateInput(today));
  const [onlyOpen, setOnlyOpen] = useState(false);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [autoLoaded, setAutoLoaded] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Manual create state
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [newLocationId, setNewLocationId] = useState("");
  const [newClockIn, setNewClockIn] = useState("");
  const [newClockOut, setNewClockOut] = useState("");
  const [creating, setCreating] = useState(false);

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

  async function loadMeta() {
    try {
      setLoadingMeta(true);
      setError(null);

      const [empRes, locRes] = await Promise.all([
        fetch("/api/admin/employees"),
        fetch("/api/admin/locations"),
      ]);

      const empData = (await empRes.json().catch(() => ({}))) as
        | Employee[]
        | { error?: string };
      const locData = (await locRes.json().catch(() => ({}))) as
        | Location[]
        | { error?: string };

      if (!empRes.ok) {
        throw new Error(
          (empData as any).error ||
            `Failed to load employees (status ${empRes.status})`
        );
      }
      if (!locRes.ok) {
        throw new Error(
          (locData as any).error ||
            `Failed to load locations (status ${locRes.status})`
        );
      }

      // sort employees by name, locations by name
      const employeesSorted = (empData as Employee[]).slice().sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      const locationsSorted = (locData as Location[]).slice().sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      setEmployees(employeesSorted);
      setLocations(locationsSorted);

      // default selections if blank
      if (!newEmployeeId && employeesSorted.length > 0) {
        setNewEmployeeId(employeesSorted[0].id);
      }
      if (!newLocationId && locationsSorted.length > 0) {
        setNewLocationId(locationsSorted[0].id);
      }
    } catch (err: any) {
      console.error("loadMeta error:", err);
      setError(err.message || "Failed to load employees/locations");
    } finally {
      setLoadingMeta(false);
    }
  }

  useEffect(() => {
    if (!autoLoaded) {
      setAutoLoaded(true);
      loadShifts();
      loadMeta();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoaded]);

  const filteredShifts = useMemo(() => {
    if (!onlyOpen) return shifts;
    return shifts.filter((s) => s.clockOut === null);
  }, [shifts, onlyOpen]);

  const totalHours = useMemo(
    () =>
      filteredShifts.reduce(
        (sum, s) => sum + hoursBetween(s.clockIn, s.clockOut),
        0
      ),
    [filteredShifts]
  );

  function startEditing(shift: Shift) {
    setEditingId(shift.id);
    setEditState({
      clockIn: toLocalInputValue(shift.clockIn),
      clockOut: toLocalInputValue(shift.clockOut),
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditState(null);
  }

  async function saveEdit(shiftId: string) {
    if (!editState) return;

    const { clockIn, clockOut } = editState;
    const ciIso = fromLocalInputValue(clockIn);
    const coIso = clockOut ? fromLocalInputValue(clockOut) : null;

    if (!ciIso) {
      setError("Invalid clock-in datetime");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/shifts/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clockIn: ciIso,
          clockOut: coIso,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Failed to update shift");
      }

      await loadShifts();
      cancelEditing();
    } catch (err: any) {
      console.error("saveEdit error:", err);
      setError(err.message || "Failed to update shift");
    } finally {
      setSaving(false);
    }
  }

  async function closeNow(shift: Shift) {
    const nowIso = new Date().toISOString();

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/shifts/${shift.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clockOut: nowIso,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Failed to close shift");
      }

      await loadShifts();
    } catch (err: any) {
      console.error("closeNow error:", err);
      setError(err.message || "Failed to close shift");
    } finally {
      setSaving(false);
    }
  }

  async function deleteShift(id: string) {
    if (!confirm("Delete this shift permanently?")) return;

    setDeletingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/shifts/${id}`, {
        method: "DELETE",
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete shift");
      }

      await loadShifts();
    } catch (err: any) {
      console.error("deleteShift error:", err);
      setError(err.message || "Failed to delete shift");
    } finally {
      setDeletingId(null);
    }
  }

  async function createShift() {
    setError(null);

    if (!newEmployeeId) {
      setError("Select an employee");
      return;
    }
    if (!newLocationId) {
      setError("Select a location");
      return;
    }
    if (!newClockIn) {
      setError("Clock-in time is required");
      return;
    }

    const ciIso = fromLocalInputValue(newClockIn);
    const coIso = newClockOut ? fromLocalInputValue(newClockOut) : null;

    if (!ciIso) {
      setError("Invalid clock-in datetime");
      return;
    }

    setCreating(true);

    try {
      const res = await fetch("/api/admin/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: newEmployeeId,
          locationId: newLocationId,
          clockIn: ciIso,
          clockOut: coIso,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Failed to create shift");
      }

      // reset fields but keep employee/location selected
      setNewClockIn("");
      setNewClockOut("");

      await loadShifts();
    } catch (err: any) {
      console.error("createShift error:", err);
      setError(err.message || "Failed to create shift");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="space-y-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Shifts / Fix Punches</h1>
          <p className="text-sm text-gray-600">
            View and correct clock-in / clock-out times, or create manual
            shifts for missed punches.
          </p>
        </div>
      </header>

      {/* Create Manual Shift */}
      <section className="bg-white shadow rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-semibold">Create Manual Shift</h2>
        <p className="text-xs text-gray-500">
          Use this when someone forgot to clock in or out, or for cleanup
          after-the-fact.
        </p>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-4 items-end">
          {/* Employee */}
          <div>
            <label className="block text-sm font-medium mb-1">Employee</label>
            <select
              className="border rounded px-2 py-1 w-full text-sm"
              value={newEmployeeId}
              onChange={(e) => setNewEmployeeId(e.target.value)}
              disabled={loadingMeta}
            >
              {loadingMeta && (
                <option value="">Loading employees...</option>
              )}
              {!loadingMeta && employees.length === 0 && (
                <option value="">No employees found</option>
              )}
              {!loadingMeta &&
                employees.length > 0 &&
                employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}{" "}
                    {emp.employeeCode ? `(${emp.employeeCode})` : ""}
                  </option>
                ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <select
              className="border rounded px-2 py-1 w-full text-sm"
              value={newLocationId}
              onChange={(e) => setNewLocationId(e.target.value)}
              disabled={loadingMeta}
            >
              {loadingMeta && (
                <option value="">Loading locations...</option>
              )}
              {!loadingMeta && locations.length === 0 && (
                <option value="">No locations found</option>
              )}
              {!loadingMeta &&
                locations.length > 0 &&
                locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
            </select>
          </div>

          {/* Clock In */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Clock In (required)
            </label>
            <input
              type="datetime-local"
              className="border rounded px-2 py-1 w-full text-sm"
              value={newClockIn}
              onChange={(e) => setNewClockIn(e.target.value)}
            />
          </div>

          {/* Clock Out */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Clock Out (optional)
            </label>
            <input
              type="datetime-local"
              className="border rounded px-2 py-1 w-full text-sm"
              value={newClockOut}
              onChange={(e) => setNewClockOut(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={createShift}
            disabled={creating || loadingMeta}
            className="px-4 py-2 rounded bg-black text-white text-sm font-semibold disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create Shift"}
          </button>
        </div>
      </section>

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
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            <input
              id="onlyOpen"
              type="checkbox"
              className="h-4 w-4"
              checked={onlyOpen}
              onChange={(e) => setOnlyOpen(e.target.checked)}
            />
            <label
              htmlFor="onlyOpen"
              className="text-sm text-gray-700 select-none"
            >
              Only show open shifts (no clock-out)
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={loadShifts}
              disabled={loading}
              className="px-4 py-2 rounded bg-black text-white text-sm font-semibold disabled:opacity-60"
            >
              {loading ? "Loading..." : "Apply"}
            </button>
          </div>
        </div>
        {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
      </section>

      {/* Summary + Fix Punch Table */}
      <section className="bg-white shadow rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Shifts ({filteredShifts.length})
          </h2>
          <div className="text-xs text-gray-500">
            Total hours (completed): {formatHours(totalHours)} hrs
          </div>
        </div>

        {loading && (
          <div className="text-sm text-gray-500">Loading shifts...</div>
        )}

        {!loading && filteredShifts.length === 0 ? (
          <div className="text-sm text-gray-500">
            No shifts found for this range/filter.
          </div>
        ) : null}

        {!loading && filteredShifts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 pr-2">Employee</th>
                  <th className="text-left py-1 pr-2">Code</th>
                  <th className="text-left py-1 pr-2">Location</th>
                  <th className="text-left py-1 pr-2">Clock In</th>
                  <th className="text-left py-1 pr-2">Clock Out</th>
                  <th className="text-right py-1 pr-2">Hours</th>
                  <th className="text-left py-1 pr-2">Status</th>
                  <th className="text-left py-1 pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredShifts.map((shift) => {
                  const isEditing = editingId === shift.id;
                  const hours = hoursBetween(shift.clockIn, shift.clockOut);
                  const open = shift.clockOut === null;

                  return (
                    <tr key={shift.id} className="border-b align-top">
                      <td className="py-1 pr-2">
                        {shift.user?.name || "Unknown"}
                      </td>
                      <td className="py-1 pr-2">
                        {shift.user?.employeeCode || "—"}
                      </td>
                      <td className="py-1 pr-2">
                        {shift.location?.name || "Unknown"}
                      </td>

                      {/* Clock In */}
                      <td className="py-1 pr-2">
                        {isEditing && editState ? (
                          <input
                            type="datetime-local"
                            className="border rounded px-1 py-0.5 text-xs w-full"
                            value={editState.clockIn}
                            onChange={(e) =>
                              setEditState((prev) =>
                                prev
                                  ? { ...prev, clockIn: e.target.value }
                                  : prev
                              )
                            }
                          />
                        ) : (
                          formatDateTime(shift.clockIn)
                        )}
                      </td>

                      {/* Clock Out */}
                      <td className="py-1 pr-2">
                        {isEditing && editState ? (
                          <input
                            type="datetime-local"
                            className="border rounded px-1 py-0.5 text-xs w-full"
                            value={editState.clockOut}
                            onChange={(e) =>
                              setEditState((prev) =>
                                prev
                                  ? { ...prev, clockOut: e.target.value }
                                  : prev
                              )
                            }
                          />
                        ) : (
                          formatDateTime(shift.clockOut)
                        )}
                      </td>

                      {/* Hours */}
                      <td className="py-1 pr-2 text-right">
                        {shift.clockOut ? formatHours(hours) : "—"}
                      </td>

                      {/* Status */}
                      <td className="py-1 pr-2">
                        {open ? (
                          <span className="text-xs font-semibold text-orange-600">
                            Open (no clock-out)
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">
                            Complete
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-1 pr-2 space-x-2 whitespace-nowrap">
                        {open && !isEditing && (
                          <button
                            onClick={() => closeNow(shift)}
                            disabled={saving}
                            className="px-2 py-1 text-xs rounded border border-green-500 text-green-700"
                          >
                            Close Now
                          </button>
                        )}

                        {!isEditing ? (
                          <button
                            onClick={() => startEditing(shift)}
                            className="px-2 py-1 text-xs rounded border"
                          >
                            Edit
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => saveEdit(shift.id)}
                              disabled={saving}
                              className="px-2 py-1 text-xs rounded border border-blue-500 text-blue-600"
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="px-2 py-1 text-xs rounded border"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => deleteShift(shift.id)}
                          disabled={deletingId === shift.id}
                          className="px-2 py-1 text-xs rounded border border-red-500 text-red-600"
                        >
                          {deletingId === shift.id ? "Deleting..." : "Delete"}
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