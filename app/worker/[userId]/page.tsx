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
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    postalcode: string | null;
  };
  shifts: ShiftRow[];
};

type CorrectionType =
  | "MISSING_IN"
  | "MISSING_OUT"
  | "ADJUST_IN"
  | "ADJUST_OUT";

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
  const params = useParams<{ userId: string }>();
  const employeeCodeFromUrl = params.userId;

  const [data, setData] = useState<WorkerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // profile form state
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress1, setProfileAddress1] = useState("");
  const [profileAddress2, setProfileAddress2] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profileState, setProfileState] = useState("");
  const [profilePostal, setProfilePostal] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // correction form state
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [correctionType, setCorrectionType] =
    useState<CorrectionType>("ADJUST_IN");
  const [requestedClockIn, setRequestedClockIn] = useState<string>("");
  const [requestedClockOut, setRequestedClockOut] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [correctionMessage, setCorrectionMessage] = useState<string | null>(
    null
  );
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  // Load worker + shifts
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

        // hydrate profile form
        const w = payload.worker;
        setProfileName(w.name ?? "");
        setProfileEmail(w.email ?? "");
        setProfilePhone(w.phone ?? "");
        setProfileAddress1(w.addressLine1 ?? "");
        setProfileAddress2(w.addressLine2 ?? "");
        setProfileCity(w.city ?? "");
        setProfileState(w.state ?? "");
        setProfilePostal(w.postalcode ?? "");
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
  const employeeCode = data?.worker.employeeCode ?? employeeCodeFromUrl ?? "—";
  const workerId = data?.worker.id ?? "";

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

  async function saveProfile() {
    if (!employeeCodeFromUrl) return;

    setProfileSaving(true);
    setProfileMessage(null);
    setProfileError(null);

    try {
      const res = await fetch(
        `/api/worker/${encodeURIComponent(employeeCodeFromUrl)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: profileName.trim(),
            email: profileEmail.trim() || null,
            phone: profilePhone.trim() || null,
            addressLine1: profileAddress1.trim() || null,
            addressLine2: profileAddress2.trim() || null,
            city: profileCity.trim() || null,
            state: profileState.trim() || null,
            postalcode: profilePostal.trim() || null,
          }),
        }
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "Failed to save profile.");
      }

      setProfileMessage("Profile saved.");
    } catch (err: any) {
      console.error(err);
      setProfileError(err.message ?? "Unable to save profile.");
    } finally {
      setProfileSaving(false);
    }
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{workerName}</h1>
            <p className="mt-1 text-sm text-slate-400">
              Employee code:{" "}
              <span className="font-mono text-slate-100">
                {employeeCode}
              </span>
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

        {loading && (
          <p className="text-sm text-slate-300">Loading shifts…</p>
        )}

        {/* Profile card */}
        {!loading && !error && (
          <section className="card bg-slate-900/80 border border-slate-700/80">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold text-slate-100">
                Your profile
              </h2>
              <p className="text-[11px] text-slate-400">
                Keep your contact and mailing information up to date.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Name
                </label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Phone
                </label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="e.g. 555-123-4567"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Address line 1
                </label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                  value={profileAddress1}
                  onChange={(e) => setProfileAddress1(e.target.value)}
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Address line 2
                </label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                  value={profileAddress2}
                  onChange={(e) => setProfileAddress2(e.target.value)}
                  placeholder="Apartment, suite, etc. (optional)"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  City
                </label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                  value={profileCity}
                  onChange={(e) => setProfileCity(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  State
                </label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                  value={profileState}
                  onChange={(e) => setProfileState(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Postal code
                </label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
                  value={profilePostal}
                  onChange={(e) => setProfilePostal(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px] text-slate-400">
                This information is visible to the office and used for
                pay and contact purposes.
              </div>
              <button
                type="button"
                disabled={profileSaving}
                onClick={saveProfile}
                className="rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
              >
                {profileSaving ? "Saving…" : "Save profile"}
              </button>
            </div>

            {profileMessage && (
              <p className="mt-3 text-xs text-emerald-300">
                {profileMessage}
              </p>
            )}
            {profileError && (
              <p className="mt-3 text-xs text-red-300">{profileError}</p>
            )}
          </section>
        )}

        {/* Shifts + correction form (unchanged) */}
        {!loading && !error && (
          <div className="card bg-slate-900/80 border border-slate-700/80">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold text-slate-100">
                Recent shifts
              </h2>
              <p className="text-[11px] text-slate-400">
                Showing up to 50 most recent shifts. Request changes below.
              </p>
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
                        No shifts recorded yet.
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
          </div>
        )}
      </div>
    </div>
  );
}