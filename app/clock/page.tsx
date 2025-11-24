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

  // Simple client-side timer that runs while isClockedIn is true
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

      // Update weekly hours
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
        </div>

        {/* Self-service registration link */}
        <p className="mt-4 text-xs text-slate-300 text-center">
          New worker?{" "}
          <Link
            href="/clock/create-account"
            className="text-amber-300 hover:text-amber-200 underline underline-offset-4"
          >
            Create your account
          </Link>
        </p>

        {/* Status message */}
        {statusMessage && (
          <p
            className={`mt-4 text-xs sm:text-sm text-center ${statusTextColor}`}
          >
            {statusMessage}
          </p>
        )}
      </div>
    </div>
  );
}