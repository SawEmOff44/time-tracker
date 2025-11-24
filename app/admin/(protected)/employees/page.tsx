"use client";

import { useEffect, useState } from "react";

type Employee = {
  id: string;
  name: string;
  employeeCode: string;
  role: string;
  active: boolean;
  pin?: string | null;
};

type NewEmployeePayload = {
  name: string;
  employeeCode: string;
  role: string;
  pin?: string;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [role, setRole] = useState<"WORKER" | "ADMIN">("WORKER");
  const [pin, setPin] = useState("");

  const [saving, setSaving] = useState(false);

  // Load employees on mount
  useEffect(() => {
    let cancelled = false;

    async function loadEmployees() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/employees");
        if (!res.ok) {
          throw new Error("Failed to load employees");
        }
        const data = (await res.json()) as Employee[];
        if (!cancelled) {
          setEmployees(data.sort(sortEmployees));
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load employees");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadEmployees();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: NewEmployeePayload = {
      name,
      employeeCode,
      role,
    };

    if (pin.trim()) {
      payload.pin = pin.trim();
    }

    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to create employee");
      }

      const created = (await res.json()) as Employee;

      setEmployees((prev) => [...prev, created].sort(sortEmployees));

      setName("");
      setEmployeeCode("");
      setRole("WORKER");
      setPin("");
    } catch (err: any) {
      setError(err.message || "Failed to create employee");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(emp: Employee, active: boolean) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to update employee");
      }

      const updated = (await res.json()) as Employee;

      setEmployees((prev) =>
        prev
          .map((e) => (e.id === updated.id ? updated : e))
          .sort(sortEmployees)
      );
    } catch (err: any) {
      setError(err.message || "Failed to update employee");
    }
  }

  async function deleteEmployee(emp: Employee) {
    setError(null);

    const confirmed = window.confirm(
      `Delete ${emp.name} (${emp.employeeCode})? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/employees/${emp.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to delete employee");
      }

      // Remove locally
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
    } catch (err: any) {
      setError(err.message || "Failed to delete employee");
    }
  }

  function sortEmployees(a: Employee, b: Employee) {
    return a.name.localeCompare(b.name);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Employees</h1>
        <p className="mt-1 text-sm text-slate-300">
          Manage employee records, roles, and PINs used for clocking in/out.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Create employee form */}
      <section className="rounded-lg bg-slate-900 p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Add New Employee</h2>

        <form
          onSubmit={handleCreateEmployee}
          className="grid gap-4 md:grid-cols-4"
        >
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Alice Johnson"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Employee Code
            </label>
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              required
              placeholder="e.g. ALI001"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Role</label>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "WORKER" | "ADMIN")
              }
            >
              <option value="WORKER">Worker</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">PIN</label>
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Optional – numeric PIN"
            />
            <p className="mt-1 text-xs text-slate-400">
              This is the PIN the employee will use with their code to clock
              in/out.
            </p>
          </div>

          <div className="flex items-end md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Add Employee"}
            </button>
          </div>
        </form>
      </section>

      {/* Existing employees */}
      <section className="rounded-lg bg-slate-900 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Existing Employees</h2>
          {loading && (
            <span className="text-xs text-slate-400">Loading…</span>
          )}
        </div>

        {employees.length === 0 ? (
          <p className="text-sm text-slate-400">
            No employees found. Add one above to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-slate-950 text-xs font-semibold uppercase text-slate-400">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Code</th>
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2">PIN</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-b last:border-0">
                    <td className="px-2 py-2">{emp.name}</td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {emp.employeeCode}
                    </td>
                    <td className="px-2 py-2 text-xs">{emp.role}</td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {emp.pin && emp.pin.trim().length > 0
                        ? emp.pin
                        : "—"}
                    </td>
                    <td className="px-2 py-2">
                      {emp.active ? (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-slate-400">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right space-x-3">
                      {emp.active ? (
                        <button
                          onClick={() => toggleActive(emp, false)}
                          className="text-xs text-orange-600 hover:underline"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleActive(emp, true)}
                          className="text-xs text-green-700 hover:underline"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        onClick={() => deleteEmployee(emp)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}