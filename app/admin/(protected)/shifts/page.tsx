"use client";

import { useEffect, useState } from "react";

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

  async function loadEmployeesAndLocations() {
    try {
      const [empRes, locRes] = await Promise.all([
        fetch("/api/admin/employees"),
        fetch("/api/locations"),
      ]);
      if (!empRes.ok) throw new Error("Failed to load employees");
      if (!locRes.ok) throw new Error("Failed to load locations");
      const emps = (await empRes.json()) as Employee[];
      const locs = (await locRes.json()) as Location[];
      setEmployees(emps);
      setLocations(locs);
    } catch (err) {
      console.error(err);
      setError("Failed to load employees or locations.");
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

      const url = `/api/shifts${params.toString() ? `?${params.toString()}` : ""}`;

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load shifts");
      const data = (await res.json()) as Shift[];
      setShifts(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load shifts.");
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
        <h1 className="text-xl font-semibold text-gray-900">Shifts</h1>
        <p className="text-sm text-gray-500">
          Review and audit clock-in / clock-out activity.
        </p>
      </div>

      {/* Filters + actions */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
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
            <label className="block text-xs font-medium text-gray-500 mb-1">
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

          <label className="inline-flex items-center text-xs text-gray-600 mt-5">
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
            className="px-3 py-1.5 text-sm border rounded bg-white hover:bg-gray-50"
          >
            Refresh
          </button>
          <button
            onClick={openCreateModal}
            className="px-3 py-1.5 text-sm rounded bg-black text-white hover:bg-gray-900"
          >
            New shift
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Shifts table */}
      <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold text-gray-500">
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
                  colSpan={8}
                  className="px-4 py-6 text-center text-gray-500 text-sm"
                >
                  Loading shifts…
                </td>
              </tr>
            )}

            {!loading && shifts.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-gray-500 text-sm"
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
                    className="border-t border-gray-100 text-xs text-gray-800"
                  >
                    <td className="px-4 py-2 align-top">
                      <div className="font-medium text-gray-900">
                        {empName}
                      </div>
                      {empCode && (
                        <div className="text-[11px] text-gray-500">
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
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          ADHOC
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">—</span>
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
                        <span className="text-[11px] text-gray-400">—</span>
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
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-900">
                {modalMode === "create" ? "Create manual shift" : "Edit shift"}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Clock out
                  </label>
                  <input
                    type="datetime-local"
                    className="border rounded w-full px-2 py-1"
                    value={formClockOut}
                    onChange={(e) => setFormClockOut(e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
                    Leave blank to clear clock-out.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <button
                onClick={closeModal}
                className="px-3 py-1.5 text-xs border rounded bg-white hover:bg-gray-50"
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
    </div>
  );
}