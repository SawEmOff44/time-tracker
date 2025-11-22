"use client";

import { useState } from "react";
import Image from "next/image";

type ApiResponse = {
  status?: string; // "clocked_in" | "clocked_out" | etc.
  message?: string;
  shift?: {
    id: string;
    clockIn: string;
    clockOut: string | null;
    location?: {
      id: string;
      name: string;
      code: string;
    } | null;
  };
  error?: string;
};

export default function ClockPage() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [currentStatus, setCurrentStatus] = useState<
    "idle" | "clocked_in" | "clocked_out"
  >("idle");
  const [currentLocationName, setCurrentLocationName] = useState<string | null>(
    null
  );
  const [currentClockIn, setCurrentClockIn] = useState<string | null>(null);
  const [currentClockOut, setCurrentClockOut] = useState<string | null>(null);

  function formatDateTime(dt: string | null): string {
    if (!dt) return "";
    const d = new Date(dt);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setGpsStatus(null);
    setErrorMessage(null);

    if (!navigator.geolocation) {
      setErrorMessage("Location not supported on this device.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setGpsStatus(
          `Got GPS location: lat=${lat.toFixed(5)}, lng=${lng.toFixed(5)}`
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
            setErrorMessage(data.error || "Unknown error");
            setCurrentStatus("idle");
            setCurrentClockIn(null);
            setCurrentClockOut(null);
            setCurrentLocationName(null);
            return;
          }

          // Successful clock in/out
          const status = data.status === "clocked_in"
            ? "clocked_in"
            : data.status === "clocked_out"
            ? "clocked_out"
            : "idle";

          setCurrentStatus(status);

          if (data.shift) {
            setCurrentClockIn(
              data.shift.clockIn ? data.shift.clockIn : null
            );
            setCurrentClockOut(
              data.shift.clockOut ? data.shift.clockOut : null
            );
            setCurrentLocationName(data.shift.location?.name ?? null);
          } else {
            setCurrentClockIn(null);
            setCurrentClockOut(null);
            setCurrentLocationName(null);
          }
        } catch (err) {
          console.error("Clock API error:", err);
          setErrorMessage("Network error contacting the server.");
          setCurrentStatus("idle");
          setCurrentClockIn(null);
          setCurrentClockOut(null);
          setCurrentLocationName(null);
        } finally {
          setLoading(false);
        }
      },
      (geoErr) => {
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setGpsStatus("Location permission denied.");
          setErrorMessage("We need location permission to clock you in/out.");
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

  const isClockedIn = currentStatus === "clocked_in";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6 space-y-4">
        {/* Logo */}
        <div className="w-full flex justify-center mb-2">
          <Image
            src="/rhinehart-logo.jpeg"
            alt="Rhinehart Co. Logo"
            width={220}
            height={80}
            className="object-contain"
            priority
          />
        </div>

        <h1 className="text-2xl font-bold text-center">Clock In / Out</h1>
        <p className="text-sm text-gray-600 text-center">
          GPS is required for clocking in/out.
        </p>

        {/* Current status panel */}
        <div
          className={
            "rounded-md border px-3 py-2 text-sm " +
            (isClockedIn
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-gray-200 bg-gray-50 text-gray-800")
          }
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold">
              Status:{" "}
              {currentStatus === "clocked_in"
                ? "Clocked In"
                : currentStatus === "clocked_out"
                ? "Clocked Out"
                : "Not clocked in"}
            </span>
            {isClockedIn && (
              <span className="inline-block px-2 py-0.5 rounded-full bg-green-600 text-white text-[11px] font-semibold">
                ACTIVE
              </span>
            )}
          </div>

          {currentLocationName && (
            <div className="text-xs text-gray-700">
              Location: <span className="font-medium">{currentLocationName}</span>
            </div>
          )}

          {currentClockIn && (
            <div className="text-xs text-gray-700 mt-1">
              Clock in:{" "}
              <span className="font-mono">
                {formatDateTime(currentClockIn)}
              </span>
            </div>
          )}

          {currentClockOut && (
            <div className="text-xs text-gray-700">
              Clock out:{" "}
              <span className="font-mono">
                {formatDateTime(currentClockOut)}
              </span>
            </div>
          )}

          {!currentClockIn && currentStatus === "idle" && (
            <div className="text-xs text-gray-500 mt-1">
              Once you clock in, you&apos;ll see your times here.
            </div>
          )}
        </div>

        {/* Error + GPS messages */}
        {errorMessage && (
          <div className="border border-red-300 bg-red-50 text-red-800 px-3 py-2 rounded text-xs">
            {errorMessage}
          </div>
        )}

        {gpsStatus && (
          <div className="text-xs text-gray-700">
            <strong>GPS:</strong> {gpsStatus}
          </div>
        )}

        {/* Clock form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Employee Code
            </label>
            <input
              className="border rounded px-2 py-1 w-full text-sm"
              placeholder="e.g. ALI001"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">PIN</label>
            <input
              type="password"
              className="border rounded px-2 py-1 w-full text-sm"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-black text-white font-semibold text-sm disabled:opacity-60"
          >
            {loading ? "Checking location..." : "Clock In / Out"}
          </button>
        </form>
      </div>
    </main>
  );
}