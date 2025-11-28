// app/admin/(protected)/employees/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link"; // NEW: for worker portal link

type AdminUser = {
  id: string;
  name: string;
  email: string | null;
  employeeCode: string | null;
  active: boolean;
  createdAt: string; // serialized from API
  hourlyRate: number | null;
  salaryAnnnual: number | null; // NOTE: matches Prisma field name
};

function formatPay(user: AdminUser): string {
  if (typeof user.hourlyRate === "number" && !Number.isNaN(user.hourlyRate)) {
    return `$${user.hourlyRate.toFixed(2)}/hr`;
  }
  if (
    typeof user.salaryAnnnual === "number" &&
    !Number.isNaN(user.salaryAnnnual)
  ) {
    return `$${user.salaryAnnnual.toLocaleString("en-US", {
      maximumFractionDigits: 0,
    })}/yr`;
  }
  return "Not set";
}

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  // Edit modal state
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editEmployeeCode, setEditEmployeeCode] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editPin, setEditPin] = useState(""); // new PIN (optional)
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editPayMode, setEditPayMode] = useState<"none" | "hourly" | "salary">(
    "none"
  );
  const [editHourlyRate, setEditHourlyRate] = useState("");
  const [editSalaryAnnual, setEditSalaryAnnual] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/admin/employees");
        if (!res.ok) {
          throw new Error("Failed to load employees");
        }
        const data = (await res.json()) as AdminUser[];
        setEmployees(data);
      } catch (err) {
        console.error(err);
        setError("Could not load employees.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const pending = employees.filter((u) => !u.active);
  const active = employees.filter((u) => u.active);

  async function handleApprove(id: string) {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/employees/${id}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Approve failed");
      }
      const updated = (await res.json()) as AdminUser;
      setEmployees((prev) =>
        prev.map((u) => (u.id === id ? { ...u, active: updated.active } : u))
      );
    } catch (err) {
      console.error(err);
      alert("Failed to approve worker.");
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(id: string) {
    if (!window.confirm("Reject and remove this pending worker?")) return;
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/employees/${id}/reject`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Reject failed");
      }
      setEmployees((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to reject worker.");
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (
      !window.confirm(
        "Permanently delete this employee? This only works if they have no recorded shifts."
      )
    ) {
      return;
    }

    setActingId(id);
    try {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        alert(body.error ?? "Failed to delete employee.");
        throw new Error("Delete failed");
      }

      setEmployees((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setActingId(null);
    }
  }

  function openEdit(user: AdminUser) {
    setEditingUser(user);
    setEditName(user.name ?? "");
    setEditEmail(user.email ?? "");
    setEditEmployeeCode(user.employeeCode ?? "");
    setEditActive(user.active);
    setEditPin("");
    setEditError(null);
    // Initialize pay mode + values
    if (typeof user.hourlyRate === "number" && !Number.isNaN(user.hourlyRate)) {
      setEditPayMode("hourly");
      setEditHourlyRate(user.hourlyRate.toString());
      setEditSalaryAnnual("");
    } else if (
      typeof user.salaryAnnnual === "number" &&
      !Number.isNaN(user.salaryAnnnual)
    ) {
      setEditPayMode("salary");
      setEditSalaryAnnual(user.salaryAnnnual.toString());
      setEditHourlyRate("");
    } else {
      setEditPayMode("none");
      setEditHourlyRate("");
      setEditSalaryAnnual("");
    }
  }

  function closeEdit() {
    setEditingUser(null);
    setEditPin("");
    setEditError(null);
    setEditPayMode("none");
    setEditHourlyRate("");
    setEditSalaryAnnual("");
  }

  async function handleSaveEdit() {
    if (!editingUser) return;

    // Validate PIN if provided
    if (editPin.trim().length > 0 && !/^\d{4}$/.test(editPin.trim())) {
      setEditError("PIN must be exactly 4 digits (0–9).");
      return;
    }

    setSavingEdit(true);
    setEditError(null);

    let hourlyNumber: number | null = null;
    let salaryNumber: number | null = null;

    if (editPayMode === "hourly") {
      if (!editHourlyRate.trim()) {
        setSavingEdit(false);
        setEditError("Please enter an hourly rate or choose a different pay mode.");
        return;
      }
      const parsed = parseFloat(editHourlyRate.trim());
      if (!Number.isFinite(parsed) || parsed < 0) {
        setSavingEdit(false);
        setEditError("Hourly rate must be a positive number.");
        return;
      }
      hourlyNumber = parsed;
      salaryNumber = null;
    } else if (editPayMode === "salary") {
      if (!editSalaryAnnual.trim()) {
        setSavingEdit(false);
        setEditError("Please enter an annual salary or choose a different pay mode.");
        return;
      }
      const parsed = parseFloat(editSalaryAnnual.trim());
      if (!Number.isFinite(parsed) || parsed < 0) {
        setSavingEdit(false);
        setEditError("Annual salary must be a positive number.");
        return;
      }
      salaryNumber = parsed;
      hourlyNumber = null;
    } else {
      // "none" -> explicitly clear both on save
      hourlyNumber = null;
      salaryNumber = null;
    }

    try {
      const body: {
        name?: string;
        email?: string | null;
        employeeCode?: string | null;
        active?: boolean;
        pin?: string;
        hourlyRate?: number | null;
        salaryAnnnual?: number | null;
      } = {
        name: editName.trim(),
        email: editEmail.trim() || null,
        employeeCode: editEmployeeCode.trim() || null,
        active: editActive,
        hourlyRate: hourlyNumber,
        salaryAnnnual: salaryNumber,
      };

      if (editPin.trim().length > 0) {
        body.pin = editPin.trim();
      }

      const res = await fetch(`/api/admin/employees/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json().catch(() => null)) as
        | AdminUser
        | { error?: string }
        | null;

      if (!res.ok || !data || "error" in data) {
        const msg =
          (data && "error" in data && data.error) ||
          "Failed to update employee.";
        setEditError(msg);
        return;
      }

      const updated = data as AdminUser;

      // Update local list (we still never expose PIN)
      setEmployees((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );

      closeEdit();
    } catch (err) {
      console.error(err);
      setEditError("Unexpected error while saving employee.");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Employees</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage workers, review pending accounts, reset PINs, and control who
          can clock in.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Pending workers */}
      <div className="card border-amber-400/40 bg-slate-900/70">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-amber-200">
              Pending workers (awaiting approval)
            </h2>
            <p className="text-xs text-amber-100/80">
              These accounts were created from the public clock page and cannot
              clock in until approved.
            </p>
          </div>
          <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-100">
            {pending.length} pending
          </span>
        </div>

        {loading && (
          <p className="text-xs text-slate-300">Loading employees…</p>
        )}

        {!loading && pending.length === 0 && (
          <p className="text-xs text-slate-400">
            No pending workers right now. New self-registrations will appear
            here.
          </p>
        )}

        {!loading && pending.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="admin-table min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/80">
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Employee code</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Requested</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((u) => (
                  <tr key={u.id} className="border-b border-slate-800/80">
                    <td className="px-3 py-2 align-middle">
                      <div className="text-sm text-slate-50">
                        {u.name || "Unnamed"}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-200">
                      {u.employeeCode ?? "—"}
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-300">
                      {u.email ?? "—"}
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-400">
                      {new Date(u.createdAt).toLocaleString("en-US", {
                        month: "2-digit",
                        day: "2-digit",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2 align-middle text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(u.id)}
                          disabled={actingId === u.id}
                          className="rounded-full bg-emerald-500/90 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                        >
                          {actingId === u.id ? "Approving…" : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(u.id)}
                          disabled={actingId === u.id}
                          className="rounded-full bg-red-500/80 px-3 py-1 text-[11px] font-semibold text-slate-50 hover:bg-red-400 disabled:opacity-60"
                        >
                          {actingId === u.id ? "Rejecting…" : "Reject"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active employees */}
      <div className="card bg-slate-900/70">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Active employees
            </h2>
            <p className="text-xs text-slate-400">
              These workers can clock in and will appear in shifts & payroll.
            </p>
          </div>
          <span className="rounded-full bg-slate-700/60 px-3 py-1 text-xs font-semibold text-slate-100">
            {active.length} active
          </span>
        </div>

        {loading && (
          <p className="text-xs text-slate-300">Loading employees…</p>
        )}

        {!loading && active.length === 0 && (
          <p className="text-xs text-slate-400">
            No active employees yet. Approve pending workers above, or use your
            existing admin tools to add employees manually.
          </p>
        )}

        {!loading && active.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="admin-table min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/80">
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Employee code</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Pay</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {active.map((u) => (
                  <tr key={u.id} className="border-b border-slate-800/80">
                    <td className="px-3 py-2 align-middle">
                      <div className="text-sm text-slate-50">
                        {u.name || "Unnamed"}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-200">
                      {u.employeeCode ?? "—"}
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-300">
                      {u.email ?? "—"}
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-200">
                      {formatPay(u)}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-300 border border-emerald-500/40">
                        Can clock in
                      </span>
                    </td>
                    <td className="px-3 py-2 align-middle text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="rounded-full bg-slate-700/80 px-3 py-1 text-[11px] font-semibold text-slate-50 hover:bg-slate-600"
                        >
                          Edit / Reset PIN
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(u.id)}
                          disabled={actingId === u.id}
                          className="rounded-full bg-red-500/80 px-3 py-1 text-[11px] font-semibold text-slate-50 hover:bg-red-400 disabled:opacity-60"
                        >
                          {actingId === u.id ? "Deleting…" : "Delete"}
                        </button>

                        {/* NEW: link to worker portal page */}
                        <Link
                          href={`/worker/${encodeURIComponent(
                            u.employeeCode ?? u.id
                          )}`}
                          className="rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:bg-slate-800"
                        >
                          Worker page
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded bg-slate-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-50">
              Edit employee: {editingUser.name || "Unnamed"}
            </h3>

            {editError && (
              <div className="mb-4 rounded bg-red-600/80 p-2 text-sm text-red-100">
                {editError}
              </div>
            )}

            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Name
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-50"
                autoFocus
              />
            </label>

            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Email (optional)
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-50"
              />
            </label>

            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Employee code (optional)
              <input
                type="text"
                value={editEmployeeCode}
                onChange={(e) => setEditEmployeeCode(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-50"
              />
            </label>

            <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
              />
              Active (can clock in)
            </label>

            {/* Compensation section */}
            <div className="mb-4 rounded border border-slate-700 bg-slate-900/80 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Compensation
              </div>

              <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-200">
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="payMode"
                    value="none"
                    checked={editPayMode === "none"}
                    onChange={() => setEditPayMode("none")}
                  />
                  <span>No pay set</span>
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="payMode"
                    value="hourly"
                    checked={editPayMode === "hourly"}
                    onChange={() => setEditPayMode("hourly")}
                  />
                  <span>Hourly</span>
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="payMode"
                    value="salary"
                    checked={editPayMode === "salary"}
                    onChange={() => setEditPayMode("salary")}
                  />
                  <span>Salary</span>
                </label>
              </div>

              {editPayMode === "hourly" && (
                <div className="mb-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Hourly rate (USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editHourlyRate}
                    onChange={(e) => setEditHourlyRate(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-50"
                  />
                </div>
              )}

              {editPayMode === "salary" && (
                <div className="mb-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Annual salary (USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={editSalaryAnnual}
                    onChange={(e) => setEditSalaryAnnual(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-50"
                  />
                </div>
              )}

              <p className="mt-1 text-[11px] text-slate-400">
                For now only one active rate is stored per employee. Future versions can support
                pay history and scheduled changes without changing this screen.
              </p>
            </div>

            <label className="mb-4 block text-sm font-semibold text-slate-200">
              Reset PIN (4 digits, optional)
              <input
                type="password"
                value={editPin}
                onChange={(e) => setEditPin(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-50"
                maxLength={4}
                inputMode="numeric"
                pattern="\d{4}"
              />
            </label>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEdit}
                disabled={savingEdit}
                className="rounded bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-600 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-emerald-500 disabled:opacity-60"
              >
                {savingEdit ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}