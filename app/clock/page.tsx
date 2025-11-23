"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { formatDateTimeLocal } from "@/lib/datetime";

type ApiResponse = {
  status?: "clocked_in" | "clocked_out";
  message?: string;
  shift?: {
    id: string;
    clockIn: string;
    clockOut: string | null;
    location?: {
      name: string;
    } | null;
  };
  error?: string;
  totalHoursThisPeriod?: number;
  locationName?: string | null;
};

export default function ClockPage() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  const [currentShiftStart, setCurrentShiftStart] =
    useState<Date | null>(null);
  const [lastShiftClockIn, setLastShiftClockIn] =
    useState<Date | null>(null);
  const [lastShiftClockOut, setLastShiftClockOut] =
    useState<Date | null>(null);
  const [totalHoursThisPeriod, setTotalHoursThisPeriod] =
    useState<number | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);

  // for live timer
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    if (!currentShiftStart) return;

    const id = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(id);
  }, [currentShiftStart]);

  const isSubmitDisabled =
    loading || !employeeCode || !pin;

  function formatShiftDuration(start: Date | null, end: Date): string {
    if (!start) return "—";
    const ms = end.getTime() - start.getTime();
    if (ms <= 0) return "—";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setGpsStatus(null);

    if (!navigator.geolocation) {
      setErrorMessage("This device does not support GPS.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setGpsStatus(
          `GPS lock acquired (lat ${lat.toFixed(5)}, lng ${lng.toFixed(5)})`
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
            setErrorMessage(
              data.error || "Clock-in/out failed. Please try again."
            );
            // if error, clear shift timer
            setCurrentShiftStart(null);
            return;
          }

          // Successful response
          setStatusMessage(
            data.message ||
              (data.status === "clocked_in"
                ? "You are now clocked in."
                : "You are now clocked out.")
          );

          if (typeof data.totalHoursThisPeriod === "number") {
            setTotalHoursThisPeriod(data.totalHoursThisPeriod);
          }

          if (data.locationName) {
            setLocationName(data.locationName);
          } else if (data.shift?.location?.name) {
            setLocationName(data.shift.location.name);
          } else {
            setLocationName(null);
          }

          if (data.shift?.clockIn) {
            const clockInDate = new Date(data.shift.clockIn);
            setLastShiftClockIn(clockInDate);
            if (data.shift.clockOut) {
              const clockOutDate = new Date(data.shift.clockOut);
              setLastShiftClockOut(clockOutDate);
            } else {
              setLastShiftClockOut(null);
            }
          }

          if (data.status === "clocked_in" && data.shift?.clockIn) {
            setCurrentShiftStart(new Date(data.shift.clockIn));
          } else {
            // clocked out or unknown -> stop timer
            setCurrentShiftStart(null);
          }
        } catch (err) {
          console.error(err);
          setErrorMessage(
            "Network error contacting the server. Please try again."
          );
          setCurrentShiftStart(null);
        } finally {
          setLoading(false);
        }
      },
      (geoErr) => {
        console.error("GPS error:", geoErr);

        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setGpsStatus("Location permission denied.");
          setErrorMessage(
            "We need location permission to clock you in/out."
          );
        } else if (geoErr.code === geoErr.POSITION_UNAVAILABLE) {
          setGpsStatus("Location unavailable.");
          setErrorMessage("Could not determine your location.");
        } else if (geoErr.code === geoErr.TIMEOUT) {
          setGpsStatus("Location request timed out.");
          setErrorMessage("Location request timed out. Try again.");
        } else {
          setGpsStatus("Unknown GPS error.");
          setErrorMessage("Unknown GPS error occurred.");
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

  const runningShiftTime = currentShiftStart
    ? formatShiftDuration(currentShiftStart, now)
    : null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6 space-y-5">
        {/* Logo */}
        <div className="w-full flex justify-center mb-1">
          <Image
            src="/rhinehart-logo.jpeg"
            alt="Rhinehart Co. Logo"
            width={220}
            height={80}
            className="object-contain"
            priority
          />
        </div>

        <h1 className="text-2xl font-bold text-center">
          Clock In / Out
        </h1>
        <p className="text-sm text-gray-600 text-center">
          GPS is required for clocking in/out.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Code */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Employee Code
            </label>
            <input
              className="border rounded px-2 py-2 w-full text-sm"
              placeholder="e.g. ALI001"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              required
            />
          </div>

          {/* PIN */}
          <div>
            <label className="block text-sm font-medium mb-1">
              PIN
            </label>
            <input
              type="password"
              className="border rounded px-2 py-2 w-full text-sm"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full py-2 rounded bg-black text-white font-semibold disabled:opacity-60"
          >
            {loading ? "Checking location..." : "Clock In / Out"}
          </button>
        </form>

        {/* GPS Status */}
        {gpsStatus && (
          <div className="text-xs text-gray-700">
            <strong>GPS:</strong> {gpsStatus}
          </div>
        )}

        {/* Status + errors */}
        {statusMessage && (
          <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
            {statusMessage}
            {locationName && (
              <span className="block text-xs text-green-700 mt-1">
                Location: {locationName}
              </span>
            )}
          </div>
        )}

        {errorMessage && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Shift + hours summary */}
        <div className="border rounded-md px-3 py-3 bg-gray-50 text-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">Current status</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                currentShiftStart
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {currentShiftStart ? "Clocked in" : "Clocked out"}
            </span>
          </div>

          {currentShiftStart && (
            <>
              <div className="flex justify-between text-xs text-gray-700">
                <span>Shift started</span>
                <span>{formatDateTimeLocal(currentShiftStart)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-700">
                <span>Time on this shift</span>
                <span className="font-mono">
                  {runningShiftTime ?? "—"}
                </span>
              </div>
            </>
          )}

          <div className="flex justify-between text-xs text-gray-700 pt-1 border-t border-gray-200 mt-2">
            <span>Hours this week</span>
            <span className="font-semibold">
              {totalHoursThisPeriod != null
                ? `${totalHoursThisPeriod.toFixed(2)} h`
                : "—"}
            </span>
          </div>

          {lastShiftClockIn && (
            <div className="mt-2 text-[11px] text-gray-500">
              <div>
                Last clock in:{" "}
                {formatDateTimeLocal(lastShiftClockIn)}
              </div>
              {lastShiftClockOut && (
                <div>
                  Last clock out:{" "}
                  {formatDateTimeLocal(lastShiftClockOut)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}