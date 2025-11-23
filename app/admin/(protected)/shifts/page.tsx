"use client";

import { useEffect, useMemo, useState } from "react";

type Shift = any;
type Employee = any;
type Location = any;

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function toLocalInputValue(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export default function AdminShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [employeeFilter, setEmployeeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [showAdhocOnly, setShowAdhocOnly] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formLocationId, setFormLocationId] = useState("");
  const [formClockIn, setFormClockIn] = useState("");
  const [formClockOut, setFormClockOut] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  async function fetchShifts() {
    try {
      setError(null);
      const res = await fetch("/api/admin/shifts");
      if (!res.ok) throw new Error("Failed to load shifts");
      const data = await res.json();
      setShifts(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load shifts");
    }
  }

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const [shiftRes, empRes, locRes] = await Promise.all([
          fetch("/api/admin/shifts"),
          fetch("/api/admin/employees"),
          fetch("/api/admin/locations"),
        ]);

        if (!shiftRes.ok) throw new Error("Failed to load shifts");
        if (!empRes.ok) throw new Error("Failed to load employees");
        if (!locRes.ok) throw new Error("Failed to load locations");

        const [shiftData, empData, locData] = await Promise.all([
          shiftRes.json(),
          empRes.json(),
          locRes.json(),
        ]);

        setShifts(shiftData);
        setEmployees(empData);
        setLocations(locData);
      } catch (err) {
        console.error(err);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, []);

  const filteredShifts = useMemo(
    () =>
      shifts.filter((s: Shift) => {
        const empName = s.user?.name?.toLowerCase() ?? "";
        const empCode = s.user?.employeeCode?.toLowerCase() ?? "";
        const locName = s.location?.name?.toLowerCase() ?? "";
        const adhocName = s.adhocLocationName?.toLowerCase() ?? "";

        if (
          employeeFilter &&
          !empName.includes(employeeFilter.toLowerCase()) &&
          !empCode.includes(employeeFilter.toLowerCase())
        ) {
          return false;
        }

        if (
          locationFilter &&
          !locName.includes(locationFilter.toLowerCase()) &&
          !adhocName.includes(locationFilter.toLowerCase())
        ) {
          return false;
        }

        if (showAdhocOnly && !s.isAdhoc) return false;

        return true;
      }),
    [shifts, employeeFilter, locationFilter, showAdhocOnly]
  );

  function resetForm() {
    setEditingShiftId(null);
    setFormEmployeeId("");
    setFormLocationId("");
    setFormClockIn("");
    setFormClockOut("");
    setFormError(null);
  }

  function openCreateForm() {
    resetForm();
    setFormOpen(true);
  }

  function openEditForm(shift: Shift) {
    setEditingShiftId(shift.id);
    setFormEmployeeId(shift.user?.id ?? "");
    setFormLocationId(shift.location?.id ?? "");
    setFormClockIn(toLocalInputValue(shift.clockIn));
    setFormClockOut(toLocalInputValue(shift.clockOut));
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSaveShift(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!formEmployeeId || !formClockIn) {
      setFormError("Employee and clock-in are required.");
      return;
    }

    const payload: any = {
      userId: formEmployeeId,
      locationId: formLocationId || null,
      clockIn: new Date(formClockIn).toISOString(),
      clockOut: formClockOut ? new Date(formClockOut).toISOString() : null,
    };

    setFormSaving(true);
    try {
      let res: Response;

      if (editingShiftId) {
        res = await fetch(`/api/admin/shifts/${editingShiftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/admin/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save shift");
      }

      await fetchShifts();
      setFormOpen(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Failed to save shift");
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDeleteShift(id: string) {
    if (!window.confirm("Delete this shift? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/admin/shifts/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete shift");
      }

      await fetchShifts();
    } catch (err) {
      console.error(err);
      alert("Failed to delete shift. Check console/logs for details.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Shifts</h1>
          <p className="text-sm text-gray-500">
            Review and manage clock-in / clock-out activity.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fetchShifts()}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded bg-black px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-900"
          >
            New manual shift
          </button>
        </div>
      </div>

      {/* Manual shift form */}
      {formOpen && (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">
              {editingShiftId ? "Edit shift" : "Create manual shift"}
            </h2>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                resetForm();
              }}
              className="text-xs text-gray-500 hover:text-gray-800"
            >
              Close
            </button>
          </div>

          {formError && (
            <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">
              {formError}
            </div>
          )}

          <form
            onSubmit={handleSaveShift}
            className="grid grid-cols-1 gap-3 md:grid-cols-5 md:items-end"
          >
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Employee
              </label>
              <select
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={formEmployeeId}
                onChange={(e) => setFormEmployeeId(e.target.value)}
                required
              >
                <option value="">Select employee…</option>
                {employees.map((emp: Employee) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                    {emp.employeeCode ? ` (${emp.employeeCode})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Location
              </label>
              <select
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={formLocationId}
                onChange={(e) => setFormLocationId(e.target.value)}
              >
                <option value="">None / ADHOC</option>
                {locations.map((loc: Location) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Clock in
              </label>
              <input
                type="datetime-local"
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={formClockIn}
                onChange={(e) => setFormClockIn(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Clock out
              </label>
              <input
                type="datetime-local"
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={formClockOut}
                onChange={(e) => setFormClockOut(e.target.value)}
              />
            </div>

            <div className="md:col-span-5 flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  resetForm();
                }}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formSaving}
                className="rounded bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-900 disabled:opacity-60"
              >
                {formSaving
                  ? editingShiftId
                    ? "Saving…"
                    : "Creating…"
                  : editingShiftId
                  ? "Save changes"
                  : "Create shift"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 md:flex-row">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Filter by employee
            </label>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="Name or code"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Filter by location
            </label>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="Location name"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            />
          </div>
        </div>
        <label className="mt-1 inline-flex items-center gap-2 text-xs text-gray-700 md:mt-5">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300"
            checked={showAdhocOnly}
            onChange={(e) => setShowAdhocOnly(e.target.checked)}
          />
          Show ADHOC only
        </label>
      </div>

      {/* Error / loading */}
      {error && (
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {loading && (
        <div className="text-sm text-gray-500">Loading shifts…</div>
      )}

      {/* Table */}
      {!loading && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Employee
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Location
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Clock in
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Clock out
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Hours
                </th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  ADHOC
                </th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Map
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredShifts.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center text-sm text-gray-500"
                  >
                    No shifts match the current filters.
                  </td>
                </tr>
              ) : (
                filteredShifts.map((s: Shift) => {
                  const name = s.user?.name ?? "—";
                  const code = s.user?.employeeCode
                    ? ` (${s.user.employeeCode})`
                    : "";
                  const locationLabel =
                    s.location?.name ??
                    s.adhocLocationName ??
                    "Adhoc Job Site";

                  let hoursDisplay: string | number = "—";
                  if (typeof s.hours === "number") {
                    hoursDisplay = s.hours.toFixed(2);
                  } else if (s.hours != null) {
                    hoursDisplay = s.hours;
                  }

                  const hasMap =
                    s.clockInLat != null && s.clockInLng != null;

                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">
                          {name}
                        </div>
                        {code && (
                          <div className="text-xs text-gray-500">
                            {code}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {locationLabel}
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        {formatDate(s.clockIn)}
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        {formatDate(s.clockOut)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {hoursDisplay}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {s.isAdhoc ? (
                          <span className="inline-flex rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-800">
                            ADHOC
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {hasMap ? (
                          <a
                            href={`https://www.google.com/maps?q=${s.clockInLat},${s.clockInLng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-blue-600 hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(s)}
                            className="text-xs font-medium text-gray-700 hover:text-gray-900"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteShift(s.id)}
                            className="text-xs font-medium text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}