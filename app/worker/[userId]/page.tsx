// app/worker/[userId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type ShiftRow = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  locationName: string;
  adhoc: boolean;
  hours: number;
  notes: string | null;
};

type WorkerPayload = {
  worker: {
    id: string; // real DB user id
    name: string;
    employeeCode: string | null;
    email?: string | null;
    phone?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
  };
  shifts: ShiftRow[];
};

type WorkerDocument = {
  id: string;
  name: string;
  fileUrl: string;
  visibleToWorker: boolean;
  uploadedByAdmin: boolean;
  createdAt: string;
};

type CorrectionType = "MISSING_IN" | "MISSING_OUT" | "ADJUST_IN" | "ADJUST_OUT";

function getCurrentPayPeriod(today = new Date()) {
  // Mon–Sat
  const d = new Date(today);
  const day = d.getDay(); // 0 Sun, 1 Mon, ...
  const diffToMonday = (day + 6) % 7; // Mon->0
  const start = new Date(d);
  start.setDate(d.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 5);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function fmtDateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// For <input type="datetime-local"> value
function toLocalDateTimeInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function WorkerProfilePage() {
  // In your routing, [userId] is actually the employeeCode in the URL, e.g. /worker/KYLE
  const params = useParams<{ userId: string }>();
  const employeeCodeFromUrl = params.userId;

  const [data, setData] = useState<WorkerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pay-period (Mon–Sat) range
  const [periodStart, setPeriodStart] = useState<string>(() => {
    const { start } = getCurrentPayPeriod();
    return fmtDateInput(start);
  });
  const [periodEnd, setPeriodEnd] = useState<string>(() => {
    const { end } = getCurrentPayPeriod();
    return fmtDateInput(end);
  });

  // Contact info
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Documents
  const [docs, setDocs] = useState<WorkerDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [newDocName, setNewDocName] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");
  const [docMessage, setDocMessage] = useState<string | null>(null);

  // --- correction form state ---
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [correctionType, setCorrectionType] =
    useState<CorrectionType>("ADJUST_IN");
  const [requestedClockIn, setRequestedClockIn] = useState<string>(""); // datetime-local
  const [requestedClockOut, setRequestedClockOut] = useState<string>(""); // datetime-local
  const [reason, setReason] = useState<string>("");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [correctionMessage, setCorrectionMessage] = useState<string | null>(
    null
  );
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  // Load worker + shifts for the current period
  useEffect(() => {
    if (!employeeCodeFromUrl) return;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (periodStart) params.set("start", periodStart);
        if (periodEnd) params.set("end", periodEnd);

        const res = await fetch(
          `/api/worker/${encodeURIComponent(
            employeeCodeFromUrl
          )}?${params.toString()}`
        );

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? "Failed to load worker data");
        }

        const payload = (await res.json()) as WorkerPayload;
        setData(payload);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Could not load worker data.");
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [employeeCodeFromUrl, periodStart, periodEnd]);

  // When worker data loads, sync contact info fields
  useEffect(() => {
    if (!data?.worker) return;
    setEmail(data.worker.email ?? "");
    setPhone(data.worker.phone ?? "");
    setAddressLine1(data.worker.addressLine1 ?? "");
    setAddressLine2(data.worker.addressLine2 ?? "");
    setCity(data.worker.city ?? "");
    setStateVal(data.worker.state ?? "");
    setPostalCode(data.worker.postalCode ?? "");
  }, [data?.worker]);

  const workerName = data?.worker.name ?? employeeCodeFromUrl ?? "Worker";
  const employeeCode = data?.worker.employeeCode ?? employeeCodeFromUrl ?? "—";
  const workerId = data?.worker.id ?? ""; // real user.id from DB

  const totalHours = data
    ? data.shifts.reduce((sum, s) => sum + (s.hours || 0), 0)
    : 0;

  const selectedShift =
    selectedShiftId && data
      ? data.shifts.find((s) => s.id === selectedShiftId) ?? null
      : null;

  function openCorrectionForm(shift: ShiftRow) {
    setSelectedShiftId(shift.id);
    setCorrectionType("ADJUST_IN");
    setRequestedClockIn(toLocalDateTimeInputValue(shift.clockIn));
    setRequestedClockOut(toLocalDateTimeInputValue(shift.clockOut));
    setReason("");
    setCorrectionMessage(null);
    setCorrectionError(null);
  }

  function resetCorrectionForm() {
    setSelectedShiftId(null);
    setCorrectionMessage(null);
    setCorrectionError(null);
    setRequestedClockIn("");
    setRequestedClockOut("");
    setReason("");
  }

  async function submitCorrection() {
    // IMPORTANT: use workerId (real user.id), not employeeCode
    if (!data || !workerId || !selectedShiftId) return;

    setSubmittingCorrection(true);
    setCorrectionMessage(null);
    setCorrectionError(null);

    try {
      const requestedClockInIso =
        requestedClockIn.trim().length > 0
          ? new Date(requestedClockIn).toISOString()
          : null;

      const requestedClockOutIso =
        requestedClockOut.trim().length > 0
          ? new Date(requestedClockOut).toISOString()
          : null;

      const res = await fetch("/api/clock/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: workerId, // <-- this is what the API expects
          shiftId: selectedShiftId,
          type: correctionType,
          requestedClockIn: requestedClockInIso,
          requestedClockOut: requestedClockOutIso,
          reason: reason.trim(),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "Failed to submit correction request.");
      }

      setCorrectionMessage(
        "Your change request has been sent for review. An admin will approve or deny it."
      );
    } catch (err: any) {
      console.error(err);
      setCorrectionError(
        err.message ?? "Unable to submit correction request."
      );
    } finally {
      setSubmittingCorrection(false);
    }
  }

  // Shift pay period backwards / forwards by whole weeks
  function shiftPeriod(weeks: number) {
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    startDate.setDate(startDate.getDate() + weeks * 7);
    endDate.setDate(endDate.getDate() + weeks * 7);

    setPeriodStart(fmtDateInput(startDate));
    setPeriodEnd(fmtDateInput(endDate));
  }

  async function saveProfile() {
    if (!workerId) return;
    setProfileMessage(null);
    setProfileError(null);

    try {
      const res = await fetch("/api/worker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: workerId,
          email,
          phone,
          addressLine1,
          addressLine2,
          city,
          state: stateVal,
          postalCode,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "Failed to save profile.");
      }

      setProfileMessage("Profile saved.");
    } catch (err: any) {
      console.error(err);
      setProfileError(err.message ?? "Could not save profile.");
    }
  }

  // Load worker-visible documents when we know the workerId
  useEffect(() => {
    if (!workerId) return;

    async function loadDocs() {
      try {
        setDocsLoading(true);
        setDocsError(null);
        const res = await fetch(
          `/api/worker/documents?userId=${encodeURIComponent(workerId)}`
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? "Failed to load documents.");
        }
        const docsPayload = (await res.json()) as WorkerDocument[];
        setDocs(docsPayload);
      } catch (err: any) {
        console.error(err);
        setDocsError(err.message ?? "Could not load documents.");
      } finally {
        setDocsLoading(false);
      }
    }

    void loadDocs();
  }, [workerId]);

  async function addDocument() {
    if (!workerId || !newDocName.trim() || !newDocUrl.trim()) return;

    setDocMessage(null);
    setDocsError(null);

    try {
      const res = await fetch("/api/worker/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: workerId,
          name: newDocName.trim(),
          fileUrl: newDocUrl.trim(),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "Failed to add document.");
      }

      const created = (await res.json()) as WorkerDocument;
      setDocs((prev) => [created, ...prev]);
      setNewDocName("");
      setNewDocUrl("");
      setDocMessage("Document added.");
    } catch (err: any) {
      console.error(err);
      setDocsError(err.message ?? "Could not add document.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{workerName}</h1>
            <p className="mt-1 text-sm text-slate-400">
              Employee code:{" "}
              <span className="font-mono text-slate-100">{employeeCode}</span>
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Total hours (listed shifts)
            </p>
            <p className="mt-1 text-xl font-semibold text-amber-300">
              {totalHours.toFixed(2)}h
            </p>
          </div>
        </header>

        {/* Errors / loading */}
        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Contact info card */}
        {!loading && !error && (
          <section className="card bg-slate-900/80 border border-slate-700/80">
            <h2 className="text-sm font-semibold text-slate-100 mb-3">
              Contact information
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Address line 1
                </label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Address line 2
                </label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  State
                </label>
                <input
                  type="text"
                  value={stateVal}
                  onChange={(e) => setStateVal(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  ZIP
                </label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={saveProfile}
                className="rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
              >
                Save profile
              </button>
            </div>

            {profileMessage && (
              <p className="mt-2 text-xs text-emerald-300">{profileMessage}</p>
            )}
            {profileError && (
              <p className="mt-2 text-xs text-red-300">{profileError}</p>
            )}
          </section>
        )}

        {/* Documents card */}
        {!loading && !error && (
          <section className="card bg-slate-900/80 border border-slate-700/80">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="text-sm font-semibold text-slate-100">
                Documents
              </h2>
              <p className="text-[11px] text-slate-400">
                Files like W-4s or certifications shared with the office.
              </p>
            </div>

            {docsLoading && (
              <p className="text-xs text-slate-300 mb-2">Loading docs…</p>
            )}
            {docsError && (
              <p className="text-xs text-red-300 mb-2">{docsError}</p>
            )}

            {/* Add document */}
            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              <input
                type="text"
                placeholder="Document name (e.g. W-4 2025)"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 sm:col-span-1"
              />
              <input
                type="url"
                placeholder="Link to file (e.g. from Drive)"
                value={newDocUrl}
                onChange={(e) => setNewDocUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 sm:col-span-2"
              />
              <div className="sm:col-span-3 flex justify-end mt-2">
                <button
                  type="button"
                  onClick={addDocument}
                  className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
                >
                  Add document
                </button>
              </div>
            </div>

            {docMessage && (
              <p className="text-xs text-emerald-300 mb-2">{docMessage}</p>
            )}

            <div className="mt-1 border-t border-slate-800/80 pt-3">
              {docs.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No documents on file yet.
                </p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {docs.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-300 hover:text-amber-200 underline"
                        >
                          {doc.name}
                        </a>
                        <div className="text-[10px] text-slate-500">
                          Added{" "}
                          {new Date(doc.createdAt).toLocaleDateString(
                            "en-US"
                          )}
                        </div>
                      </div>
                      {doc.uploadedByAdmin && (
                        <span className="text-[10px] rounded-full border border-slate-600 px-2 py-0.5 text-slate-300">
                          Added by office
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* Shifts table */}
        {!loading && !error && (
          <section className="card bg-slate-900/80 border border-slate-700/80">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Shifts
                </h2>
                <p className="text-[11px] text-slate-400">
                  View and request changes to your recorded hours.
                </p>
              </div>

              {/* Pay-period controls */}
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-400">Pay period:</span>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-100"
                  />
                  <span className="text-slate-500">to</span>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-100"
                  />
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => shiftPeriod(-1)}
                    className="rounded-full border border-slate-700 px-3 py-0.5 text-[11px] text-slate-100 hover:bg-slate-800"
                  >
                    ◀ Prev period
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const { start, end } = getCurrentPayPeriod();
                      setPeriodStart(fmtDateInput(start));
                      setPeriodEnd(fmtDateInput(end));
                    }}
                    className="rounded-full border border-slate-700 px-3 py-0.5 text-[11px] text-slate-100 hover:bg-slate-800"
                  >
                    Today&apos;s period
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftPeriod(1)}
                    className="rounded-full border border-slate-700 px-3 py-0.5 text-[11px] text-slate-100 hover:bg-slate-800"
                  >
                    Next period ▶
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2 overflow-x-auto">
              <table className="admin-table min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80">
                    <th className="px-3 py-2 text-left">Clock in</th>
                    <th className="px-3 py-2 text-left">Clock out</th>
                    <th className="px-3 py-2 text-left">Location</th>
                    <th className="px-3 py-2 text-right">Hours</th>
                    <th className="px-3 py-2 text-left">Notes</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(!data || data.shifts.length === 0) && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-6 text-center text-slate-400"
                      >
                        No shifts recorded for this period.
                      </td>
                    </tr>
                  )}

                  {data?.shifts.map((shift) => (
                    <tr
                      key={shift.id}
                      className="border-b border-slate-800/80"
                    >
                      <td className="px-3 py-2 align-middle text-slate-200">
                        {formatDateTime(shift.clockIn)}
                      </td>
                      <td className="px-3 py-2 align-middle text-slate-200">
                        {formatDateTime(shift.clockOut)}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <span
                          className={
                            shift.adhoc
                              ? "inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-200 border border-amber-500/40"
                              : "inline-flex items-center rounded-full bg-slate-700/40 px-2 py-0.5 text-[11px] font-medium text-slate-100 border border-slate-600/60"
                          }
                        >
                          {shift.locationName}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-middle text-right text-slate-50">
                        {shift.hours.toFixed(2)}h
                      </td>
                      <td className="px-3 py-2 align-middle text-slate-300">
                        {shift.notes ?? (shift.adhoc ? "ADHOC clock-in" : "—")}
                      </td>
                      <td className="px-3 py-2 align-middle text-right">
                        <button
                          type="button"
                          onClick={() => openCorrectionForm(shift)}
                          className="rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:bg-slate-800"
                        >
                          Request change
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Correction form */}
            {selectedShift && (
              <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      Request shift change
                    </h3>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Your request will be sent to the office for approval.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetCorrectionForm}
                    className="text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    ✕ Close
                  </button>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Change type
                    </label>
                    <select
                      value={correctionType}
                      onChange={(e) =>
                        setCorrectionType(e.target.value as CorrectionType)
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                    >
                      <option value="ADJUST_IN">Adjust clock-in time</option>
                      <option value="ADJUST_OUT">Adjust clock-out time</option>
                      <option value="MISSING_IN">Missing clock-in</option>
                      <option value="MISSING_OUT">Missing clock-out</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Clock-in (new)
                    </label>
                    <input
                      type="datetime-local"
                      value={requestedClockIn}
                      onChange={(e) => setRequestedClockIn(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Clock-out (new)
                    </label>
                    <input
                      type="datetime-local"
                      value={requestedClockOut}
                      onChange={(e) => setRequestedClockOut(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                    />
                    <p className="mt-1 text-[10px] text-slate-500">
                      Leave blank if you are only correcting the clock-in.
                    </p>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Reason for change
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                      placeholder="Example: Forgot to clock out when leaving the job site."
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-[11px] text-slate-400">
                    Admin will see this under{" "}
                    <span className="font-semibold">Exceptions</span> and can
                    approve or deny.
                  </div>
                  <button
                    type="button"
                    disabled={submittingCorrection}
                    onClick={submitCorrection}
                    className="rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
                  >
                    {submittingCorrection ? "Sending…" : "Submit request"}
                  </button>
                </div>

                {correctionMessage && (
                  <p className="mt-3 text-xs text-emerald-300">
                    {correctionMessage}
                  </p>
                )}
                {correctionError && (
                  <p className="mt-3 text-xs text-red-300">
                    {correctionError}
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {loading && !error && (
          <p className="text-sm text-slate-300">Loading…</p>
        )}
      </div>
    </div>
  );
}