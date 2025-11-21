"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type ApiResponse = {
  status?: string;
  message?: string;
  shift?: any;
  error?: string;
};

type Location = {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  radiusMeters: number;
};

export default function ClockPage() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  // Load locations
  useEffect(() => {
    let cancelled = false;

    async function loadLocations() {
      setLocLoading(true);
      setLocError(null);
      try {
        const res = await fetch("/api/locations");
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Failed to load locations");

        if (!cancelled) {
          setLocations(data);
          if (data.length > 0 && !locationId) setLocationId(data[0].id);
        }
      } catch (err: any) {
        if (!cancelled) setLocError(err.message);
      } finally {
        if (!cancelled) setLocLoading(false);
      }
    }

    loadLocations();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResponse(null);
    setGpsStatus(null);

    if (!navigator.geolocation) {
      setResponse({ status: "error", error: "Location not supported." });
      setLoading(false);
      return;
    }

    if (!locationId) {
      setResponse({ status: "error", error: "Select a location first." });
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setGpsStatus(`GPS OK: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);

        try {
          const res = await fetch("/api/clock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employeeCode, pin, locationId, lat, lng }),
          });

          const data = await res.json();

          if (!res.ok) {
            setResponse({ status: "error", error: data.error });
          } else {
            setResponse(data);
          }
        } catch {
          setResponse({
            status: "error",
            error: "Network error contacting the server.",
          });
        } finally {
          setLoading(false);
        }
      },

      (geoErr) => {
        const errMap: Record<number, string> = {
          1: "Location permission denied.",
          2: "Position unavailable.",
          3: "Location request timed out.",
        };

        setGpsStatus(errMap[geoErr.code] || "Unknown GPS error");
        setResponse({ status: "error", error: errMap[geoErr.code] });
        setLoading(false);
      },

      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6 space-y-4 text-center">

        {/* LOGO - centered */}
        <div className="w-full flex justify-center mb-4">
          <Image
            src="/rhinehart-logo.jpeg"
            alt="Rhinehart Co. Logo"
            width={220}
            height={80}
            className="object-contain"
            priority
          />
        </div>

        <h1 className="text-2xl font-bold">Clock In / Out</h1>
        <p className="text-sm text-gray-600">
          GPS is required for clocking in/out.
        </p>

        {/* Error if locations fail */}
        {locError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {locError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">

          {/* Location picker */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Location / Job Site
            </label>
            <select
              className="border rounded px-2 py-1 w-full"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              disabled={locLoading || locations.length === 0}
            >
              {locLoading && <option>Loading...</option>}
              {!locLoading && locations.length === 0 && (
                <option>No locations available</option>
              )}
              {!locLoading &&
                locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
            </select>
          </div>

          {/* Employee code */}
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

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || locLoading || locations.length === 0}
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

        {/* API Response */}
        <div className="mt-4 text-left">
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
                Submit the form to see the response.
              </span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}