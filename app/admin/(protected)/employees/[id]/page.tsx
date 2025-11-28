// app/admin/(protected)/employees/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type EmployeeDocument = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  visibleToWorker: boolean;
  createdAt: string;
};

type EmployeeDetail = {
  id: string;
  name: string;
  email: string | null;
  employeeCode: string | null;
  active: boolean;
  role: string;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalcode: string | null;
  hourlyRate: number | null;
  salaryAnnual: number | null;
  adminNotes: string | null;
  createdAt: string;
  documents: EmployeeDocument[];
};

export default function AdminEmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const employeeId = params.id;

  const [data, setData] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // editable fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [active, setActive] = useState(true);
  const [phone, setPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalcode, setPostalcode] = useState("");
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [salaryAnnual, setSalaryAnnual] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState("");
  const [pin, setPin] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // new document form
  const [docTitle, setDocTitle] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [docVisible, setDocVisible] = useState(true);
  const [docSaving, setDocSaving] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
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

      // Pre-fill URL with uploaded file URL
      setDocUrl(body.url);

      // If there is no title yet, derive one from the filename
      if (!docTitle.trim()) {
        setDocTitle(file.name.replace(/\.[^.]+$/, ""));
      }
    } catch (err: any) {
      console.error(err);
      setDocError(err.message ?? "Unable to upload file.");
    } finally {
      setUploadingFile(false);
      // allow selecting the same file again
      e.target.value = "";
    }
  }

  useEffect(() => {
    if (!employeeId) return;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/admin/employees/${employeeId}`);
        const body = (await res.json().catch(() => null)) as
          | EmployeeDetail
          | { error?: string }
          | null;

        if (!res.ok || !body || "error" in body) {
          throw new Error(
            (body && "error" in body && body.error) ||
              "Failed to load employee."
          );
        }

        const detail = body as EmployeeDetail;
        setData(detail);

        setName(detail.name ?? "");
        setEmail(detail.email ?? "");
        setEmployeeCode(detail.employeeCode ?? "");
        setActive(detail.active);
        setPhone(detail.phone ?? "");
        setAddress1(detail.addressLine1 ?? "");
        setAddress2(detail.addressLine2 ?? "");
        setCity(detail.city ?? "");
        setState(detail.state ?? "");
        setPostalcode(detail.postalcode ?? "");
        setHourlyRate(
          detail.hourlyRate != null ? detail.hourlyRate.toString() : ""
        );
        setSalaryAnnual(
          detail.salaryAnnual != null ? detail.salaryAnnual.toString() : ""
        );
        setAdminNotes(detail.adminNotes ?? "");
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Could not load employee.");
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [employeeId]);

  async function handleSave() {
    if (!employeeId) return;

    // simple PIN validation in UI
    if (pin.trim().length > 0 && !/^\d{4}$/.test(pin.trim())) {
      setSaveError("PIN must be exactly 4 digits (0–9).");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const body: any = {
        name: name.trim() || null,
        email: email.trim() || null,
        employeeCode: employeeCode.trim() || null,
        active,
        phone: phone.trim() || null,
        addressLine1: address1.trim() || null,
        addressLine2: address2.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        postalcode: postalcode.trim() || null,
        hourlyRate: hourlyRate.trim() === "" ? null : Number(hourlyRate),
        salaryAnnual:
          salaryAnnual.trim() === "" ? null : Number(salaryAnnual),
        adminNotes: adminNotes.trim() || null,
      };

      if (pin.trim().length > 0) {
        body.pin = pin.trim();
      }

      const res = await fetch(`/api/admin/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const respBody = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!res.ok || !respBody || "error" in respBody) {
        throw new Error(
          (respBody && "error" in respBody && respBody.error) ||
            "Failed to save employee."
        );
      }

      setSaveMessage("Changes saved.");
      setPin("");
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message ?? "Unexpected error while saving.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateDocument() {
    if (!employeeId) return;
    if (!docTitle.trim() || !docUrl.trim()) {
      setDocError("Title and URL are required.");
      return;
    }

    setDocSaving(true);
    setDocError(null);

    try {
      const res = await fetch(
        `/api/admin/employees/${employeeId}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: docTitle.trim(),
            url: docUrl.trim(),
            description: docDescription.trim() || null,
            visibleToWorker: docVisible,
          }),
        }
      );

      const body = (await res.json().catch(() => null)) as
        | EmployeeDocument
        | { error?: string }
        | null;

      if (!res.ok || !body || "error" in body) {
        throw new Error(
          (body && "error" in body && body.error) ||
            "Failed to create document."
        );
      }

      const newDoc = body as EmployeeDocument;

      setData((prev) =>
        prev ? { ...prev, documents: [newDoc, ...prev.documents] } : prev
      );

      setDocTitle("");
      setDocUrl("");
      setDocDescription("");
      setDocVisible(true);
    } catch (err: any) {
      console.error(err);
      setDocError(err.message ?? "Unable to create document.");
    } finally {
      setDocSaving(false);
    }
  }

  async function toggleDocumentVisibility(doc: EmployeeDocument) {
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibleToWorker: !doc.visibleToWorker,
        }),
      });

      const body = (await res.json().catch(() => null)) as
        | EmployeeDocument
        | { error?: string }
        | null;

      if (!res.ok || !body || "error" in body) {
        throw new Error(
          (body && "error" in body && body.error) ||
            "Failed to update document."
        );
      }

      const updated = body as EmployeeDocument;

      setData((prev) =>
        prev
          ? {
              ...prev,
              documents: prev.documents.map((d) =>
                d.id === updated.id ? updated : d
              ),
            }
          : prev
      );
    } catch (err) {
      console.error(err);
      alert("Failed to toggle visibility.");
    }
  }

  async function deleteDocument(docId: string) {
    if (!window.confirm("Delete this document?")) return;

    try {
      const res = await fetch(`/api/admin/documents/${docId}`, {
        method: "DELETE",
      });

      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok || (body && body.error)) {
        throw new Error(body?.error ?? "Failed to delete document.");
      }

      setData((prev) =>
        prev
          ? {
              ...prev,
              documents: prev.documents.filter((d) => d.id !== docId),
            }
          : prev
      );
    } catch (err) {
      console.error(err);
      alert("Failed to delete document.");
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-300">Loading employee…</p>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-300">{error ?? "Employee not found."}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-slate-600 px-4 py-1.5 text-xs text-slate-100 hover:bg-slate-800"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">
            {data.name || "Unnamed employee"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Code:{" "}
            <span className="font-mono text-slate-100">
              {data.employeeCode ?? "—"}
            </span>{" "}
            · Role:{" "}
            <span className="font-mono text-slate-200">{data.role}</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Created{" "}
            {new Date(data.createdAt).toLocaleString("en-US", {
              month: "2-digit",
              day: "2-digit",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <span
            className={
              data.active
                ? "inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-300 border border-emerald-500/40"
                : "inline-flex items-center rounded-full bg-slate-700/40 px-3 py-1 text-[11px] font-semibold text-slate-200 border border-slate-600/60"
            }
          >
            {data.active ? "Can clock in" : "Inactive"}
          </span>
          {data.employeeCode && (
            <Link
              href={`/worker/${encodeURIComponent(data.employeeCode)}`}
              target="_blank"
              className="text-[11px] text-amber-300 hover:underline"
            >
              Open worker portal →
            </Link>
          )}
        </div>
      </div>

      {/* Basic info + pay + admin notes */}
      <section className="card bg-slate-900/70 border border-slate-700/80">
        <h2 className="text-sm font-semibold text-slate-100 mb-3">
          Employee details
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Name
            </label>
            <input
              type="text"
              className="mt-1 w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Employee code
            </label>
            <input
              type="text"
              className="mt-1 w-full"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Email
            </label>
            <input
              type="email"
              className="mt-1 w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Phone
            </label>
            <input
              type="tel"
              className="mt-1 w-full"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Address line 1
            </label>
            <input
              type="text"
              className="mt-1 w-full"
              value={address1}
              onChange={(e) => setAddress1(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Address line 2
            </label>
            <input
              type="text"
              className="mt-1 w-full"
              value={address2}
              onChange={(e) => setAddress2(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              City
            </label>
            <input
              type="text"
              className="mt-1 w-full"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              State
            </label>
            <input
              type="text"
              className="mt-1 w-full"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Postal code
            </label>
            <input
              type="text"
              className="mt-1 w-full"
              value={postalcode}
              onChange={(e) => setPostalcode(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Active (can clock in)
            </label>
            <button
              type="button"
              onClick={() => setActive((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                active ? "bg-emerald-500" : "bg-slate-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  active ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              New PIN (optional)
            </label>
            <input
              type="password"
              maxLength={4}
              inputMode="numeric"
              pattern="\d{4}"
              className="mt-1 w-full"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              4 digits; leave blank to keep current PIN.
            </p>
          </div>
        </div>

        {/* Pay + admin notes */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold text-slate-200 mb-2">
              Pay info
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Hourly rate ($/hr)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Annual salary ($/yr)
                </label>
                <input
                  type="number"
                  step="1"
                  className="mt-1 w-full"
                  value={salaryAnnual}
                  onChange={(e) => setSalaryAnnual(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-200 mb-2">
              Admin notes (private)
            </h3>
            <textarea
              rows={6}
              className="w-full"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Notes only visible to admin (performance, pay history, etc.)"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] text-slate-400">
            Changes are saved for this employee only.
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>

        {saveMessage && (
          <p className="mt-3 text-xs text-emerald-300">{saveMessage}</p>
        )}
        {saveError && (
          <p className="mt-3 text-xs text-red-300">{saveError}</p>
        )}
      </section>

      {/* Documents */}
      <section className="card bg-slate-900/70 border border-slate-700/80">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Documents
            </h2>
            <p className="text-[11px] text-slate-400">
              Files and links attached to this employee. You can control what
              shows up in the worker portal.
            </p>
          </div>
        </div>

        {/* New document form */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Title
            </label>
            <input
              type="text"
              className="mt-1 w-full"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="e.g. W-4 Form"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              URL
            </label>
            <input
              type="text"
              className="mt-1 w-full"
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="Paste a link or upload a PDF"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
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
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Description (optional)
            </label>
            <input
              type="text"
              className="mt-1 w-full"
              value={docDescription}
              onChange={(e) => setDocDescription(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Visible to worker
            </label>
            <button
              type="button"
              onClick={() => setDocVisible((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                docVisible ? "bg-emerald-500" : "bg-slate-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  docVisible ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <button
            type="button"
            disabled={docSaving}
            onClick={handleCreateDocument}
            className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
          >
            {docSaving ? "Adding…" : "Add document"}
          </button>
        </div>

        {docError && (
          <p className="mt-1 mb-4 text-xs text-red-300">{docError}</p>
        )}

        {/* Document list */}
        {data.documents.length === 0 ? (
          <p className="text-xs text-slate-400">
            No documents attached yet.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="admin-table min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800/80">
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Visible</th>
                  <th className="px-3 py-2 text-left">Uploaded</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-slate-800/80">
                    <td className="px-3 py-2 align-middle">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-300 hover:underline"
                      >
                        {doc.title}
                      </a>
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-300">
                      {doc.description ?? "—"}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <button
                        type="button"
                        onClick={() => toggleDocumentVisibility(doc)}
                        className={
                          doc.visibleToWorker
                            ? "inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/40"
                            : "inline-flex items-center rounded-full bg-slate-700/40 px-2 py-0.5 text-[10px] font-semibold text-slate-200 border border-slate-600/60"
                        }
                      >
                        {doc.visibleToWorker ? "Shown to worker" : "Hidden"}
                      </button>
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-400">
                      {new Date(doc.createdAt).toLocaleString("en-US", {
                        month: "2-digit",
                        day: "2-digit",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2 align-middle text-right">
                      <button
                        type="button"
                        onClick={() => deleteDocument(doc.id)}
                        className="rounded-full bg-red-500/80 px-3 py-1 text-[11px] font-semibold text-slate-50 hover:bg-red-400"
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