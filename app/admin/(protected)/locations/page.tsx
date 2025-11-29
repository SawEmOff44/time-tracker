"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { adminFetch, AdminAuthError } from "../../_utils/adminFetch";

// IMPORTANT: dynamic import to avoid SSR breakage
const LocationMap = dynamic(() => import("./LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="text-sm text-slate-400">Loading map…</div>
  ),
});

type Location = {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  radiusMeters: number | null;
  active: boolean;
  geofenceRadiusMeters?: number;
  clockInGraceSeconds?: number;
  policy?: "STRICT" | "WARN";
};

type GeocodeResponse =
  | { lat: number; lng: number }
  | { error: string };

const DEFAULT_CENTER: [number, number] = [32.778, -96.795]; // Dallas-ish fallback

export default function LocationsAdminPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radiusMeters, setRadiusMeters] = useState<number | null>(null);
  const [active, setActive] = useState(true);

  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState<number>(60);
  const [clockInGraceSeconds, setClockInGraceSeconds] = useState<number>(120);
  const [policy, setPolicy] = useState<"STRICT" | "WARN">("STRICT");

  const [addressQuery, setAddressQuery] = useState("");
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  // Load locations on mount
  useEffect(() => {
    async function loadLocations() {
      try {
        setLoading(true);
        setError(null);

        const res = await adminFetch("/api/admin/locations");
        const data = (await res.json()) as Location[];
        setLocations(data);
      } catch (err: any) {
        console.error(err);
        if (err instanceof AdminAuthError) {
          setError("Your admin session has expired. Please log in again.");
        } else {
          setError("Failed to load locations.");
        }
      } finally {
        setLoading(false);
      }
    }

    void loadLocations();
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setCode("");
    setLat(null);
    setLng(null);
    setRadiusMeters(null);
    setActive(true);
    setGeofenceRadiusMeters(60);
    setClockInGraceSeconds(120);
    setPolicy("STRICT");
    setAddressQuery("");
    setGeocodeError(null);
  }

  function startEdit(location: Location) {
    setEditingId(location.id);
    setName(location.name);
    setCode(location.code);
    setLat(location.lat);
    setLng(location.lng);
    setRadiusMeters(location.radiusMeters);
    setActive(location.active);
    setGeofenceRadiusMeters(location.geofenceRadiusMeters ?? 60);
    setClockInGraceSeconds(location.clockInGraceSeconds ?? 120);
    setPolicy(location.policy ?? "STRICT");
    setAddressQuery("");
    setGeocodeError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGeocodeError(null);

    if (!name.trim() || !code.trim()) {
      setError("Name and code are required.");
      return;
    }
    if (lat == null || lng == null) {
      setError("Latitude and longitude are required.");
      return;
    }

    // Allow radius 0 (ADHOC marker), but must be >= 0
    if (radiusMeters != null && radiusMeters < 0) {
      setError("Radius must be zero or a positive number.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: name.trim(),
        code: code.trim(),
        lat,
        lng,
        radiusMeters: radiusMeters ?? 0,
        active,
        geofenceRadiusMeters,
        clockInGraceSeconds,
        policy,
      };

      if (editingId) {
        // UPDATE
        const res = await adminFetch(`/api/admin/locations/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const updated = (await res.json()) as Location;
        setLocations((prev) =>
          prev.map((loc) => (loc.id === updated.id ? updated : loc))
        );
      } else {
        // CREATE
        const res = await adminFetch("/api/admin/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const created = (await res.json()) as Location;
        setLocations((prev) => [...prev, created]);
      }

      resetForm();
    } catch (err: any) {
      console.error(err);
      if (err instanceof AdminAuthError) {
        setError("Your admin session has expired. Please log in again.");
      } else {
        setError(err.message || "Error saving location.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this location? This cannot be undone.")) return;

    try {
      setError(null);
      await adminFetch(`/api/admin/locations/${id}`, {
        method: "DELETE",
      });

      setLocations((prev) => prev.filter((loc) => loc.id !== id));

      // If we were editing this one, reset the form
      if (editingId === id) {
        resetForm();
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof AdminAuthError) {
        setError("Your admin session has expired. Please log in again.");
      } else {
        setError(err.message || "Error deleting location.");
      }
    }
  }

  async function handleGeocode(e: React.FormEvent) {
    e.preventDefault();
    setGeocodeError(null);

    const q = addressQuery.trim();
    if (!q) {
      setGeocodeError("Please enter an address or place.");
      return;
    }

    try {
      setGeocodeLoading(true);
      const res = await adminFetch("/api/admin/locations/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });

      const data = (await res.json()) as GeocodeResponse;

      if ("error" in data) {
        throw new Error(data.error || "Geocoding failed for that address.");
      }

      setLat(data.lat);
      setLng(data.lng);
    } catch (err: any) {
      console.error(err);
      if (err instanceof AdminAuthError) {
        setGeocodeError("Your admin session has expired. Please log in again.");
      } else {
        setGeocodeError(err.message || "Could not find coordinates.");
      }
    } finally {
      setGeocodeLoading(false);
    }
  }

  // Decide what coords to show on map
  const mapLat = lat ?? DEFAULT_CENTER[0];
  const mapLng = lng ?? DEFAULT_CENTER[1];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Locations</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage job sites and GPS radiuses. Click the map to fine-tune
          coordinates.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <div className="flex items-start justify-between gap-3">
            <p>{error}</p>
            {error.toLowerCase().includes("session") && (
              <a
                href="/admin/login"
                className="text-xs font-semibold text-red-200 underline underline-offset-2 hover:text-red-100"
              >
                Log in again
              </a>
            )}
          </div>
        </div>
      )}

      {/* Layout: form + map */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* FORM CARD */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-100">
            {editingId ? "Edit location" : "Create location"}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Name, code, and coordinates are required. Radius 0 marks this as an
            ADHOC bucket.
          </p>

          <form onSubmit={handleSave} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-200">
                Name
              </label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Lake Shop"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-200">
                Code
              </label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="LAKESHOP"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-200">
                  Latitude
                </label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  value={lat ?? ""}
                  onChange={(e) =>
                    setLat(
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                  step="0.000001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-200">
                  Longitude
                </label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  value={lng ?? ""}
                  onChange={(e) =>
                    setLng(
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                  step="0.000001"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-200">
                Radius (meters)
              </label>
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                value={radiusMeters ?? ""}
                onChange={(e) =>
                  setRadiusMeters(
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                min={0}
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Set to <strong>0</strong> to mark this as an ADHOC bucket
                (no GPS radius check).
              </p>
            </div>

            {/* Geofence Policy Controls */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 border-t border-slate-700 pt-3">
              <div>
                <label className="block text-xs font-medium text-slate-200">
                  Geofence Radius (m)
                </label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  value={geofenceRadiusMeters}
                  onChange={(e) => setGeofenceRadiusMeters(Number(e.target.value) || 60)}
                  min={0}
                />
                <p className="mt-1 text-[11px] text-slate-400">Clock-in/out distance check</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-200">
                  Grace Period (sec)
                </label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  value={clockInGraceSeconds}
                  onChange={(e) => setClockInGraceSeconds(Number(e.target.value) || 120)}
                  min={0}
                />
                <p className="mt-1 text-[11px] text-slate-400">Allow clock-in X sec early/late</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-200">
                  Policy
                </label>
                <select
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  value={policy}
                  onChange={(e) => setPolicy(e.target.value as "STRICT" | "WARN")}
                >
                  <option value="STRICT">Strict (reject)</option>
                  <option value="WARN">Warn (allow + flag)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-400">Geofence violation behavior</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="loc-active"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-slate-100 focus:ring-gray-900"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <label
                htmlFor="loc-active"
                className="text-xs font-medium text-slate-200"
              >
                Active job site
              </label>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center rounded-md bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:opacity-60"
              >
                {saving
                  ? editingId
                    ? "Saving..."
                    : "Creating..."
                  : editingId
                  ? "Save location"
                  : "Create location"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-slate-100"
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>

          {/* Geocode helper */}
          <div className="mt-6 border-t border-slate-800 pt-4">
            <p className="text-xs font-semibold text-slate-200">
              Coordinate lookup
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Paste an address or place name and we&apos;ll try to look up
              coordinates. You can then fine-tune by clicking the map.
            </p>

            <form
              onSubmit={handleGeocode}
              className="mt-2 flex flex-col gap-2 sm:flex-row"
            >
              <input
                className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                placeholder="123 Main St, City, State"
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
              />
              <button
                type="submit"
                disabled={geocodeLoading}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-200 shadow-sm hover:bg-slate-950 disabled:opacity-60"
              >
                {geocodeLoading ? "Looking up..." : "Lookup"}
              </button>
            </form>

            {geocodeError && (
              <p className="mt-1 text-xs text-red-300">{geocodeError}</p>
            )}
          </div>
        </div>

        {/* MAP CARD */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Location map
              </h2>
              <p className="text-[11px] text-slate-400">
                Click anywhere on the map to set the coordinates. Radius circle
                shows the GPS check area.
              </p>
            </div>
          </div>

          <div className="h-80 w-full">
            <LocationMap
              lat={mapLat}
              lng={mapLng}
              radiusMeters={radiusMeters}
              onChangeCoords={({ lat, lng }: { lat: number; lng: number }) => {
                setLat(lat);
                setLng(lng);
              }}
            />
          </div>
        </div>
      </div>

      {/* EXISTING LOCATIONS TABLE */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-100">
            Existing locations
          </h2>
          <p className="text-xs text-slate-400">
            Click &quot;Edit&quot; to load into the form.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  Code
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  Coords
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  Radius
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  Status
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900">
              {loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    Loading locations…
                  </td>
                </tr>
              )}

              {!loading && locations.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    No locations yet. Create one on the left.
                  </td>
                </tr>
              )}

              {locations.map((loc) => {
                const isAdhoc = loc.radiusMeters === 0;
                return (
                  <tr key={loc.id}>
                    <td className="px-4 py-2 align-top text-slate-100">
                      {loc.name}
                    </td>
                    <td className="px-4 py-2 align-top text-slate-200">
                      {loc.code}
                    </td>
                    <td className="px-4 py-2 align-top text-slate-200 text-xs">
                      {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
                    </td>
                    <td className="px-4 py-2 align-top text-slate-200 text-xs">
                      {loc.radiusMeters ?? 0} m{" "}
                      {isAdhoc && (
                        <span className="ml-1 inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200 border border-amber-500/40">
                          ADHOC
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          loc.active
                            ? "bg-emerald-500/15 text-emerald-200 border border-emerald-500/40"
                            : "bg-slate-800/80 text-slate-300 border border-slate-600/60"
                        }`}
                      >
                        {loc.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2 align-top text-right text-xs">
                      <button
                        onClick={() => startEdit(loc)}
                        className="mr-2 inline-flex items-center rounded-md border border-slate-800 px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-950"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(loc.id)}
                        className="inline-flex items-center rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-500/20"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}