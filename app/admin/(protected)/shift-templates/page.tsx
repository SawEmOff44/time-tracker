"use client";

import { useEffect, useState } from "react";

type Location = {
  id: string;
  name: string;
  code: string;
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

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTimeInput(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export default function ShiftTemplatesPage() {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLocationId, setFormLocationId] = useState<string | null>(null);
  const [formStartTime, setFormStartTime] = useState("08:00");
  const [formEndTime, setFormEndTime] = useState("17:00");
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [formActive, setFormActive] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const [templatesRes, locationsRes] = await Promise.all([
        fetch("/api/admin/shift-templates"),
        fetch("/api/admin/locations"),
      ]);

      if (!templatesRes.ok || !locationsRes.ok) {
        throw new Error("Failed to load data");
      }

      const templatesData = await templatesRes.json();
      const locationsData = await locationsRes.json();

      setTemplates(templatesData);
      setLocations(locationsData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingTemplate(null);
    setFormName("");
    setFormDescription("");
    setFormLocationId(null);
    setFormStartTime("08:00");
    setFormEndTime("17:00");
    setFormDaysOfWeek([1, 2, 3, 4, 5]);
    setFormActive(true);
    setModalError(null);
    setModalOpen(true);
  }

  function openEditModal(template: ShiftTemplate) {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description || "");
    setFormLocationId(template.locationId);
    setFormStartTime(minutesToTimeInput(template.startMinutes));
    setFormEndTime(minutesToTimeInput(template.endMinutes));
    setFormDaysOfWeek(template.daysOfWeek);
    setFormActive(template.active);
    setModalError(null);
    setModalOpen(true);
  }

  function toggleDay(day: number) {
    if (formDaysOfWeek.includes(day)) {
      setFormDaysOfWeek(formDaysOfWeek.filter((d) => d !== day));
    } else {
      setFormDaysOfWeek([...formDaysOfWeek, day].sort());
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setModalError(null);

      if (!formName.trim()) {
        setModalError("Template name is required");
        return;
      }

      if (formDaysOfWeek.length === 0) {
        setModalError("Select at least one day of the week");
        return;
      }

      const body = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        locationId: formLocationId,
        startMinutes: timeToMinutes(formStartTime),
        endMinutes: timeToMinutes(formEndTime),
        daysOfWeek: formDaysOfWeek,
        active: formActive,
      };

      const url = editingTemplate
        ? `/api/admin/shift-templates/${editingTemplate.id}`
        : "/api/admin/shift-templates";

      const method = editingTemplate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setModalError(data.error || "Failed to save template");
        return;
      }

      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;

    try {
      const res = await fetch(`/api/admin/shift-templates/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete template");
      }

      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to delete template");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Shift Templates</h1>
          <p className="text-sm text-slate-400">
            Define recurring shift schedules for quick shift creation
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 text-sm rounded-full bg-amber-400 text-slate-950 font-semibold hover:bg-amber-300"
        >
          New Template
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-8 text-slate-400">Loading templates…</div>
      )}

      {!loading && templates.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          No shift templates yet. Create one to get started.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <div
            key={template.id}
            className={`rounded-2xl border p-4 ${
              template.active
                ? "border-slate-700 bg-slate-900/80"
                : "border-slate-800 bg-slate-950/50 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {template.name}
                </h3>
                {template.description && (
                  <p className="text-xs text-slate-400 mt-1">
                    {template.description}
                  </p>
                )}
              </div>
              {!template.active && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  Inactive
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Location:</span>
                <span>{template.location?.name || "Any"}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500">Time:</span>
                <span className="text-amber-300 font-medium">
                  {formatTime(template.startMinutes)} - {formatTime(template.endMinutes)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500">Days:</span>
                <div className="flex gap-1">
                  {template.daysOfWeek.map((day) => (
                    <span
                      key={day}
                      className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-semibold text-[10px]"
                    >
                      {DAYS[day]}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => openEditModal(template)}
                className="flex-1 px-3 py-1.5 text-xs rounded bg-slate-800 text-slate-200 hover:bg-slate-700 font-medium"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(template.id)}
                className="px-3 py-1.5 text-xs rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-slate-900 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3 sticky top-0 bg-slate-900">
              <h2 className="text-sm font-semibold text-slate-100">
                {editingTemplate ? "Edit Template" : "Create Template"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {modalError && (
              <div className="border-b border-red-500/40 bg-red-500/10 px-5 py-2 text-xs text-red-200">
                {modalError}
              </div>
            )}

            <div className="px-5 py-4 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Morning Shift, Night Security"
                  className="border border-slate-700 rounded w-full px-3 py-2 bg-slate-950 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                  className="border border-slate-700 rounded w-full px-3 py-2 bg-slate-950 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Location
                </label>
                <select
                  value={formLocationId ?? ""}
                  onChange={(e) => setFormLocationId(e.target.value || null)}
                  className="border border-slate-700 rounded w-full px-3 py-2 bg-slate-950 text-slate-100"
                >
                  <option value="">Any location</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="border border-slate-700 rounded w-full px-3 py-2 bg-slate-950 text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="border border-slate-700 rounded w-full px-3 py-2 bg-slate-950 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Days of Week *
                </label>
                <div className="flex gap-2">
                  {DAYS.map((day, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`flex-1 px-3 py-2 text-xs font-semibold rounded transition-colors ${
                        formDaysOfWeek.includes(idx)
                          ? "bg-amber-400 text-slate-950"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="inline-flex items-center text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="mr-2"
                  />
                  Active template
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-3 sticky bottom-0 bg-slate-900">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs border border-slate-700 rounded bg-slate-900 hover:bg-slate-950 text-slate-200"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-xs rounded bg-amber-400 text-slate-950 hover:bg-amber-300 font-semibold disabled:opacity-60"
              >
                {saving ? "Saving…" : editingTemplate ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
