"use client";

import { useEffect, useState, FormEvent } from "react";

type Location = {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  active: boolean;
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("75");

  async function loadLocations() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/locations");
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to load locations");
      }
      setLocations(data);
    } catch (err: any) {
      setError(err.message || "Failed to load locations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLocations();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          radiusMeters: parseFloat(radiusMeters),
          active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to create location");
      }

      setName("");
      setCode("");
      setLat("");
      setLng("");
      setRadiusMeters("75");
      await loadLocations();
    } catch (err: any) {
      setError(err.message || "Failed to create location");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Locations</h1>
        <p className="text-sm text-gray-600">
          Manage job sites and their GPS coordinates.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Add location */}
      <form
        onSubmit={handleCreate}
        className="bg-white border rounded p-4 space-y-3"
      >
        <h2 className="font-semibold mb-1">Add Location</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Name</label>
            <input
              className="border rounded px-2 py-1 w-full text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Code</label>
            <input
              className="border rounded px-2 py-1 w-full text-sm"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Radius (meters)
            </label>
            <input
              type="number"
              className="border rounded px-2 py-1 w-full text-sm"
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">
              Latitude (center)
            </label>
            <input
              className="border rounded px-2 py-1 w-full text-sm"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Longitude (center)
            </label>
            <input
              className="border rounded px-2 py-1 w-full text-sm"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-2 px-4 py-2 rounded bg-black text-white text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Saving..." : "Add Location"}
        </button>
      </form>

      {/* Locations list */}
      <div className="bg-white border rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                Name
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                Code
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                Center (lat, lng)
              </th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">
                Radius (m)
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-3 text-center text-gray-400"
                >
                  Loading locations...
                </td>
              </tr>
            ) : locations.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-3 text-center text-gray-400"
                >
                  No locations yet.
                </td>
              </tr>
            ) : (
              locations.map((loc) => (
                <tr key={loc.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">{loc.name}</td>
                  <td className="px-3 py-2">{loc.code}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {loc.radiusMeters.toFixed(0)}
                  </td>
                  <td className="px-3 py-2">
                    {loc.active ? (
                      <span className="text-green-700 text-xs font-semibold">
                        Active
                      </span>
                    ) : (
                      <span className="text-gray-500 text-xs">Inactive</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}