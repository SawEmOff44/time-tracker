"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Employee = {
  id: string;
  name: string;
  employeeCode: string | null;
};

type Location = {
  id: string;
  name: string;
};

type ShiftTemplate = {
  id: string;
  name: string;
  description: string | null;
  locationId: string | null;
  location: Location | null;
  startMinutes: number;
  endMinutes: number;
  daysOfWeek: number[];
  active: boolean;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(mins).padStart(2, "0")} ${ampm}`;
}

export default function BulkShiftCreationPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    loadData();
    
    // Default to this week
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    
    setStartDate(fmt(monday));
    setEndDate(fmt(sunday));
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const [templatesRes, employeesRes] = await Promise.all([
        fetch("/api/admin/shift-templates"),
        fetch("/api/admin/employees"),
      ]);

      if (!templatesRes.ok || !employeesRes.ok) {
        throw new Error("Failed to load data");
      }

      const templatesData = await templatesRes.json();
      const employeesData = await employeesRes.json();

      setTemplates(templatesData.filter((t: ShiftTemplate) => t.active));
      setEmployees(employeesData.filter((e: Employee) => e.active));
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  function toggleEmployee(id: string) {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEmployees(newSelected);
  }

  function toggleAllEmployees() {
    if (selectedEmployees.size === employees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(employees.map(e => e.id)));
    }
  }

  async function handleCreateShifts() {
    if (!selectedTemplate) {
      setError("Please select a template");
      return;
    }
    if (selectedEmployees.size === 0) {
      setError("Please select at least one employee");
      return;
    }
    if (!startDate || !endDate) {
      setError("Please select date range");
      return;
    }

    try {
      setCreating(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/admin/shifts/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate,
          employeeIds: Array.from(selectedEmployees),
          startDate,
          endDate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create shifts");
      }

      setSuccess(`Successfully created ${data.count} shifts!`);
      
      // Reset selections
      setSelectedTemplate(null);
      setSelectedEmployees(new Set());
      
      // Redirect to shifts page after 2 seconds
      setTimeout(() => {
        router.push("/admin/shifts");
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create shifts");
    } finally {
      setCreating(false);
    }
  }

  const selectedTemplateObj = templates.find(t => t.id === selectedTemplate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">
          Bulk Shift Creation
        </h1>
        <p className="text-sm text-slate-400">
          Create multiple shifts from a template for selected employees
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      )}

      {loading && (
        <div className="text-center py-8 text-slate-400">Loading...</div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* Date Range */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
            <h3 className="text-sm font-semibold text-slate-100 mb-3">
              1. Select Date Range
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border border-slate-700 rounded w-full px-3 py-2 bg-slate-950 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border border-slate-700 rounded w-full px-3 py-2 bg-slate-950 text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Template Selection */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
            <h3 className="text-sm font-semibold text-slate-100 mb-3">
              2. Choose Template
            </h3>
            {templates.length === 0 && (
              <p className="text-sm text-slate-400">
                No active templates available. Create one first.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    selectedTemplate === template.id
                      ? "border-amber-400 bg-amber-400/10"
                      : "border-slate-700 hover:border-slate-600"
                  }`}
                >
                  <div className="font-medium text-slate-100 text-sm">
                    {template.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {template.location?.name || "Any location"}
                  </div>
                  <div className="text-xs text-amber-300 mt-1">
                    {formatTime(template.startMinutes)} -{" "}
                    {formatTime(template.endMinutes)}
                  </div>
                  <div className="flex gap-1 mt-2">
                    {template.daysOfWeek.map((day) => (
                      <span
                        key={day}
                        className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                      >
                        {DAYS[day]}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Employee Selection */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-100">
                3. Select Employees ({selectedEmployees.size})
              </h3>
              <button
                onClick={toggleAllEmployees}
                className="text-xs text-amber-400 hover:text-amber-300"
              >
                {selectedEmployees.size === employees.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {employees.map((emp) => (
                <label
                  key={emp.id}
                  className="flex items-center gap-2 p-2 rounded border border-slate-700 hover:border-slate-600 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedEmployees.has(emp.id)}
                    onChange={() => toggleEmployee(emp.id)}
                    className="cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-100 truncate">
                      {emp.name}
                    </div>
                    {emp.employeeCode && (
                      <div className="text-[10px] text-slate-500">
                        {emp.employeeCode}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Preview & Create */}
          {selectedTemplateObj && selectedEmployees.size > 0 && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
              <h3 className="text-sm font-semibold text-amber-200 mb-2">
                Preview
              </h3>
              <p className="text-xs text-slate-300">
                Will create shifts for <strong>{selectedEmployees.size}</strong>{" "}
                employee(s) using the <strong>{selectedTemplateObj.name}</strong>{" "}
                template from <strong>{startDate}</strong> to{" "}
                <strong>{endDate}</strong>.
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Only dates matching the template's days of week will be created.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-sm rounded-full border border-slate-700 text-slate-200 hover:bg-slate-800"
              disabled={creating}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateShifts}
              disabled={
                creating ||
                !selectedTemplate ||
                selectedEmployees.size === 0 ||
                !startDate ||
                !endDate
              }
              className="px-6 py-2 text-sm rounded-full bg-amber-400 text-slate-950 font-semibold hover:bg-amber-300 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Shifts"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
