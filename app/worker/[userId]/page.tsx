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

// Documents visible to the worker
type WorkerDocument = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  createdAt: string; // ISO string
};

type WorkerPayload = {
  worker: {
    id: string; // real DB user id
    name: string;
    employeeCode: string | null;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    postalcode: string | null;
  };
  shifts: ShiftRow[];
  documents?: WorkerDocument[]; // visibleToWorker=true
};

type CorrectionType = "MISSING_IN" | "MISSING_OUT" | "ADJUST_IN" | "ADJUST_OUT";

function getCurrentPayPeriod(today = new Date()) {
  // Mon–Sat pay period in local time
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

  // --- contact info form state ---
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactAddress1, setContactAddress1] = useState("");
  const [contactAddress2, setContactAddress2] = useState("");
  const [contactCity, setContactCity] = useState("");
  const [contactState, setContactState] = useState("");
  const [contactPostal, setContactPostal] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [contactMessage, setContactMessage] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  // --- date filter (pay period style) ---
  const initialPeriod = getCurrentPayPeriod();
  const [filterStart, setFilterStart] = useState<string>(
    fmtDateInput(initialPeriod.start)
  );
  const [filterEnd, setFilterEnd] = useState<string>(
    fmtDateInput(initialPeriod.end)
  );

  // --- correction form state ---
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [correctionType, setCorrectionType] =
    useState<CorrectionType>("ADJUST_IN");
  const [requestedClockIn, setRequestedClockIn] = useState<string>(""); // datetime-local
  const [requestedClockOut, setRequestedClockOut] = useState<string>(""); // datetime-local
  const [reason, setReason] = useState<string>("");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [correctionMessage, setCorrectionMessage] =
    useState<string | null>(null);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  // Load worker + shifts + docs
  useEffect(() => {
    if (!employeeCodeFromUrl) return;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/worker/${encodeURIComponent(employeeCodeFromUrl)}`
        );

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? "Failed to load worker data");
        }

        const payload = (await res.json()) as WorkerPayload;
        setData(payload);

        const w = payload.worker;
        setContactName(w.name ?? "");
        setContactEmail(w.email ?? "");
        setContactPhone(w.phone ?? "");
        setContactAddress1(w.addressLine1 ?? "");
        setContactAddress2(w.addressLine2 ?? "");
        setContactCity(w.city ?? "");
        setContactState(w.state ?? "");
        setContactPostal(w.postalcode ?? "");
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Could not load worker data.");
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [employeeCodeFromUrl]);

  const workerName = data?.worker.name ?? employeeCodeFromUrl ?? "Worker";
  const employeeCode =
    data?.worker.employeeCode ?? employeeCodeFromUrl ?? "—";
  const workerId = data?.worker.id ?? ""; // real user.id from DB

  // Parse filter dates for in-memory filtering
  let filterStartDate: Date | null = null;
  let filterEndDate: Date | null = null;
  if (filterStart.trim()) {
    filterStartDate = new Date(filterStart + "T00:00:00");
  }
  if (filterEnd.trim()) {
    filterEndDate = new Date(filterEnd + "T23:59:59");
  }

  const allShifts = data?.shifts ?? [];
  const filteredShifts = allShifts.filter((s) => {
    if (!filterStartDate && !filterEndDate) return true;
    const d = new Date(s.clockIn);
    if (filterStartDate && d < filterStartDate) return false;
    if (filterEndDate && d > filterEndDate) return false;
    return true;
  });

  const totalHours = filteredShifts.reduce(
    (sum, s) => sum + (s.hours || 0),
    0
  );

  const selectedShift =
    selectedShiftId && data
      ? filteredShifts.find((s) => s.id === selectedShiftId) ?? null
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
          userId: workerId,
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
        throw new Error(
          body?.error ?? "Failed to submit correction request."
        );
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

  async function saveContactInfo() {
    if (!employeeCodeFromUrl) return;

    setSavingContact(true);
    setContactMessage(null);
    setContactError(null);

    try {
      const res = await fetch(
        `/api/worker/${encodeURIComponent(employeeCodeFromUrl)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: contactName.trim() || null,
            email: contactEmail.trim() || null,
            phone: contactPhone.trim() || null,
            addressLine1: contactAddress1.trim() || null,
            addressLine2: contactAddress2.trim() || null,
            city: contactCity.trim() || null,
            state: contactState.trim() || null,
            postalcode: contactPostal.trim() || null,
          }),
        }
      );

      const body = (await res.json().catch(() => null)) as
        | WorkerPayload["worker"]
        | { error?: string }
        | null;

      if (!res.ok || !body || "error" in body) {
        const msg =
          (body && "error" in body && body.error) ||
          "Failed to save contact information.";
        throw new Error(msg);
      }

      setData((prev) =>
        prev
          ? {
              ...prev,
              worker: {
                ...prev.worker,
                ...(body as WorkerPayload["worker"]),
              },
            }
          : prev
      );

      setContactMessage("Contact information updated.");
    } catch (err: any) {
      console.error(err);
      setContactError(
        err.message ?? "Unable to save contact information."
      );
    } finally {
      setSavingContact(false);
    }
  }

  const visibleDocuments = data?.documents ?? [];

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
              Hours in range
            </p>
            <p className="mt-1 text-xl font-semibold text-amber-300">
              {totalHours.toFixed(2)}h
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {filterStart} → {filterEnd}
            </p>
          </div>
        </header>

        {/* Errors / loading */}
        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading && <p className="text-sm text-slate-300">Loading…</p>}

        {/* Contact info card */}
        {!loading && !error && data && (
          <section className="card bg-slate-900/80 border border-slate-700/80">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  My contact information
                </h2>
                <p className="text-[11px] text-slate-400">
                  Keep this up to date so the office can reach you.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Name
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Phone
                </label>
                <input
                  type="tel"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Email
                </label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Address line 1
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                  value={contactAddress1}
                  onChange={(e) => setContactAddress1(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Address line 2
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                  value={contactAddress2}
                  onChange={(e) => setContactAddress2(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  City
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                  value={contactCity}
                  onChange={(e) => setContactCity(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  State
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                  value={contactState}
                  onChange={(e) => setContactState(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Postal code
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                  value={contactPostal}
                  onChange={(e) => setContactPostal(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px] text-slate-400">
                This info is shared with the office only.
              </div>
              <button
                type="button"
                disabled={savingContact}
                onClick={saveContactInfo}
                className="rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
              >
                {savingContact ? "Saving…" : "Save contact info"}
              </button>
            </div>

            {contactMessage && (
              <p className="mt-3 text-xs text-emerald-300">
                {contactMessage}
              </p>
            )}
            {contactError && (
              <p className="mt-3 text-xs text-red-300">{contactError}</p>
            )}
          </section>
        )}

        {/* Shifts table + filter */}
        {!loading && !error && (
          <section className="card bg-slate-900/80 border border-slate-700/80">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Shifts in selected range
                </h2>
                <p className="text-[11px] text-slate-400">
                  Adjust the dates to look back at previous pay periods.
                </p>
              </div>
              <div className="flex flex-col gap-2 text-[11px] text-slate-300 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <span>From</span>
                  <input
                    type="date"
                    className="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-[11px]"
                    value={filterStart}
                    onChange={(e) => setFilterStart(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span>To</span>
                  <input
                    type="date"
                    className="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-[11px]"
                    value={filterEnd}
                    onChange={(e) => setFilterEnd(e.target.value)}
                  />
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
                  {filteredShifts.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-6 text-center text-slate-400"
                      >
                        No shifts in this date range.
                      </td>
                    </tr>
                  )}

                  {filteredShifts.map((shift) => (
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

        {/* Documents (read-only) */}
        {!loading && !error && (
          <section className="card bg-slate-900/80 border border-slate-700/80">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  My documents
                </h2>
                <p className="text-[11px] text-slate-400">
                  Forms and files shared with you by the office.
                </p>
              </div>
            </div>

            {visibleDocuments.length === 0 ? (
              <p className="text-xs text-slate-400">
                No documents have been shared with you yet.
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="admin-table min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800/80">
                      <th className="px-3 py-2 text-left">Title</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-left">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDocuments.map((doc) => (
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
                        <td className="px-3 py-2 align-middle text-slate-400">
                          {formatDateTime(doc.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}