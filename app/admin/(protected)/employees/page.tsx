// app/admin/(protected)/employees/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";

type Employee = {
  id: string;
  name: string;
  employeeCode: string | null;
  email: string | null;
  role: string;
  active: boolean;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // new employee form fields
  const [name, setName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EMPLOYEE");

  async function loadEmployees() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/employees");
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to load employees");
      }
      setEmployees(data);
    } catch (err: any) {
      setError(err.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEmployees();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!name || !employeeCode) {
        throw new Error("Name and employee code are required.");
      }

      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          employeeCode,
          email: email || null,
          role,
          active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to create employee");
      }

      setName("");
      setEmployeeCode("");
      setEmail("");
      setRole("EMPLOYEE");
      await loadEmployees();
    } catch (err: any) {
      setError(err.message || "Failed to create employee.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(emp: Employee) {
    try {
      setError(null);
      const res = await fetch(`/api/admin/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !emp.active }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to update employee");
      }
      await loadEmployees();
    } catch (err: any) {
      setError(err.message || "Failed to update employee.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-sm text-gray-600">
            Manage employees and mark them active or inactive.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Create employee */}
      <form
        onSubmit={handleCreate}
        className="bg-white border rounded p-4 space-y-3"
      >
        <h2 className="font-semibold mb-1 text-sm">Add Employee</h2>
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Name</label>
            <input
              className="border rounded px-2 py-1 w-full text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Employee Code
            </label>
            <input
              className="border rounded px-2 py-1 w-full text-sm"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Email</label>
            <input
              type="email"
              className="border rounded px-2 py-1 w-full text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Role</label>
            <select
              className="border rounded px-2 py-1 w-full text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-2 px-4 py-2 rounded bg-black text-white text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Saving..." : "Add Employee"}
        </button>
      </form>

      {/* Employee list */}
      <div className="bg-white border rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                Name
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                Code
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                Email
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                Role
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                Status
              </th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-4 text-center text-gray-400"
                >
                  Loading…
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-4 text-center text-gray-400"
                >
                  No employees yet.
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">{emp.name}</td>
                  <td className="px-3 py-2">
                    {emp.employeeCode || (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {emp.email || (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{emp.role}</td>
                  <td className="px-3 py-2">
                    {emp.active ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 text-xs px-2 py-0.5">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-200 text-gray-700 text-xs px-2 py-0.5">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggleActive(emp)}
                      className="px-3 py-1 rounded border text-xs font-semibold hover:bg-gray-50"
                    >
                      {emp.active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}