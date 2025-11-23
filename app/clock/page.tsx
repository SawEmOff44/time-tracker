"use client";

import { useState } from "react";
import Image from "next/image";

type ApiResponse = {
  status?: "clocked_in" | "clocked_out";
  message?: string;
  error?: string;
  shift?: {
    clockIn?: string | null;
    clockOut?: string | null;
    locationName?: string | null;
    isAdhoc?: boolean;
  };
};

function formatTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString();
}

export default function ClockPage() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setGpsStatus(null);
    setResponse(null);

    if (!navigator.geolocation) {
      setResponse({ error: "Location not supported on this device." });
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setGpsStatus(
          `Location acquired: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
        );

        try {
          const res = await fetch("/api/clock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employeeCode, pin, lat, lng }),
          });

          const data = (await res.json()) as ApiResponse;

          if (!res.ok) {
            setResponse({
              error: data.error || "Unknown error. Please try again.",
            });
          } else {
            setResponse(data);
          }
        } catch {
          setResponse({ error: "Network error contacting the server." });
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        let msg = "Unknown GPS error.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "We need location permission to clock you in/out.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "Could not determine your location.";
        } else if (err.code === err.TIMEOUT) {
          msg = "Location request timed out. Try again.";
        }
        setGpsStatus(msg);
        setResponse({ error: msg });
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  const isClockedIn = response?.status === "clocked_in";

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md space-y-5 rounded-lg bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center space-y-3">
          <Image
            src="/rhinehart-logo.jpeg"
            alt="Rhinehart Co. logo"
            width={220}
            height={60}
            className="h-10 w-auto object-contain"
            priority
          />
          <h1 className="text-xl font-semibold text-gray-900">
            Clock In / Out
          </h1>
          <p className="text-xs text-gray-500">
            GPS is required to track your time on site.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Employee code
            </label>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="e.g. ALI001"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              PIN
            </label>
            <input
              type="password"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !employeeCode || !pin}
            className={`w-full rounded py-2 text-sm font-semibold text-white ${
              isClockedIn
                ? "bg-red-600 hover:bg-red-700"
                : "bg-black hover:bg-gray-900"
            } disabled:opacity-60`}
          >
            {loading
              ? "Checking location…"
              : isClockedIn
              ? "Clock Out"
              : "Clock In"}
          </button>
        </form>

        {/* Status */}
        <div className="space-y-2 rounded-md bg-gray-50 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-700">Status</span>
            {isClockedIn ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                ● Clocked In
              </span>
            ) : response?.status === "clocked_out" ? (
              <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                ● Clocked Out
              </span>
            ) : (
              <span className="text-[11px] text-gray-400">
                Waiting for action…
              </span>
            )}
          </div>

          {gpsStatus && (
            <p className="text-[11px] text-gray-500">GPS: {gpsStatus}</p>
          )}

          {response?.error && (
            <p className="text-[11px] text-red-600">{response.error}</p>
          )}

          {response?.shift && (
            <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
              <div>
                <div className="font-medium text-gray-700">Clock in</div>
                <div>{formatTime(response.shift.clockIn)}</div>
              </div>
              <div>
                <div className="font-medium text-gray-700">Clock out</div>
                <div>{formatTime(response.shift.clockOut)}</div>
              </div>
              <div className="col-span-2">
                <div className="font-medium text-gray-700">Location</div>
                <div>
                  {response.shift.locationName ||
                    (response.shift.isAdhoc
                      ? "Adhoc Job Site"
                      : "—")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}