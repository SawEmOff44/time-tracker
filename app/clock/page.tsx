"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";

type ApiResponse = {
  status?: string; // e.g. "clocked-in" | "clocked-out" | "error"
  message?: string;
  shift?: {
    id: string;
    clockIn: string | null;
    clockOut: string | null;
    isAdhoc?: boolean;
    location?: {
      id: string;
      name: string;
      code: string;
    } | null;
  } | null;
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
    setGpsStatus(null);
    setResponse(null);

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
        } catch (err) {
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

  const shift = response?.shift ?? null;
  const clockInTime =
    shift?.clockIn ? new Date(shift.clockIn).toLocaleString() : null;
  const clockOutTime =
    shift?.clockOut ? new Date(shift.clockOut).toLocaleString() : null;

  const locationName = shift?.location
    ? shift.location.name
    : shift?.isAdhoc
    ? "ADHOC Location"
    : undefined;

  const isClockedIn =
    response?.status === "clocked-in" ||
    (!!shift && !shift.clockOut && !!shift.clockIn);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center">Clock In / Out</h1>
        <p className="text-sm text-gray-600 text-center">
          GPS is required for clocking in/out.
        </p>

        {/* Status banner */}
        {response && (
          <div
            className={
              response.error || response.status === "error"
                ? "rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
                : isClockedIn
                ? "rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700"
                : "rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700"
            }
          >
            {response.error
              ? response.error
              : response.message || (isClockedIn ? "You are clocked in." : "You are clocked out.")}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Code */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Employee Code
            </label>
            <input
              className="border rounded px-2 py-1 w-full"
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
              className="border rounded px-2 py-1 w-full"
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
          <div className="text-xs text-gray-700 mt-2">
            <strong>GPS:</strong> {gpsStatus}
          </div>
        )}

        {/* Last shift info */}
        {shift && (
          <div className="mt-4 text-xs text-gray-700 space-y-1 border-t pt-3">
            <div>
              <strong>Status:</strong>{" "}
              {isClockedIn ? "Clocked In" : "Clocked Out"}
            </div>
            {locationName && (
              <div>
                <strong>Location:</strong> {locationName}
              </div>
            )}
            {clockInTime && (
              <div>
                <strong>Last Clock In:</strong> {clockInTime}
              </div>
            )}
            {clockOutTime && (
              <div>
                <strong>Last Clock Out:</strong> {clockOutTime}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}