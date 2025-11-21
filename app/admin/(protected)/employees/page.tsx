"use client";

import { useEffect, useState, FormEvent } from "react";

type Employee = {
  id: string;
  name: string;
  employeeCode: string | null;
  active: boolean;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");

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
    loadEmployees();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          employeeCode: employeeCode || null,
          pin,
          role: "EMPLOYEE",
          active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to create employee");
      }

      setName("");
      setEmployeeCode("");
      setPin("");
      await loadEmployees();
    } catch (err: any) {
      setError(err.message || "Failed to create employee");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Employees</h1>
        <p className="text-sm text-gray-600">
          Manage employee records and PINs.
        </p>
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
        <h2 className="font-semibold mb-1">Add Employee</h2>
        <div className="grid md:grid-cols-3 gap-3">
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
              Employee Code (optional)
            </label>
            <input
              className="border rounded px-2 py-1 w-full text-sm"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">PIN</label>
            <input
              className="border rounded px-2 py-1 w-full text-sm"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
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
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-3 text-center text-gray-400"
                >
                  Loading employees...
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-3 text-center text-gray-400"
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
                    {emp.active ? (
                      <span className="text-green-700 text-xs font-semibold">
                        Active
                      </span>
                    ) : (
                      <span className="text-gray-500 text-xs">Inactive</span>
                    )}
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