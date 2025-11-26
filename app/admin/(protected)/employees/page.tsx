// app/admin/(protected)/employees/page.tsx
"use client";

import { useEffect, useState } from "react";

type AdminUser = {
  id: string;
  name: string;
  email: string | null;
  employeeCode: string | null;
  active: boolean;
  createdAt: string; // serialized from API
};

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
  }

  function closeEdit() {
    setEditingUser(null);
    setEditPin("");
    setEditError(null);
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

    try {
      const body: {
        name?: string;
        email?: string | null;
        employeeCode?: string | null;
        active?: boolean;
        pin?: string;
      } = {
        name: editName.trim(),
        email: editEmail.trim() || null,
        employeeCode: editEmployeeCode.trim() || null,
        active: editActive,
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
                          {actingId === u.id ? "Removing…" : "Reject"}
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">
            <h2 className="text-sm font-semibold text-slate-100 mb-1">
              Edit employee
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Update details or set a new 4-digit PIN. Leaving PIN blank keeps
              the current PIN.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Name
                </label>
                <input
                  type="text"
                  className="mt-1 w-full"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  className="mt-1 w-full"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Employee code
                </label>
                <input
                  type="text"
                  className="mt-1 w-full"
                  value={editEmployeeCode}
                  onChange={(e) => setEditEmployeeCode(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Active (can clock in)
                </label>
                <button
                  type="button"
                  onClick={() => setEditActive((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    editActive ? "bg-emerald-500" : "bg-slate-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      editActive ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  New PIN (optional)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  pattern="\d{4}"
                  placeholder="••••"
                  className="mt-1 w-full"
                  value={editPin}
                  onChange={(e) => setEditPin(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Must be exactly 4 digits if provided.
                </p>
              </div>

              {editError && (
                <p className="text-xs text-red-300">{editError}</p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEdit}
                disabled={savingEdit}
                className="rounded-full border border-slate-600 px-4 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}