// app/admin/(protected)/employees/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";              // ⬅️ NEW

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

      {/* Pending workers (unchanged) */}
      {/* ... existing pending workers block ... */}

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

                        {/* ⬇️ NEW: link to worker portal page */}
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

      {/* Edit modal (unchanged) */}
      {/* ... existing modal code ... */}
    </div>
  );
}