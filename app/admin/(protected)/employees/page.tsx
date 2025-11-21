"use client";

import { useEffect, useState } from "react";

type Employee = {
  id: string;
  name: string;
  employeeCode: string | null;
  pinHash: string | null;
  role: string;
  active: boolean;
};

const ROLES = ["EMPLOYEE", "MANAGER", "ADMIN"];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New employee form state
  const [name, setName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [saving, setSaving] = useState(false);

  async function loadEmployees() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/employees");
      if (!res.ok) throw new Error("Failed to load employees");
      const data = (await res.json()) as Employee[];
      setEmployees(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          employeeCode,
          pin,
          role,
          active: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create employee");
      }

      setName("");
      setEmployeeCode("");
      setPin("");
      setRole("EMPLOYEE");

      await loadEmployees();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create employee");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(emp: Employee) {
    try {
      const res = await fetch(`/api/admin/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !emp.active }),
      });
      if (!res.ok) throw new Error("Failed to update employee");
      await loadEmployees();
    } catch (err) {
      console.error(err);
      setError("Failed to update employee");
    }
  }

  async function deleteEmployee(id: string) {
    if (!confirm("Delete this employee?")) return;

    try {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete employee");
      await loadEmployees();
    } catch (err) {
      console.error(err);
      setError("Failed to delete employee");
    }
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-2">Employees</h1>

      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}

      {/* Create new employee */}
      <section className="bg-white shadow rounded p-4 space-y-3 max-w-xl">
        <h2 className="text-lg font-semibold">Add Employee</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              className="border rounded px-2 py-1 w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Employee Code
            </label>
            <input
              className="border rounded px-2 py-1 w-full"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">PIN</label>
            <input
              type="password"
              className="border rounded px-2 py-1 w-full"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              className="border rounded px-2 py-1 w-full"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded bg-black text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add Employee"}
          </button>
        </form>
      </section>

      {/* Employee list */}
      <section className="bg-white shadow rounded p-4">
        <h2 className="text-lg font-semibold mb-3">Existing Employees</h2>
        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : employees.length === 0 ? (
          <div className="text-sm text-gray-500">No employees yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 pr-2">Name</th>
                  <th className="text-left py-1 pr-2">Code</th>
                  <th className="text-left py-1 pr-2">Role</th>
                  <th className="text-left py-1 pr-2">Active</th>
                  <th className="text-left py-1 pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-b">
                    <td className="py-1 pr-2">{emp.name}</td>
                    <td className="py-1 pr-2">{emp.employeeCode}</td>
                    <td className="py-1 pr-2">{emp.role}</td>
                    <td className="py-1 pr-2">
                      {emp.active ? "Yes" : "No"}
                    </td>
                    <td className="py-1 pr-2 space-x-2">
                      <button
                        onClick={() => toggleActive(emp)}
                        className="px-2 py-1 text-xs rounded border"
                      >
                        {emp.active ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => deleteEmployee(emp.id)}
                        className="px-2 py-1 text-xs rounded border border-red-500 text-red-600"
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
    </main>
  );
}