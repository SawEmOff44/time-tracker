"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Image from "next/image";

type ApiResponse = {
  status?: "clocked_in" | "clocked_out" | string;
  message?: string;
  shift?: any;
  error?: string;
  [key: string]: any; // allow extra fields from API
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
        status: "clocked_out",
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
              status: data.status ?? "clocked_out",
              error: data.error || "Unknown error",
              ...data,
            });
          } else {
            setResponse(data);
          }
        } catch (err) {
          console.error(err);
          setResponse({
            status: "clocked_out",
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
            status: "clocked_out",
            error: "We need location permission to clock you in/out.",
          });
        } else if (geoErr.code === geoErr.POSITION_UNAVAILABLE) {
          setGpsStatus("Location unavailable.");
          setResponse({
            status: "clocked_out",
            error: "Could not determine your location.",
          });
        } else if (geoErr.code === geoErr.TIMEOUT) {
          setGpsStatus("Location request timed out.");
          setResponse({
            status: "clocked_out",
            error: "Location request timed out. Try again.",
          });
        } else {
          setGpsStatus("Unknown GPS error.");
          setResponse({
            status: "clocked_out",
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

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6 space-y-4">
        {/* Logo centered */}
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
          GPS is required. Your job site is auto-detected from your location.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
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
            disabled={loading}
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

        {/* Simple summary */}
        {response && (
          <div className="mt-3 text-sm">
            {response.error ? (
              <div className="text-red-600 font-medium">
                Error: {response.error}
              </div>
            ) : (
              <>
                {response.status && (
                  <div className="font-semibold">
                    Status:{" "}
                    {response.status === "clocked_in"
                      ? "Clocked IN"
                      : response.status === "clocked_out"
                      ? "Clocked OUT"
                      : response.status}
                  </div>
                )}
                {response.shift && (
                  <div className="mt-1 text-xs text-gray-700">
                    <div>
                      Clock In:{" "}
                      {response.shift.clockIn
                        ? new Date(response.shift.clockIn).toLocaleString()
                        : "—"}
                    </div>
                    <div>
                      Clock Out:{" "}
                      {response.shift.clockOut
                        ? new Date(response.shift.clockOut).toLocaleString()
                        : "—"}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Raw API Response for debugging */}
        <div className="mt-4">
          <h2 className="text-sm font-semibold mb-1">API Response</h2>
          <div className="border rounded px-2 py-2 text-xs bg-gray-50 min-h-[60px] whitespace-pre-wrap">
            {response ? (
              <code>{JSON.stringify(response, null, 2)}</code>
            ) : (
              <span className="text-gray-400">
                Submit the form to see the response.
              </span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}