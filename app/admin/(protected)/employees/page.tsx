"use client";

import { useEffect, useState } from "react";

type Role = "EMPLOYEE" | "ADMIN";

type Location = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  name: string;
  employeeCode: string | null;
  role: Role;
  email: string | null;
  pinHash: string | null;
  active: boolean;
  defaultLocationId: string | null;
  defaultLocation?: {
    id: string;
    name: string;
  } | null;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newEmployeeCode, setNewEmployeeCode] = useState("");
  const [newRole, setNewRole] = useState<Role>("EMPLOYEE");
  const [newEmail, setNewEmail] = useState("");
  const [newDefaultLocationId, setNewDefaultLocationId] = useState<string>("");
  const [newPin, setNewPin] = useState("");

  // Simple edit state (for toggling active and maybe later full edit)
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [empRes, locRes] = await Promise.all([
        fetch("/api/admin/employees"),
        fetch("/api/locations"),
      ]);

      if (!empRes.ok) {
        throw new Error("Failed to load employees");
      }
      if (!locRes.ok) {
        throw new Error("Failed to load locations");
      }

      const employeesJson = (await empRes.json()) as Employee[];
      const locationsJson = (await locRes.json()) as Location[];

      setEmployees(employeesJson);
      setLocations(locationsJson);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          employeeCode: newEmployeeCode,
          role: newRole,
          email: newEmail || null,
          defaultLocationId: newDefaultLocationId || null,
          active: true,
          pin: newPin || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create employee");
      }

      // Refresh list
      await loadData();

      // Reset form
      setNewName("");
      setNewEmployeeCode("");
      setNewRole("EMPLOYEE");
      setNewEmail("");
      setNewDefaultLocationId("");
      setNewPin("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create employee");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(emp: Employee) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: emp.id,
          active: !emp.active,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to update employee");
      }

      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to update employee");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employees</h1>
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Add Employee</h2>
        <form onSubmit={handleCreateEmployee} className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Employee Code
            </label>
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              placeholder="e.g. ALI001"
              value={newEmployeeCode}
              onChange={(e) => setNewEmployeeCode(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Role)}
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Default Location</label>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={newDefaultLocationId}
              onChange={(e) => setNewDefaultLocationId(e.target.value)}
            >
              <option value="">None</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Email (optional)
            </label>
            <input
              type="email"
              className="w-full rounded border px-2 py-1 text-sm"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              PIN (4–6 digits recommended)
            </label>
            <input
              type="password"
              className="w-full rounded border px-2 py-1 text-sm"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="e.g. 1234"
            />
            <p className="mt-1 text-xs text-gray-500">
              This is what the employee will type on the clock-in screen.
            </p>
          </div>

          <div className="md:col-span-2 flex justify-end mt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Create Employee"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Existing Employees</h2>
        {loading ? (
          <div className="text-sm text-gray-600">Loading employees...</div>
        ) : employees.length === 0 ? (
          <div className="text-sm text-gray-500">No employees found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-2 py-1">Name</th>
                  <th className="px-2 py-1">Code</th>
                  <th className="px-2 py-1">Role</th>
                  <th className="px-2 py-1">Default Location</th>
                  <th className="px-2 py-1">Active</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-b last:border-0">
                    <td className="px-2 py-1">{emp.name}</td>
                    <td className="px-2 py-1">
                      {emp.employeeCode || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-2 py-1">
                      {emp.role === "ADMIN" ? "Admin" : "Employee"}
                    </td>
                    <td className="px-2 py-1">
                      {emp.defaultLocation?.name || (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {emp.active ? (
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <button
                        onClick={() => toggleActive(emp)}
                        disabled={saving}
                        className="rounded border px-2 py-1 text-xs font-medium hover:bg-gray-50 disabled:opacity-60"
                      >
                        {emp.active ? "Deactivate" : "Reactivate"}
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