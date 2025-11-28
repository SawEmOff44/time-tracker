"use client";

import { useEffect, useState } from "react";
import type React from "react";
import Link from "next/link";

type AdminUser = {
  id: string;
  name: string;
  email: string | null;
  employeeCode: string | null;
  active: boolean;
  createdAt: string;

  phone?: string | null;
  hourlyRate?: number | null;
  // salaryAnnual?: number | null; // future
  adminNotes?: string | null;
};

type EmployeeDocument = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  visibleToWorker: boolean;
  createdAt: string;
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
  const [editPin, setEditPin] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editHourlyRate, setEditHourlyRate] = useState<string>("");
  const [editAdminNotes, setEditAdminNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");
  const [newDocVisible, setNewDocVisible] = useState(true);
  const [docError, setDocError] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

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
    setEditPhone(user.phone ?? "");
    setEditHourlyRate(
      typeof user.hourlyRate === "number" ? String(user.hourlyRate) : ""
    );
    setEditAdminNotes(user.adminNotes ?? "");
    setEditError(null);

    // reset and load documents for this employee
    setDocuments([]);
    setDocsLoading(true);
    setDocError(null);
    setNewDocTitle("");
    setNewDocUrl("");
    setNewDocVisible(true);

    void (async () => {
      try {
        const res = await fetch(`/api/admin/employees/${user.id}/documents`);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? "Failed to load documents.");
        }
        const docs = (await res.json()) as EmployeeDocument[];
        setDocuments(docs);
      } catch (err: any) {
        console.error(err);
        setDocError(err.message ?? "Could not load documents.");
      } finally {
        setDocsLoading(false);
      }
    })();
  }

  function closeEdit() {
    setEditingUser(null);
    setEditPin("");
    setEditError(null);
    setDocuments([]);
    setDocError(null);
    setDocsLoading(false);
    setNewDocTitle("");
    setNewDocUrl("");
    setNewDocVisible(true);
  }

  async function handleSaveEdit() {
    if (!editingUser) return;

    if (editPin.trim().length > 0 && !/^\d{4}$/.test(editPin.trim())) {
      setEditError("PIN must be exactly 4 digits (0–9).");
      return;
    }

    let hourlyRateNumber: number | null = null;
    if (editHourlyRate.trim().length > 0) {
      const n = Number(editHourlyRate.trim());
      if (!Number.isFinite(n) || n < 0) {
        setEditError("Hourly rate must be a non-negative number.");
        return;
      }
      hourlyRateNumber = n;
    }

    setSavingEdit(true);
    setEditError(null);

    try {
      const body: any = {
        name: editName.trim(),
        email: editEmail.trim() || null,
        employeeCode: editEmployeeCode.trim() || null,
        active: editActive,
        phone: editPhone.trim() || null,
        hourlyRate: hourlyRateNumber,
        adminNotes:
          editAdminNotes.trim().length > 0 ? editAdminNotes.trim() : null,
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

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocError(null);
    setUploadingFile(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const body = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;

      if (!res.ok || !body?.url) {
        throw new Error(body?.error ?? "Upload failed.");
      }

      // Pre-fill URL and title for the new document
      setNewDocUrl(body.url);
      if (!newDocTitle.trim()) {
        setNewDocTitle(file.name.replace(/\.[^.]+$/, ""));
      }
    } catch (err: any) {
      console.error(err);
      setDocError(err.message ?? "Unable to upload file.");
    } finally {
      setUploadingFile(false);
      // allow selecting the same file again later
      e.target.value = "";
    }
  }

  async function handleAddDocument() {
    if (!editingUser) return;
    if (!newDocTitle.trim() || !newDocUrl.trim()) {
      setDocError("Title and URL are required.");
      return;
    }

    setDocError(null);
    try {
      const res = await fetch(
        `/api/admin/employees/${editingUser.id}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newDocTitle.trim(),
            url: newDocUrl.trim(),
            visibleToWorker: newDocVisible,
          }),
        }
      );

      const body = (await res.json().catch(() => null)) as
        | EmployeeDocument
        | { error?: string }
        | null;

      if (!res.ok || !body || "error" in body) {
        throw new Error(
          (body as any)?.error ?? "Failed to create document."
        );
      }

      const doc = body as EmployeeDocument;
      setDocuments((prev) => [doc, ...prev]);
      setNewDocTitle("");
      setNewDocUrl("");
      setNewDocVisible(true);
    } catch (err: any) {
      console.error(err);
      setDocError(err.message ?? "Unable to add document.");
    }
  }

  async function handleToggleDocVisibility(doc: EmployeeDocument) {
    if (!editingUser) return;
    setDocError(null);

    try {
      const res = await fetch(
        `/api/admin/employees/${editingUser.id}/documents/${doc.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visibleToWorker: !doc.visibleToWorker,
          }),
        }
      );

      const body = (await res.json().catch(() => null)) as
        | EmployeeDocument
        | { error?: string }
        | null;

      if (!res.ok || !body || "error" in body) {
        throw new Error(
          (body as any)?.error ?? "Failed to update document."
        );
      }

      const updated = body as EmployeeDocument;
      setDocuments((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      );
    } catch (err: any) {
      console.error(err);
      setDocError(err.message ?? "Unable to update document.");
    }
  }

  async function handleDeleteDoc(doc: EmployeeDocument) {
    if (!editingUser) return;
    if (
      !window.confirm(
        `Delete document "${doc.title}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setDocError(null);

    try {
      const res = await fetch(
        `/api/admin/employees/${editingUser.id}/documents/${doc.id}`,
        {
          method: "DELETE",
        }
      );

      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!res.ok || (body && body.error)) {
        throw new Error(body?.error ?? "Failed to delete document.");
      }

      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err: any) {
      console.error(err);
      setDocError(err.message ?? "Unable to delete document.");
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Employees</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage workers, review pending accounts, reset PINs, and control who
          can clock in. Click through to see each worker&apos;s self-service
          page.
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
            No active employees yet. Approve pending workers above, or add
            employees via your other tools.
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
                  <th className="px-3 py-2 text-left">Phone</th>
                  <th className="px-3 py-2 text-left">Pay</th>
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
                    <td className="px-3 py-2 align-middle text-slate-300">
                      {u.phone ?? "—"}
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-200">
                      {typeof u.hourlyRate === "number"
                        ? `$${u.hourlyRate.toFixed(2)}/hr`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 align-middle text-right">
                      <div className="inline-flex gap-2">
                        {u.employeeCode && (
                          <Link
                            href={`/worker/${encodeURIComponent(u.employeeCode)}`}
                            className="rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-50 hover:bg-slate-700/70"
                          >
                            Worker page
                          </Link>
                        )}
                        <Link
                          href={`/admin/employees/${u.id}`}
                          className="rounded-full bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-50 hover:bg-slate-700"
                        >
                          View profile
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="rounded-full bg-slate-700/80 px-3 py-1 text-[11px] font-semibold text-slate-50 hover:bg-slate-600"
                        >
                          Edit / Pay / PIN
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
              Update contact info, hourly rate, or set a new 4-digit PIN.
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

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Phone
                </label>
                <input
                  type="tel"
                  className="mt-1 w-full"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Hourly rate (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="mt-1 w-full"
                  value={editHourlyRate}
                  onChange={(e) => setEditHourlyRate(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Salary support can be layered in later; for now we track base
                  hourly pay.
                </p>
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

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Admin notes (private)
                </label>
                <textarea
                  rows={3}
                  className="mt-1 w-full"
                  value={editAdminNotes}
                  onChange={(e) => setEditAdminNotes(e.target.value)}
                  placeholder="Notes here are only visible to admins."
                />
              </div>

              {/* Documents section */}
              <div className="mt-4 border-t border-slate-700 pt-4">
                <h3 className="text-xs font-semibold text-slate-200 mb-2">
                  Documents for this employee
                </h3>
                <p className="text-[11px] text-slate-400 mb-3">
                  Attach links to contracts, licenses, or other files. Toggle whether
                  the worker can see each one on their portal.
                </p>

                <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-end">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Title
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full"
                      value={newDocTitle}
                      onChange={(e) => setNewDocTitle(e.target.value)}
                      placeholder="e.g. W-4 form, Driver's license"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      URL
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full"
                      value={newDocUrl}
                      onChange={(e) => setNewDocUrl(e.target.value)}
                      placeholder="Paste a link (Google Drive, Dropbox, etc.)"
                    />
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={newDocVisible}
                          onChange={(e) => setNewDocVisible(e.target.checked)}
                        />
                        Visible to worker
                      </label>

                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <span className="rounded-full border border-slate-600 px-2 py-1 text-[10px] text-slate-100 hover:bg-slate-700">
                          Upload PDF from computer
                        </span>
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={handleUploadFile}
                        />
                      </label>

                      {uploadingFile && (
                        <span className="text-[10px] text-slate-300">
                          Uploading…
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddDocument}
                    className="rounded-full bg-amber-400 px-3 py-2 text-[11px] font-semibold text-slate-950 hover:bg-amber-300"
                  >
                    Add
                  </button>
                </div>

                {docsLoading && (
                  <p className="text-[11px] text-slate-400 mb-2">
                    Loading documents…
                  </p>
                )}

                {docError && (
                  <p className="text-[11px] text-red-300 mb-2">{docError}</p>
                )}

                {!docsLoading && documents.length === 0 && !docError && (
                  <p className="text-[11px] text-slate-500">
                    No documents yet for this employee.
                  </p>
                )}

                {documents.length > 0 && (
                  <ul className="mt-2 space-y-2 max-h-40 overflow-auto pr-1">
                    {documents.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-semibold text-sky-300 hover:underline truncate"
                              title={doc.title}
                            >
                              {doc.title}
                            </a>
                            <span
                              className={
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium border " +
                                (doc.visibleToWorker
                                  ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/50"
                                  : "bg-slate-700/40 text-slate-200 border-slate-500/60")
                              }
                            >
                              {doc.visibleToWorker ? "Worker can see" : "Admin only"}
                            </span>
                          </div>
                          {doc.description && (
                            <p className="mt-1 text-[10px] text-slate-400 line-clamp-2">
                              {doc.description}
                            </p>
                          )}
                          <p className="mt-1 text-[9px] text-slate-500">
                            Added{" "}
                            {new Date(doc.createdAt).toLocaleString("en-US", {
                              month: "2-digit",
                              day: "2-digit",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleDocVisibility(doc)}
                            className="rounded-full border border-slate-600 px-2 py-0.5 text-[9px] text-slate-100 hover:bg-slate-700"
                          >
                            {doc.visibleToWorker ? "Hide from worker" : "Show to worker"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc)}
                            className="rounded-full border border-red-500/60 px-2 py-0.5 text-[9px] text-red-200 hover:bg-red-500/20"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
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