// app/admin/(protected)/employees/page.tsx
"use client";

import { useEffect, useState } from "react";

type AdminUser = {
  id: string;
  name: string;
  email: string | null;
  employeeCode: string | null;
  active: boolean;
  createdAt: string; // serialized ISO string
};

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  // Inline edit state for active employees
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCode, setEditCode] = useState("");

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

  // --- Approve / Reject pending workers ----------------------------------

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

  // --- Delete active employee -------------------------------------------

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
        ok?: boolean;
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

  // --- Inline edit handling ---------------------------------------------

  function startEdit(user: AdminUser) {
    setEditingId(user.id);
    setEditName(user.name ?? "");
    setEditEmail(user.email ?? "");
    setEditCode(user.employeeCode ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditEmail("");
    setEditCode("");
  }

  async function saveEdit(id: string) {
    setActingId(id);
    try {
      const payload = {
        name: editName.trim(),
        email: editEmail.trim() || null,
        employeeCode: editCode.trim() || null,
      };

      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        alert(body.error ?? "Failed to update employee.");
        throw new Error("Update failed");
      }

      setEmployees((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                name: payload.name,
                email: payload.email,
                employeeCode: payload.employeeCode,
              }
            : u
        )
      );
      cancelEdit();
    } catch (err) {
      console.error(err);
    } finally {
      setActingId(null);
    }
  }

  // --- Render -----------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Employees</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage workers, review pending accounts, and control who can clock in.
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
                {active.map((u) => {
                  const isEditing = editingId === u.id;

                  return (
                    <tr key={u.id} className="border-b border-slate-800/80">
                      <td className="px-3 py-2 align-middle">
                        {isEditing ? (
                          <input
                            className="w-full text-sm"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        ) : (
                          <div className="text-sm text-slate-50">
                            {u.name || "Unnamed"}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2 align-middle text-slate-200">
                        {isEditing ? (
                          <input
                            className="w-full text-xs"
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value)}
                          />
                        ) : (
                          u.employeeCode ?? "—"
                        )}
                      </td>

                      <td className="px-3 py-2 align-middle text-slate-300">
                        {isEditing ? (
                          <input
                            className="w-full text-xs"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                          />
                        ) : (
                          u.email ?? "—"
                        )}
                      </td>

                      <td className="px-3 py-2 align-middle">
                        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-300 border border-emerald-500/40">
                          Can clock in
                        </span>
                      </td>

                      <td className="px-3 py-2 align-middle text-right">
                        {isEditing ? (
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveEdit(u.id)}
                              disabled={actingId === u.id}
                              className="rounded-full bg-emerald-500/90 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                            >
                              {actingId === u.id ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={actingId === u.id}
                              className="rounded-full bg-slate-600/80 px-3 py-1 text-[11px] font-semibold text-slate-50 hover:bg-slate-500 disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(u)}
                              disabled={actingId === u.id}
                              className="rounded-full bg-slate-600/90 px-3 py-1 text-[11px] font-semibold text-slate-50 hover:bg-slate-500 disabled:opacity-60"
                            >
                              Edit
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
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}