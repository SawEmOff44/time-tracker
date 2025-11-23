"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTimeLocal } from "@/lib/datetime";

type EmployeeOption = {
  id: string;
  name: string;
  employeeCode: string | null;
};

type LocationOption = {
  id: string;
  name: string;
};

type Shift = {
  id: string;
  employeeId: string; // backend naming for create
  user: {
    id: string;
    name: string;
    employeeCode: string | null;
  };
  locationId: string | null;
  location: {
    id: string;
    name: string;
  } | null;
  clockIn: string;
  clockOut: string | null;
  clockInLat: number | null;
  clockInLng: number | null;
};

type ApiShiftResponse = Shift[];

export default function AdminShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [showAdhocOnly, setShowAdhocOnly] = useState(false);

  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Create / edit form state
  const [formEmployeeId, setFormEmployeeId] = useState<string>("");
  const [formLocationId, setFormLocationId] = useState<string>("");
  const [formClockIn, setFormClockIn] = useState<string>("");
  const [formClockOut, setFormClockOut] = useState<string>("");

  // ----- helpers -----

  function isAdhocShift(shift: Shift): boolean {
    const name = shift.location?.name ?? "";
    return name.toLowerCase().includes("adhoc");
  }

  function computeHours(shift: Shift): string {
    if (!shift.clockIn || !shift.clockOut) return "—";
    const start = new Date(shift.clockIn).getTime();
    const end = new Date(shift.clockOut).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return "—";
    const hours = (end - start) / (1000 * 60 * 60);
    return `${hours.toFixed(2)}`;
  }

  function mapUrlForShift(shift: Shift): string | null {
    if (
      shift.clockInLat == null ||
      Number.isNaN(shift.clockInLat) ||
      shift.clockInLng == null ||
      Number.isNaN(shift.clockInLng)
    ) {
      return null;
    }
    return `https://www.google.com/maps?q=${shift.clockInLat},${shift.clockInLng}`;
  }

  // ----- data loading -----

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const [shiftsRes, employeesRes, locationsRes] = await Promise.all([
        fetch("/api/shifts"),
        fetch("/api/admin/employees"),
        fetch("/api/locations"),
      ]);

      if (!shiftsRes.ok) throw new Error("Failed to load shifts");
      if (!employeesRes.ok) throw new Error("Failed to load employees");
      if (!locationsRes.ok) throw new Error("Failed to load locations");

      const shiftsData = (await shiftsRes.json()) as ApiShiftResponse;
      const employeesData = (await employeesRes.json()) as any[];
      const locationsData = (await locationsRes.json()) as any[];

      setShifts(shiftsData);
      setEmployees(
        employeesData.map((e) => ({
          id: e.id,
          name: e.name,
          employeeCode: e.employeeCode,
        }))
      );
      setLocations(
        locationsData.map((l) => ({
          id: l.id,
          name: l.name,
        }))
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // ----- filtering -----

  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      if (
        filterEmployee &&
        !(
          s.user.name.toLowerCase().includes(filterEmployee.toLowerCase()) ||
          (s.user.employeeCode ?? "")
            .toLowerCase()
            .includes(filterEmployee.toLowerCase())
        )
      ) {
        return false;
      }

      if (
        filterLocation &&
        !(s.location?.name ?? "")
          .toLowerCase()
          .includes(filterLocation.toLowerCase())
      ) {
        return false;
      }

      if (showAdhocOnly && !isAdhocShift(s)) {
        return false;
      }

      return true;
    });
  }, [shifts, filterEmployee, filterLocation, showAdhocOnly]);

  // ----- form helpers -----

  function openCreateModal() {
    setEditingShift(null);
    setActionError(null);
    setFormEmployeeId("");
    setFormLocationId("");
    setFormClockIn("");
    setFormClockOut("");
    setCreateModalOpen(true);
  }

  function openEditModal(shift: Shift) {
    setEditingShift(shift);
    setActionError(null);
    setFormEmployeeId(shift.user.id);
    setFormLocationId(shift.locationId ?? "");
    // convert to datetime-local format (YYYY-MM-DDTHH:mm)
    const toLocalInput = (iso: string | null) => {
      if (!iso) return "";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      const pad = (n: number) => String(n).padStart(2, "0");
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const mins = pad(d.getMinutes());
      return `${year}-${month}-${day}T${hours}:${mins}`;
    };

    setFormClockIn(toLocalInput(shift.clockIn));
    setFormClockOut(toLocalInput(shift.clockOut));
    setCreateModalOpen(true);
  }

  function closeModal() {
    setCreateModalOpen(false);
    setEditingShift(null);
    setActionError(null);
  }

  // ----- create / update / delete -----

  async function handleSaveShift() {
    try {
      setActionLoading(true);
      setActionError(null);

      if (!formEmployeeId || !formClockIn) {
        setActionError("employeeId and clockIn are required");
        return;
      }

      const payload: any = {
        employeeId: formEmployeeId,
        locationId: formLocationId || null,
        clockIn: formClockIn ? new Date(formClockIn).toISOString() : null,
        clockOut: formClockOut ? new Date(formClockOut).toISOString() : null,
      };

      let res: Response;
      if (editingShift) {
        // update
        res = await fetch(`/api/shifts/${editingShift.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // create
        res = await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save shift");
      }

      await loadData();
      closeModal();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message ?? "Failed to save shift");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteShift(id: string) {
    if (!window.confirm("Delete this shift? This cannot be undone.")) return;

    try {
      setActionLoading(true);
      setActionError(null);

      const res = await fetch(`/api/shifts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete shift");
      }

      setShifts((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      console.error(err);
      setActionError(err.message ?? "Failed to delete shift");
    } finally {
      setActionLoading(false);
    }
  }

  // ----- render -----

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-6xl bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Shifts</h1>
            <p className="text-sm text-gray-500">
              Review and audit clock-in / clock-out activity.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadData}
              className="px-3 py-1.5 rounded border text-sm border-gray-300 hover:bg-gray-50"
            >
              Refresh
            </button>
            <button
              onClick={openCreateModal}
              className="px-4 py-1.5 rounded bg-black text-white text-sm font-medium hover:bg-gray-900"
            >
              New shift
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Filter by employee
            </label>
            <input
              className="w-full border rounded-md px-2 py-1.5 text-sm"
              placeholder="Name or code"
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Filter by location
            </label>
            <input
              className="w-full border rounded-md px-2 py-1.5 text-sm"
              placeholder="Location name"
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={showAdhocOnly}
              onChange={(e) => setShowAdhocOnly(e.target.checked)}
            />
            Show ADHOC only
          </label>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-left">Clock in</th>
                <th className="px-3 py-2 text-left">Clock out</th>
                <th className="px-3 py-2 text-left">Hours</th>
                <th className="px-3 py-2 text-left">ADHOC</th>
                <th className="px-3 py-2 text-left">Map</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-gray-500"
                  >
                    Loading shifts…
                  </td>
                </tr>
              ) : filteredShifts.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-gray-500"
                  >
                    No shifts found for the current filters.
                  </td>
                </tr>
              ) : (
                filteredShifts.map((s) => {
                  const adhoc = isAdhocShift(s);
                  const mapUrl = mapUrlForShift(s);
                  return (
                    <tr key={s.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium text-gray-900">
                          {s.user.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {s.user.employeeCode ?? "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {s.location?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {formatDateTimeLocal(s.clockIn)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {formatDateTimeLocal(s.clockOut)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {computeHours(s)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {adhoc ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            ADHOC
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {mapUrl ? (
                          <a
                            href={mapUrl}
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
                      <td className="px-3 py-2 align-top">
                        <button
                          onClick={() => openEditModal(s)}
                          className="text-xs text-blue-600 hover:underline mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteShift(s.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {actionError && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {actionError}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg max-w-3xl w-full mx-4 p-6 relative">
            <button
              className="absolute top-3 right-3 text-sm text-gray-500 hover:text-gray-800"
              onClick={closeModal}
            >
              ✕
            </button>

            <h2 className="text-lg font-semibold mb-4">
              {editingShift ? "Edit shift" : "Create manual shift"}
            </h2>

            {actionError && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {actionError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Employee
                </label>
                <select
                  className="w-full border rounded-md px-2 py-1.5 text-sm"
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                      {e.employeeCode ? ` (${e.employeeCode})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Location
                </label>
                <select
                  className="w-full border rounded-md px-2 py-1.5 text-sm"
                  value={formLocationId}
                  onChange={(e) => setFormLocationId(e.target.value)}
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
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Clock in
                </label>
                <input
                  type="datetime-local"
                  className="w-full border rounded-md px-2 py-1.5 text-sm"
                  value={formClockIn}
                  onChange={(e) => setFormClockIn(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Clock out
                </label>
                <input
                  type="datetime-local"
                  className="w-full border rounded-md px-2 py-1.5 text-sm"
                  value={formClockOut}
                  onChange={(e) => setFormClockOut(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={closeModal}
                className="px-4 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveShift}
                disabled={actionLoading}
                className="px-5 py-1.5 rounded bg-black text-white text-sm font-medium disabled:opacity-60"
              >
                {actionLoading
                  ? editingShift
                    ? "Saving…"
                    : "Creating…"
                  : editingShift
                  ? "Save changes"
                  : "Create shift"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}