"use client";

import { useEffect, useState } from "react";

type ApiResponse = {
  status?: "clocked_in" | "clocked_out";
  message?: string;
  shift?: {
    clockIn?: string | null;
    clockOut?: string | null;
  } | null;
  locationName?: string | null;
  totalHoursThisPeriod?: number;
  error?: string;
};

function formatTime(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatElapsed(seconds: number) {
  if (seconds <= 0) return "00:00:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

export default function ClockPage() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [status, setStatus] = useState<"idle" | "clocked_in" | "clocked_out">(
    "idle"
  );
  const [locationName, setLocationName] = useState<string | null>(null);
  const [totalHoursThisPeriod, setTotalHoursThisPeriod] = useState<number | null>(
    null
  );

  const [lastClockIn, setLastClockIn] = useState<Date | null>(null);
  const [lastClockOut, setLastClockOut] = useState<Date | null>(null);

  const [activeShiftStart, setActiveShiftStart] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer for active shift
  useEffect(() => {
    if (!activeShiftStart) {
      setElapsedSeconds(0);
      return;
    }

    const tick = () => {
      const now = new Date();
      const diff = Math.floor(
        (now.getTime() - activeShiftStart.getTime()) / 1000
      );
      setElapsedSeconds(diff > 0 ? diff : 0);
    };

    tick(); // initialize immediately
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeShiftStart]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setGpsStatus(null);

    if (!navigator.geolocation) {
      setError("This device does not support GPS location.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setGpsStatus(
          `Got GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
        );

        try {
          const res = await fetch("/api/clock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              employeeCode,
              pin,
              lat,
              lng,
            }),
          });

          const data = (await res.json()) as ApiResponse;

          if (!res.ok) {
            setError(data.error || "Unknown error clocking in/out.");
            setStatus("idle");
            setActiveShiftStart(null);
            return;
          }

          // Success
          if (data.status === "clocked_in" || data.status === "clocked_out") {
            setStatus(data.status);
          } else {
            setStatus("idle");
          }

          setSuccessMessage(data.message || null);
          setLocationName(data.locationName ?? null);

          if (typeof data.totalHoursThisPeriod === "number") {
            setTotalHoursThisPeriod(data.totalHoursThisPeriod);
          }

          // Handle shift times
          const clockInIso = data.shift?.clockIn ?? null;
          const clockOutIso = data.shift?.clockOut ?? null;

          const clockInDate = clockInIso ? new Date(clockInIso) : null;
          const clockOutDate = clockOutIso ? new Date(clockOutIso) : null;

          setLastClockIn(clockInDate);
          setLastClockOut(clockOutDate);

          if (data.status === "clocked_in" && clockInDate) {
            setActiveShiftStart(clockInDate);
          } else {
            setActiveShiftStart(null);
          }
        } catch {
          setError("Network error contacting the server.");
        } finally {
          setLoading(false);
        }
      },
      (geoErr) => {
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setGpsStatus("Location permission denied.");
          setError("We need GPS permission to clock you in/out.");
        } else if (geoErr.code === geoErr.POSITION_UNAVAILABLE) {
          setGpsStatus("Location unavailable.");
          setError("Could not determine your location.");
        } else if (geoErr.code === geoErr.TIMEOUT) {
          setGpsStatus("Location request timed out.");
          setError("Location request timed out. Try again.");
        } else {
          setGpsStatus("Unknown GPS error.");
          setError("Unknown GPS error occurred.");
        }
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  const isSubmitDisabled = loading || !employeeCode || !pin;

  const isClockedIn = status === "clocked_in";

  return (
    <main className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-md border border-gray-200 p-6 space-y-5">
        {/* Title */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold text-gray-900">
            Clock In / Out
          </h1>
          <p className="text-xs text-gray-500">
            GPS is required. Make sure location services are enabled.
          </p>
        </div>

        {/* Status banner */}
        {(isClockedIn || status === "clocked_out") && (
          <div
            className={`rounded-xl px-3 py-3 text-xs ${
              isClockedIn
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-slate-50 border border-slate-200 text-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                {isClockedIn ? "Currently Clocked In" : "Clocked Out"}
              </span>
              <span
                className={`inline-flex h-2 w-2 rounded-full ${
                  isClockedIn ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
            </div>
            {successMessage && (
              <p className="mt-1 text-sm font-medium">{successMessage}</p>
            )}
            {locationName && (
              <p className="mt-0.5 text-[11px] text-gray-600">
                Location: <span className="font-medium">{locationName}</span>
              </p>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
              <div>
                <div className="font-semibold text-gray-700">Last Clock In</div>
                <div>{formatDate(lastClockIn)}</div>
                <div>{formatTime(lastClockIn)}</div>
              </div>
              <div>
                <div className="font-semibold text-gray-700">Last Clock Out</div>
                <div>{formatDate(lastClockOut)}</div>
                <div>{formatTime(lastClockOut)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 text-center text-xs">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Hours this week
            </div>
            <div className="mt-1 text-lg font-semibold text-gray-900">
              {totalHoursThisPeriod != null
                ? totalHoursThisPeriod.toFixed(2)
                : "—"}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Current shift
            </div>
            <div className="mt-1 text-lg font-mono font-semibold text-gray-900">
              {isClockedIn ? formatElapsed(elapsedSeconds) : "00:00:00"}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Code */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Employee Code
            </label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
              placeholder="e.g. ALI001"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
              autoComplete="off"
            />
          </div>

          {/* PIN */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              PIN
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition ${
              isSubmitDisabled
                ? "bg-gray-400 cursor-not-allowed"
                : isClockedIn
                ? "bg-red-600 hover:bg-red-700"
                : "bg-black hover:bg-gray-900"
            }`}
          >
            {loading
              ? "Checking location..."
              : isClockedIn
              ? "Clock Out"
              : "Clock In"}
          </button>
        </form>

        {/* GPS + Error */}
        <div className="space-y-1 text-xs">
          {gpsStatus && (
            <div className="text-gray-500">
              <span className="font-medium">GPS:</span> {gpsStatus}
            </div>
          )}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}