"use client";

import { useState } from "react";

type ApiResponse = {
  status?: string;
  message?: string;
  received?: any;
  error?: string;
};

export default function ClockPage() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [locationId, setLocationId] = useState("LAKESHOP");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResponse(null);
    setGpsStatus(null);

    if (!locationId) {
      setResponse({
        status: "error",
        error: "Please select a location.",
      });
      setLoading(false);
      return;
    }

    if (!navigator.geolocation) {
      setGpsStatus("This device does not support location.");
      setResponse({
        status: "error",
        error: "Location is required to clock in/out.",
      });
      setLoading(false);
      return;
    }

    // Get GPS position first, then send to API
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGpsStatus(`Got GPS location: lat=${lat.toFixed(5)}, lng=${lng.toFixed(5)}`);

        try {
          const res = await fetch("/api/clock", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              employeeCode,
              pin,
              locationId,
              lat,
              lng,
            }),
          });

          const data = (await res.json()) as ApiResponse;

          if (!res.ok) {
            setResponse({
              status: "error",
              error: data.error || "Something went wrong",
            });
          } else {
            setResponse(data);
          }
        } catch (err) {
          setResponse({
            status: "error",
            error: "Network error talking to /api/clock",
          });
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus("Location permission denied by user.");
          setResponse({
            status: "error",
            error: "We need location permission to clock you in/out.",
          });
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsStatus("Location unavailable.");
          setResponse({
            status: "error",
            error: "Could not determine your location.",
          });
        } else if (err.code === err.TIMEOUT) {
          setGpsStatus("Location request timed out.");
          setResponse({
            status: "error",
            error: "Location request timed out. Try again.",
          });
        } else {
          setGpsStatus("Unknown GPS error.");
          setResponse({
            status: "error",
            error: "Unknown GPS error. Try again.",
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
        <h1 className="text-2xl font-bold text-center">Clock In / Out</h1>
        <p className="text-sm text-gray-600 text-center">
          When you submit, we&apos;ll use GPS to confirm your location.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Location selection */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Location / Job Site
            </label>
            <select
              className="border rounded px-2 py-1 w-full"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              required
            >
              <option value="LAKESHOP">Lake Shop</option>
              <option value="WAREHOUSE_A">Warehouse A</option>
            </select>
          </div>

          {/* Employee Code */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Employee Code
            </label>
            <input
              className="border rounded px-2 py-1 w-full"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              placeholder="e.g. ALI001"
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
            disabled={loading}
            className="w-full py-2 rounded bg-black text-white font-semibold disabled:opacity-60"
          >
            {loading ? "Checking location..." : "Clock In / Out"}
          </button>
        </form>

        {/* GPS status */}
        {gpsStatus && (
          <div className="text-xs text-gray-700 mt-2">
            <strong>GPS:</strong> {gpsStatus}
          </div>
        )}

        {/* Response box */}
        <div className="mt-4">
          <h2 className="text-sm font-semibold mb-1">API Response</h2>
          <div className="border rounded px-2 py-2 text-xs bg-gray-50 min-h-[60px] whitespace-pre-wrap">
            {response ? (
              <>
                {response.error && (
                  <div className="text-red-600 mb-1">
                    Error: {response.error}
                  </div>
                )}
                <code>{JSON.stringify(response, null, 2)}</code>
              </>
            ) : (
              <span className="text-gray-400">
                Submit the form to see the API response here.
              </span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
