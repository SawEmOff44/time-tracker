"use client";

import { useEffect, useState } from "react";
import { adminFetch, AdminAuthError } from "@/lib/adminFetch";

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
};

type Shift = any; // keep this loose to avoid Prisma-type drift headaches

type Mode = "create" | "edit";

function toLocalInputValue(date: string | Date | null | undefined) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toISOOrNull(value: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatDisplayDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function computeHours(clockIn: string | Date, clockOut: string | Date | null) {
  if (!clockOut) return "—";
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return "—";
  }
  const diffMs = end.getTime() - start.getTime();
  const hours = diffMs / (1000 * 60 * 60);
  return hours.toFixed(2);
}

export default function AdminShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [employeeFilter, setEmployeeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [adhocOnly, setAdhocOnly] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<Mode>("create");
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formUserId, setFormUserId] = useState("");
  const [formLocationId, setFormLocationId] = useState<string | null>(null);
  const [formClockIn, setFormClockIn] = useState("");
  const [formClockOut, setFormClockOut] = useState("");

  const [selectedShifts, setSelectedShifts] = useState<Set<string>>(new Set());
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false);
  const [bulkLocationId, setBulkLocationId] = useState<string | null>(null);

  async function loadEmployeesAndLocations() {
    try {
      const [empRes, locRes] = await Promise.all([
        adminFetch("/api/admin/employees"),
        adminFetch("/api/admin/locations"),
      ]);
      if (!empRes.ok) throw new Error("Failed to load employees");
      if (!locRes.ok) throw new Error("Failed to load locations");
      const emps = (await empRes.json()) as Employee[];
      const locs = (await locRes.json()) as Location[];
      setEmployees(emps);
      setLocations(locs);
    } catch (err: any) {
      console.error("Error loading employees or locations", err);
      if (err instanceof AdminAuthError) {
        setError("Your admin session has expired. Please log in again.");
      } else {
        setError("Failed to load employees or locations.");
      }
    }
  }

  async function loadShifts() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (employeeFilter.trim()) {
        params.set("employee", employeeFilter.trim());
      }
      if (locationFilter.trim()) {
        params.set("location", locationFilter.trim());
      }
      if (adhocOnly) {
        params.set("adhocOnly", "true");
      }

      const url = `/api/admin/shifts${params.toString() ? `?${params.toString()}` : ""}`;

      const res = await adminFetch(url, { cache: "no-store" });
      const data = (await res.json()) as Shift[];
      setShifts(data);
    } catch (err: any) {
      console.error("Error loading shifts", err);
      if (err instanceof AdminAuthError) {
        setError("Your admin session has expired. Please log in again.");
      } else {
        setError("Failed to load shifts.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployeesAndLocations();
  }, []);

  useEffect(() => {
    loadShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeFilter, locationFilter, adhocOnly]);

  function openCreateModal() {
    setModalMode("create");
    setEditingShift(null);
    setModalError(null);
    setFormUserId("");
    setFormLocationId(null);
    setFormClockIn("");
    setFormClockOut("");
    setModalOpen(true);
  }

  function openEditModal(shift: Shift) {
    setModalMode("edit");
    setEditingShift(shift);
    setModalError(null);
    setFormUserId(shift.userId);
    setFormLocationId(shift.locationId);
    setFormClockIn(toLocalInputValue(shift.clockIn));
    setFormClockOut(toLocalInputValue(shift.clockOut));
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingShift(null);
    setModalError(null);
  }

  async function handleSaveShift() {
    try {
      setSaving(true);
      setModalError(null);

      const clockInISO = toISOOrNull(formClockIn);
      const clockOutISO = toISOOrNull(formClockOut || "");

      if (!formUserId || !clockInISO) {
        setModalError("Employee and clock-in are required.");
        return;
      }

      const body: any = {
        userId: formUserId,
        locationId: formLocationId || null,
        clockIn: clockInISO,
        clockOut: clockOutISO,
      };

      let res: Response;

      if (modalMode === "create") {
        res = await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/shifts/${editingShift!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        console.error("Shift save error:", data);
        setModalError(data.error || "Failed to save shift.");
        return;
      }

      closeModal();
      loadShifts();
    } catch (err) {
      console.error(err);
      setModalError("Failed to save shift.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteShift(id: string) {
    if (!confirm("Delete this shift?")) return;

    try {
      const res = await fetch(`/api/shifts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        console.error("Delete error:", data);
        setError(data.error || "Failed to delete shift");
        return;
      }
      loadShifts();
    } catch (err) {
      console.error(err);
      setError("Failed to delete shift");
    }
  }

  function toggleShiftSelection(id: string) {
    const newSelected = new Set(selectedShifts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedShifts(newSelected);
  }

  function toggleSelectAll() {
    if (selectedShifts.size === shifts.length) {
      setSelectedShifts(new Set());
    } else {
      setSelectedShifts(new Set(shifts.map((s: Shift) => s.id)));
    }
  }

  async function handleBulkDelete() {
    if (selectedShifts.size === 0) return;
    if (!confirm(`Delete ${selectedShifts.size} selected shift(s)?`)) return;

    try {
      setLoading(true);
      const deletePromises = Array.from(selectedShifts).map(id =>
        fetch(`/api/shifts/${id}`, { method: "DELETE" })
      );
      await Promise.all(deletePromises);
      setSelectedShifts(new Set());
      await loadShifts();
    } catch (err) {
      console.error(err);
      setError("Failed to delete some shifts");
    } finally {
      setLoading(false);
    }
  }

  function openBulkEditModal() {
    if (selectedShifts.size === 0) return;
    setBulkLocationId(null);
    setBulkEditModalOpen(true);
  }

  async function handleBulkEditLocation() {
    if (selectedShifts.size === 0) return;

    try {
      setLoading(true);
      const updatePromises = Array.from(selectedShifts).map(id => {
        const shift = shifts.find((s: Shift) => s.id === id);
        if (!shift) return Promise.resolve();
        return fetch(`/api/shifts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: shift.userId,
            locationId: bulkLocationId,
            clockIn: shift.clockIn,
            clockOut: shift.clockOut,
          }),
        });
      });
      await Promise.all(updatePromises);
      setSelectedShifts(new Set());
      setBulkEditModalOpen(false);
      await loadShifts();
    } catch (err) {
      console.error(err);
      setError("Failed to update some shifts");
    } finally {
      setLoading(false);
    }
  }

  function exportToCSV() {
    const headers = ['Employee', 'Employee Code', 'Location', 'Clock In', 'Clock Out', 'Hours', 'ADHOC', 'Latitude', 'Longitude'];
    const rows = shifts.map((shift: Shift) => {
      const isAdhoc = shift.location?.code === adhocCode || shift.location?.name?.toLowerCase().includes("adhoc");
      const hoursStr = computeHours(shift.clockIn, shift.clockOut);
      return [
        shift.user?.name || '',
        shift.user?.employeeCode || '',
        shift.location?.name || '',
        new Date(shift.clockIn).toLocaleString(),
        shift.clockOut ? new Date(shift.clockOut).toLocaleString() : '',
        hoursStr === '—' ? '' : hoursStr,
        isAdhoc ? 'Yes' : 'No',
        shift.clockInLat || '',
        shift.clockInLng || '',
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shifts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function mapUrlForShift(shift: Shift) {
    const lat = shift.clockInLat ?? shift.clockInLat ?? null;
    const lng = shift.clockInLng ?? shift.clockInLng ?? null;
    if (lat == null || lng == null) return null;
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  const adhocCode = "ADHOC";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Shifts</h1>
        <p className="text-sm text-slate-400">
          Review and audit clock-in / clock-out activity.
        </p>
      </div>

      {/* Filters + actions */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Filter by employee
            </label>
            <input
              type="text"
              className="border rounded px-2 py-1 text-sm w-52"
              placeholder="Name or code"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Filter by location
            </label>
            <input
              type="text"
              className="border rounded px-2 py-1 text-sm w-52"
              placeholder="Location name"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            />
          </div>

          <label className="inline-flex items-center text-xs text-slate-300 mt-5">
            <input
              type="checkbox"
              className="mr-1"
              checked={adhocOnly}
              onChange={(e) => setAdhocOnly(e.target.checked)}
            />
            Show ADHOC only
          </label>
        </div>

        <div className="flex gap-2 mt-5 sm:mt-0">
          <button
            onClick={loadShifts}
            className="px-3 py-1.5 text-sm border rounded bg-slate-900 hover:bg-slate-950"
          >
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            disabled={shifts.length === 0}
            className="px-3 py-1.5 text-sm border rounded bg-slate-900 hover:bg-slate-950 disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            onClick={openCreateModal}
            className="px-3 py-1.5 text-sm rounded bg-black text-white hover:bg-gray-900"
          >
            New shift
          </button>
        </div>
      </div>

      {selectedShifts.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <span className="text-sm text-amber-200">
            {selectedShifts.size} shift(s) selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={openBulkEditModal}
              className="px-3 py-1.5 text-xs rounded bg-amber-400 text-slate-950 hover:bg-amber-300 font-semibold"
            >
              Change Location
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 text-xs rounded bg-red-500 text-white hover:bg-red-600 font-semibold"
            >
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedShifts(new Set())}
              className="px-3 py-1.5 text-xs border rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              Clear Selection
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span>{error}</span>
          {error.toLowerCase().includes("session") && (
            <button
              type="button"
              onClick={() => {
                window.location.href = "/admin/login";
              }}
              className="rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-300"
            >
              Log in again
            </button>
          )}
        </div>
      )}

      {/* Shifts table */}
      <div className="overflow-x-auto rounded-md border border-slate-800 bg-slate-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-950">
            <tr className="text-left text-xs font-semibold text-slate-400">
              <th className="px-4 py-2 w-8">
                <input
                  type="checkbox"
                  checked={shifts.length > 0 && selectedShifts.size === shifts.length}
                  onChange={toggleSelectAll}
                  className="cursor-pointer"
                />
              </th>
              <th className="px-4 py-2">Employee</th>
              <th className="px-4 py-2">Location</th>
              <th className="px-4 py-2">Clock in</th>
              <th className="px-4 py-2">Clock out</th>
              <th className="px-4 py-2">Hours</th>
              <th className="px-4 py-2">ADHOC</th>
              <th className="px-4 py-2">Map</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-6 text-center text-slate-400 text-sm"
                >
                  Loading shifts…
                </td>
              </tr>
            )}

            {!loading && shifts.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-6 text-center text-slate-400 text-sm"
                >
                  No shifts found.
                </td>
              </tr>
            )}

            {!loading &&
              shifts.map((shift: Shift) => {
                const isAdhoc =
                  shift.location?.code === adhocCode ||
                  shift.location?.name?.toLowerCase().includes("adhoc");

                const hoursStr = computeHours(shift.clockIn, shift.clockOut);

                const mapUrl = mapUrlForShift(shift);

                const empName = shift.user?.name || "—";
                const empCode = shift.user?.employeeCode || "";
                const locName = shift.location?.name || "—";

                return (
                  <tr
                    key={shift.id}
                    className={`border-t border-slate-800 text-xs text-slate-100 ${selectedShifts.has(shift.id) ? 'bg-amber-500/5' : ''}`}
                  >
                    <td className="px-4 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={selectedShifts.has(shift.id)}
                        onChange={() => toggleShiftSelection(shift.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <div className="font-medium text-slate-100">
                        {empName}
                      </div>
                      {empCode && (
                        <div className="text-[11px] text-slate-400">
                          {empCode}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top">{locName}</td>
                    <td className="px-4 py-2 align-top">
                      {formatDisplayDate(shift.clockIn)}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {formatDisplayDate(shift.clockOut)}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {hoursStr === "—" ? "—" : hoursStr}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {isAdhoc ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-200">
                          ADHOC
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {mapUrl ? (
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top text-right space-x-2">
                      <button
                        onClick={() => openEditModal(shift)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteShift(shift.id)}
                        className="text-xs text-red-600 hover:underline"
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-3xl rounded-lg bg-slate-900 shadow-lg">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-100">
                {modalMode === "create" ? "Create manual shift" : "Edit shift"}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-500 hover:text-slate-300 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {modalError && (
              <div className="border-b border-red-100 bg-red-50 px-5 py-2 text-xs text-red-700">
                {modalError}
              </div>
            )}

            <div className="px-5 py-4 space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Employee
                  </label>
                  <select
                    className="border rounded w-full px-2 py-1"
                    value={formUserId}
                    onChange={(e) => setFormUserId(e.target.value)}
                  >
                    <option value="">Select employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                        {emp.employeeCode ? ` (${emp.employeeCode})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Location
                  </label>
                  <select
                    className="border rounded w-full px-2 py-1"
                    value={formLocationId ?? ""}
                    onChange={(e) =>
                      setFormLocationId(e.target.value || null)
                    }
                  >
                    <option value="">(none)</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Clock in
                  </label>
                  <input
                    type="datetime-local"
                    className="border rounded w-full px-2 py-1"
                    value={formClockIn}
                    onChange={(e) => setFormClockIn(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Clock out
                  </label>
                  <input
                    type="datetime-local"
                    className="border rounded w-full px-2 py-1"
                    value={formClockOut}
                    onChange={(e) => setFormClockOut(e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Leave blank to clear clock-out.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <button
                onClick={closeModal}
                className="px-3 py-1.5 text-xs border rounded bg-slate-900 hover:bg-slate-950"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveShift}
                disabled={saving}
                className="px-3 py-1.5 text-xs rounded bg-black text-white hover:bg-gray-900 disabled:opacity-60"
              >
                {saving
                  ? modalMode === "create"
                    ? "Creating…"
                    : "Saving…"
                  : modalMode === "create"
                  ? "Create shift"
                  : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {bulkEditModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-lg bg-slate-900 shadow-lg">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-100">
                Change location for {selectedShifts.size} shift(s)
              </h2>
              <button
                onClick={() => setBulkEditModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  New Location
                </label>
                <select
                  className="border rounded w-full px-2 py-1"
                  value={bulkLocationId ?? ""}
                  onChange={(e) => setBulkLocationId(e.target.value || null)}
                >
                  <option value="">(none)</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <button
                onClick={() => setBulkEditModalOpen(false)}
                className="px-3 py-1.5 text-xs border rounded bg-slate-900 hover:bg-slate-950"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkEditLocation}
                disabled={loading}
                className="px-3 py-1.5 text-xs rounded bg-amber-400 text-slate-950 hover:bg-amber-300 font-semibold disabled:opacity-60"
              >
                {loading ? "Updating…" : "Update Location"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}