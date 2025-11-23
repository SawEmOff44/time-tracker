"use client";

import { useState } from "react";
import Image from "next/image";

type ApiResponse = {
  status?: string;
  message?: string;
  shift?: any; // keep loose to avoid TS whining
  error?: string;
};

export default function ClockPage() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResponse(null);
    setGpsStatus(null);

    if (!navigator.geolocation) {
      setResponse({
        status: "error",
        error: "Location not supported on this device.",
      });
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
            setResponse({
              status: "error",
              error: data.error || "Unknown error",
            });
          } else {
            setResponse(data);
          }
        } catch (error) {
          setResponse({
            status: "error",
            error: "Network error contacting the server.",
          });
        } finally {
          setLoading(false);
        }
      },
      (geoErr) => {
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setGpsStatus("Location permission denied.");
          setResponse({
            status: "error",
            error: "We need location permission to clock you in/out.",
          });
        } else if (geoErr.code === geoErr.POSITION_UNAVAILABLE) {
          setGpsStatus("Location unavailable.");
          setResponse({
            status: "error",
            error: "Could not determine your location.",
          });
        } else if (geoErr.code === geoErr.TIMEOUT) {
          setGpsStatus("Location request timed out.");
          setResponse({
            status: "error",
            error: "Location request timed out. Try again.",
          });
        } else {
          setGpsStatus("Unknown GPS error.");
          setResponse({
            status: "error",
            error: "Unknown GPS error occurred.",
          });
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

  // --- Display helpers based on last response ---
  const lastShift = response?.shift;
  const isSuccess = response?.status === "success" && !response?.error;

  let locationLabel = "";
  let clockInLabel = "";
  let clockOutLabel = "";
  let currentStatusLabel = "";

  if (lastShift) {
    if (lastShift.location && lastShift.location.name) {
      locationLabel = lastShift.location.name as string;
    } else {
      // ADHOC or unknown location
      locationLabel = "ADHOC location";
    }

    if (lastShift.clockIn) {
      clockInLabel = new Date(lastShift.clockIn).toLocaleString();
    }
    if (lastShift.clockOut) {
      clockOutLabel = new Date(lastShift.clockOut).toLocaleString();
    }

    if (lastShift.clockOut) {
      currentStatusLabel = "You are clocked out.";
    } else {
      currentStatusLabel = "You are currently CLOCKED IN.";
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-xl p-6 space-y-4">
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

        {/* Status banner */}
        {response && (
          <div
            className={`border rounded-md px-3 py-2 text-sm ${
              isSuccess
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {response.error
              ? response.error
              : response.message || "Status updated."}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Employee Code */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Employee Code
            </label>
            <input
              className="border rounded px-3 py-2 w-full text-sm"
              placeholder="e.g. ALI001"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              required
            />
          </div>

          {/* PIN */}
          <div>
            <label className="block text-sm font-medium mb-1">PIN</label>
            <input
              type="password"
              className="border rounded px-3 py-2 w-full text-sm"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full py-2.5 rounded-md bg-black text-white font-semibold text-sm disabled:opacity-60"
          >
            {loading ? "Checking location..." : "Clock In / Out"}
          </button>
        </form>

        {/* GPS Status */}
        {gpsStatus && (
          <div className="text-xs text-gray-700 mt-2">
            <strong>GPS:</strong> {gpsStatus}
          </div>
        )}

        {/* Current shift summary */}
        {lastShift && (
          <div className="mt-4 border rounded-md px-3 py-3 bg-gray-50 text-xs space-y-1">
            <div className="font-semibold text-sm">
              {currentStatusLabel || "Last clock activity"}
            </div>
            <div>
              <span className="font-medium">Location:</span>{" "}
              {locationLabel || "Unknown"}
            </div>
            <div>
              <span className="font-medium">Clock In:</span>{" "}
              {clockInLabel || "—"}
            </div>
            <div>
              <span className="font-medium">Clock Out:</span>{" "}
              {clockOutLabel || "— (still clocked in)"}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}