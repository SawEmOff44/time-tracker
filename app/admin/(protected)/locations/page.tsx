"use client";

import { useEffect, useState } from "react";

type Location = {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  active: boolean;
};

// Simple OpenStreetMap embed centered on lat/lng
function MapPreview({
  lat,
  lng,
  radiusMeters = 75,
  title,
}: {
  lat: number;
  lng: number;
  radiusMeters?: number;
  title?: string;
}) {
  // rough conversion meters -> degrees
  const paddingDeg = radiusMeters / 111_000;
  const minLat = lat - paddingDeg;
  const maxLat = lat + paddingDeg;
  const minLng = lng - paddingDeg;
  const maxLng = lng + paddingDeg;

  const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
  const marker = `${lat},${lng}`;

  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox
  )}&layer=mapnik&marker=${encodeURIComponent(marker)}`;

  return (
    <div className="border rounded overflow-hidden mt-2">
      {title && (
        <div className="px-2 py-1 text-xs font-semibold bg-gray-100 border-b">
          {title}
        </div>
      )}
      <iframe
        title={title || "Location map preview"}
        src={src}
        style={{ border: 0 }}
        className="w-full h-52"
        loading="lazy"
      />
      <div className="px-2 py-1 text-[0.65rem] text-gray-500 bg-gray-50 border-t">
        Map data © OpenStreetMap contributors
      </div>
    </div>
  );
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New location form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("75");
  const [saving, setSaving] = useState(false);

  // Which existing location to show in map preview
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );

  async function loadLocations() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/locations");

      const data = (await res.json().catch(() => ({}))) as
        | Location[]
        | { error?: string };

      if (!res.ok) {
        const msg =
          (data as any).error ||
          `Failed to load locations (status ${res.status})`;
        throw new Error(msg);
      }

      setLocations(data as Location[]);
    } catch (err: any) {
      console.error("loadLocations error:", err);
      setError(err.message || "Failed to load locations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLocations();
  }, []);

  async function handleCreate(e: React.FormEvent) {
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
          radiusMeters: parseFloat(radius),
          active: true,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "Failed to create location");
      }

      setName("");
      setCode("");
      setLat("");
      setLng("");
      setRadius("75");

      await loadLocations();
    } catch (err: any) {
      console.error("createLocation error:", err);
      setError(err.message || "Failed to create location");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(loc: Location) {
    try {
      const res = await fetch(`/api/admin/locations/${loc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !loc.active }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "Failed to update location");
      }

      await loadLocations();
    } catch (err: any) {
      console.error("toggleActive error:", err);
      setError(err.message || "Failed to update location");
    }
  }

  async function deleteLocation(id: string) {
    if (!confirm("Delete this location?")) return;

    try {
      const res = await fetch(`/api/admin/locations/${id}`, {
        method: "DELETE",
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete location");
      }

      await loadLocations();
    } catch (err: any) {
      console.error("deleteLocation error:", err);
      setError(err.message || "Failed to delete location");
    }
  }

  // Derived: form lat/lng preview values (only when valid)
  const formLat = parseFloat(lat);
  const formLng = parseFloat(lng);
  const formRadius = parseFloat(radius);
  const hasValidFormCoords =
    !Number.isNaN(formLat) && !Number.isNaN(formLng) && lat !== "" && lng !== "";

  const selectedLocation = selectedLocationId
    ? locations.find((l) => l.id === selectedLocationId) || null
    : null;

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-2">Locations</h1>

      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}

      {/* Create location */}
      <section className="bg-white shadow rounded p-4 space-y-4 max-w-xl">
        <h2 className="text-lg font-semibold">Add Location</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              className="border rounded px-2 py-1 w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Code</label>
            <input
              className="border rounded px-2 py-1 w-full"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Latitude</label>
              <input
                className="border rounded px-2 py-1 w-full"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="e.g. 33.8295"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Longitude
              </label>
              <input
                className="border rounded px-2 py-1 w-full"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="-96.5743"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Radius (meters)
            </label>
            <input
              className="border rounded px-2 py-1 w-full"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded bg-black text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add Location"}
          </button>
        </form>

        {/* Form map preview */}
        {hasValidFormCoords && (
          <MapPreview
            lat={formLat}
            lng={formLng}
            radiusMeters={
              !Number.isNaN(formRadius) && formRadius > 0 ? formRadius : 75
            }
            title="New Location Preview"
          />
        )}
      </section>

      {/* Locations list */}
      <section className="bg-white shadow rounded p-4">
        <h2 className="text-lg font-semibold mb-3">Existing Locations</h2>
        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : locations.length === 0 ? (
          <div className="text-sm text-gray-500">No locations yet.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1 pr-2">Name</th>
                    <th className="text-left py-1 pr-2">Code</th>
                    <th className="text-left py-1 pr-2">Lat</th>
                    <th className="text-left py-1 pr-2">Lng</th>
                    <th className="text-left py-1 pr-2">Radius</th>
                    <th className="text-left py-1 pr-2">Active</th>
                    <th className="text-left py-1 pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((loc) => (
                    <tr key={loc.id} className="border-b">
                      <td className="py-1 pr-2">{loc.name}</td>
                      <td className="py-1 pr-2">{loc.code}</td>
                      <td className="py-1 pr-2">{loc.lat}</td>
                      <td className="py-1 pr-2">{loc.lng}</td>
                      <td className="py-1 pr-2">{loc.radiusMeters}</td>
                      <td className="py-1 pr-2">
                        {loc.active ? "Yes" : "No"}
                      </td>
                      <td className="py-1 pr-2 space-x-2">
                        <button
                          onClick={() => toggleActive(loc)}
                          className="px-2 py-1 text-xs rounded border"
                        >
                          {loc.active ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() =>
                            setSelectedLocationId(
                              selectedLocationId === loc.id ? null : loc.id
                            )
                          }
                          className="px-2 py-1 text-xs rounded border"
                        >
                          {selectedLocationId === loc.id
                            ? "Hide Map"
                            : "View Map"}
                        </button>
                        <button
                          onClick={() => deleteLocation(loc.id)}
                          className="px-2 py-1 text-xs rounded border border-red-500 text-red-600"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedLocation && (
              <div className="mt-4 max-w-xl">
                <MapPreview
                  lat={selectedLocation.lat}
                  lng={selectedLocation.lng}
                  radiusMeters={selectedLocation.radiusMeters}
                  title={`Map: ${selectedLocation.name}`}
                />
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}