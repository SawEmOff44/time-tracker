// app/clock/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ClockResponse = {
  status: "clocked_in" | "clocked_out";
  message: string;
  locationName: string | null;
  totalHoursThisPeriod: number | null;
};

type CorrectionType =
  | "MISSING_IN"
  | "MISSING_OUT"
  | "ADJUST_IN"
  | "ADJUST_OUT"
  | "NEW_SHIFT";

type CorrectionApiResponse =
  | { ok: true; message: string }
  | { error: string };

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");

  return `${hh}:${mm}:${ss}`;
}

export default function ClockPage() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [hoursThisWeek, setHoursThisWeek] = useState<number | null>(null);

  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentShiftSeconds, setCurrentShiftSeconds] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusVariant, setStatusVariant] = useState<
    "neutral" | "success" | "error"
  >("neutral");

  // Correction modal state
  const [showFixModal, setShowFixModal] = useState(false);
  const [fixType, setFixType] = useState<CorrectionType>("MISSING_OUT");
  const [fixDate, setFixDate] = useState<string>("");
  const [fixStart, setFixStart] = useState<string>("");
  const [fixEnd, setFixEnd] = useState<string>("");
  const [fixReason, setFixReason] = useState<string>("");
  const [fixSubmitting, setFixSubmitting] = useState(false);
  const [fixStatus, setFixStatus] = useState<string | null>(null);
  const [fixError, setFixError] = useState<string | null>(null);

  // Grab GPS once when the page loads
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationError("This device does not support GPS.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocationError(null);
      },
      (err) => {
        console.error("Geolocation error", err);
        setLocationError("Unable to read GPS location. Check permissions.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Simple timer while clocked in
  useEffect(() => {
    let id: number | undefined;

    if (isClockedIn) {
      id = window.setInterval(() => {
        setCurrentShiftSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setCurrentShiftSeconds(0);
    }

    return () => {
      if (id) window.clearInterval(id);
    };
  }, [isClockedIn]);

  async function handleClock() {
    if (!employeeCode || !pin) return;

    setSubmitting(true);
    setStatusMessage(null);
    setStatusVariant("neutral");

    try {
      const res = await fetch("/api/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeCode: employeeCode.trim(),
          pin: pin.trim(),
          lat,
          lng,
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        const msg = errBody?.error ?? "Clock action failed.";
        setStatusVariant("error");
        setStatusMessage(msg);
        return;
      }

      const data = (await res.json()) as ClockResponse;

      if (typeof data.totalHoursThisPeriod === "number") {
        setHoursThisWeek(data.totalHoursThisPeriod);
      }

      if (data.status === "clocked_in") {
        setIsClockedIn(true);
        setStatusVariant("success");
        const locName = data.locationName ?? "ADHOC job site";
        setStatusMessage(`Clocked in at ${locName}. Clock-in recorded.`);
      } else {
        setIsClockedIn(false);
        setStatusVariant("neutral");
        setStatusMessage(data.message || "Clock-out recorded.");
      }
    } catch (err) {
      console.error(err);
      setStatusVariant("error");
      setStatusMessage("Unexpected error while clocking in/out.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!employeeCode && !!pin && !submitting;

  const statusPillClasses = isClockedIn
    ? "bg-emerald-500/15 text-emerald-200 border border-emerald-500/40"
    : "bg-slate-500/10 text-slate-200 border border-slate-500/40";

  const buttonClasses =
    "w-full py-3 rounded-xl font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent " +
    (isClockedIn
      ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 focus:ring-emerald-400"
      : "bg-slate-900 text-slate-50 hover:bg-slate-800 focus:ring-slate-300");

  const statusTextColor =
    statusVariant === "error"
      ? "text-red-400"
      : statusVariant === "success"
      ? "text-emerald-300"
      : "text-slate-200";

  // --- Correction handling -------------------------------------------------

  function resetFixForm() {
    setFixType("MISSING_OUT");
    setFixDate("");
    setFixStart("");
    setFixEnd("");
    setFixReason("");
    setFixStatus(null);
    setFixError(null);
  }

  function openFixModal() {
    if (!employeeCode || !pin) {
      setStatusVariant("error");
      setStatusMessage(
        "Enter your employee code and PIN before requesting a fix."
      );
      return;
    }
    resetFixForm();
    // Default date to today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setFixDate(`${yyyy}-${mm}-${dd}`);
    setShowFixModal(true);
  }

  async function submitFixRequest() {
    if (!employeeCode || !pin) {
      setFixError("Enter your employee code and PIN first.");
      return;
    }
    if (!fixDate) {
      setFixError("Pick a date for the correction.");
      return;
    }

    // Determine which times are needed
    const needsStart =
      fixType === "MISSING_IN" || fixType === "ADJUST_IN" || fixType === "NEW_SHIFT";
    const needsEnd =
      fixType === "MISSING_OUT" || fixType === "ADJUST_OUT" || fixType === "NEW_SHIFT";

    if (needsStart && !fixStart) {
      setFixError("Provide a start time (HH:MM).");
      return;
    }

    if (needsEnd && !fixEnd) {
      setFixError("Provide an end time (HH:MM).");
      return;
    }

    setFixSubmitting(true);
    setFixStatus(null);
    setFixError(null);

    try {
      const res = await fetch("/api/clock/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeCode: employeeCode.trim(),
          pin: pin.trim(),
          type: fixType,
          date: fixDate,
          clockIn: needsStart ? fixStart : undefined,
          clockOut: needsEnd ? fixEnd : undefined,
          reason: fixReason || undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | CorrectionApiResponse
        | null;

      if (!res.ok || !data || "error" in data) {
        const msg =
          (data && "error" in data && data.error) ||
          "Failed to submit correction request.";
        setFixError(msg);
        return;
      }

      setFixStatus(data.message);
      // Also surface to main status bar as a “awaiting approval” vibe
      setStatusVariant("neutral");
      setStatusMessage("Correction submitted for approval. Awaiting review.");
    } catch (err) {
      console.error(err);
      setFixError("Unexpected error submitting correction.");
    } finally {
      setFixSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center clock-stone-bg">
      {/* Outer shell with soft glow */}
      <div className="w-full max-w-xl rounded-3xl bg-slate-950/75 shadow-[0_40px_120px_rgba(15,23,42,0.95)] border border-slate-700/70 backdrop-blur-xl px-8 py-8 sm:px-10 sm:py-10">
        {/* Header row */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-slate-50">
              Clock In / Out
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              GPS is required. Make sure location services are enabled.
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${statusPillClasses}`}
          >
            {isClockedIn ? "Status: Clocked in" : "Status: Clocked out"}
          </span>
        </div>

        {/* Hours row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-700/80">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
              Hours this week
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">
              {typeof hoursThisWeek === "number"
                ? `${hoursThisWeek.toFixed(2)}h`
                : "—"}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-700/80">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
              Current shift
            </p>
            <p className="mt-2 text-2xl font-mono font-semibold text-slate-50">
              {formatDuration(currentShiftSeconds)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Timer runs while you&apos;re clocked in.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              Employee Code
            </label>
            <input
              type="text"
              placeholder="e.g. ALI001"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              className="mt-1 w-full"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              PIN
            </label>
            <input
              type="password"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="mt-1 w-full"
            />
          </div>

          {locationError && (
            <p className="text-xs text-amber-300/90">
              {locationError} We&apos;ll still record your time, but GPS
              validation may fail.
            </p>
          )}

          <button
            type="button"
            className={buttonClasses}
            disabled={!canSubmit}
            onClick={handleClock}
          >
            {submitting
              ? "Saving..."
              : isClockedIn
              ? "Clock Out"
              : "Clock In"}
          </button>

          {/* Secondary row: create account + request fix */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-300">
            <p className="text-center sm:text-left">
              New worker?{" "}
              <Link
                href="/clock/create-account"
                className="text-amber-300 hover:text-amber-200 underline underline-offset-4"
              >
                Create your account
              </Link>
            </p>
            <button
              type="button"
              onClick={openFixModal}
              className="text-xs text-sky-300 hover:text-sky-200 underline underline-offset-4 mx-auto sm:mx-0"
            >
              Missing or incorrect time? Request a fix
            </button>
          </div>
        </div>

        {/* Status message */}
        {statusMessage && (
          <p className={`mt-4 text-xs sm:text-sm ${statusTextColor}`}>
            {statusMessage}
          </p>
        )}
      </div>

      {/* Correction modal */}
      {showFixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-950 border border-slate-700 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-50">
                Request a time correction
              </h2>
              <button
                type="button"
                onClick={() => setShowFixModal(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mb-4">
              Your supervisor will review this request. Only shifts in the
              current pay week can be corrected.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Correction type
                </label>
                <select
                  value={fixType}
                  onChange={(e) => setFixType(e.target.value as CorrectionType)}
                  className="mt-1 w-full"
                >
                  <option value="MISSING_OUT">Forgot to clock out</option>
                  <option value="MISSING_IN">Forgot to clock in</option>
                  <option value="ADJUST_IN">Start time is wrong</option>
                  <option value="ADJUST_OUT">End time is wrong</option>
                  <option value="NEW_SHIFT">Need a new shift added</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Date of shift
                </label>
                <input
                  type="date"
                  value={fixDate}
                  onChange={(e) => setFixDate(e.target.value)}
                  className="mt-1 w-full"
                />
              </div>

              {(fixType === "MISSING_IN" ||
                fixType === "ADJUST_IN" ||
                fixType === "NEW_SHIFT") && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                    Correct start time
                  </label>
                  <input
                    type="time"
                    value={fixStart}
                    onChange={(e) => setFixStart(e.target.value)}
                    className="mt-1 w-full"
                  />
                </div>
              )}

              {(fixType === "MISSING_OUT" ||
                fixType === "ADJUST_OUT" ||
                fixType === "NEW_SHIFT") && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                    Correct end time
                  </label>
                  <input
                    type="time"
                    value={fixEnd}
                    onChange={(e) => setFixEnd(e.target.value)}
                    className="mt-1 w-full"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Reason (optional)
                </label>
                <textarea
                  rows={3}
                  value={fixReason}
                  onChange={(e) => setFixReason(e.target.value)}
                  placeholder="Ex: Forgot to clock out when leaving job site."
                  className="mt-1 w-full"
                />
              </div>

              {fixError && (
                <p className="text-[11px] text-red-400">{fixError}</p>
              )}
              {fixStatus && (
                <p className="text-[11px] text-emerald-300">{fixStatus}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFixModal(false)}
                  className="text-xs px-3 py-1 rounded-full border border-slate-700 text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitFixRequest}
                  disabled={fixSubmitting}
                  className="text-xs px-3 py-1 rounded-full bg-sky-500 text-slate-950 font-semibold hover:bg-sky-400 disabled:opacity-60"
                >
                  {fixSubmitting ? "Submitting..." : "Submit for approval"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}