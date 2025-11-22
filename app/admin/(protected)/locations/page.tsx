"use client";

import { useEffect, useState, FormEvent } from "react";
import dynamic from "next/dynamic";

type Location = {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

// Dynamically import “map” preview (client-side only)
const Map = dynamic(() => import("./Map"), { ssr: false });

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("100");
  const [active, setActive] = useState(true);

  // NEW: Separate address field just for geocoding
  const [addressLookup, setAddressLookup] = useState("");
  const [geocodeInfo, setGeocodeInfo] = useState<any>(null);

  // -------------------------------
  // Load locations
  // -------------------------------
  async function loadLocations() {
    try {
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

  // -------------------------------
  // Geocode lookup (address → lat/lng)
  // -------------------------------
  async function handleGeocodeLookup() {
    if (!addressLookup.trim()) {
      setError("Enter a street address to look up coordinates.");
      return;
    }

    setError(null);
    setGeocodeInfo(null);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          addressLookup
        )}&format=json&limit=1`
      );

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setError("No results found for that address. Try adding city + state.");
        return;
      }

      const place = data[0];
      setLat(place.lat);
      setLng(place.lon);
      setGeocodeInfo(place);
    } catch (err) {
      console.error("Geocode lookup failed:", err);
      setError("Failed to look up address. Check your connection and try again.");
    }
  }

  // -------------------------------
  // Create Location
  // -------------------------------
  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      const parsedRadius = parseFloat(radiusMeters);

      if (!name.trim() || !code.trim()) {
        throw new Error("Name and code are required.");
      }
      if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
        throw new Error("Latitude and longitude must be valid numbers.");
      }

      // ALLOW 0m → unbounded site; only disallow negative
      if (!Number.isFinite(parsedRadius) || parsedRadius < 0) {
        throw new Error("Radius must be a non-negative number (0 or more).");
      }

      const res = await fetch("/api/admin/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim(),
          lat: parsedLat,
          lng: parsedLng,
          radiusMeters: parsedRadius,
          active,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to create location");
      }

      // Reset form
      setName("");
      setCode("");
      setLat("");
      setLng("");
      setRadiusMeters("100");
      setActive(true);
      setAddressLookup("");
      setGeocodeInfo(null);

      await loadLocations();
    } catch (err: any) {
      setError(err.message || "Failed to create location.");
    } finally {
      setSaving(false);
    }
  }

  // -------------------------------
  // Component UI
  // -------------------------------
  return (
    <div className="max-w-5xl mx-auto py-10 space-y-10">
      <h1 className="text-3xl font-bold">Job Sites / Locations</h1>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 text-red-800 px-4 py-2 rounded">
          {error}
        </div>
      )}

      {/* FORM */}
      <form
        onSubmit={handleCreate}
        className="bg-white rounded shadow p-6 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div className="col-span-2">
          <h2 className="text-xl font-semibold mb-2">Create New Location</h2>
        </div>

        {/* Name & Code */}
        <div>
          <label className="text-sm font-medium">Name</label>
          <input
            className="border px-2 py-1 rounded w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Lake Shop"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium">Internal Code</label>
          <input
            className="border px-2 py-1 rounded w-full"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="LAKESHOP"
            required
          />
        </div>

        {/* Address for lookup */}
        <div className="md:col-span-2">
          <label className="text-sm font-medium">
            Street Address (for coordinate lookup)
          </label>
          <div className="flex gap-2 mt-1">
            <input
              className="border px-2 py-1 rounded w-full"
              value={addressLookup}
              onChange={(e) => setAddressLookup(e.target.value)}
              placeholder="123 Main St, City, State"
            />
            <button
              type="button"
              onClick={handleGeocodeLookup}
              className="px-3 py-1 bg-blue-600 text-white rounded whitespace-nowrap"
            >
              Lookup Coordinates
            </button>
          </div>
          {geocodeInfo?.display_name && (
            <p className="mt-1 text-xs text-gray-500">
              Matched: {geocodeInfo.display_name}
            </p>
          )}
        </div>

        {/* Lat/Lng */}
        <div>
          <label className="text-sm font-medium">Latitude</label>
          <input
            className="border px-2 py-1 rounded w-full"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium">Longitude</label>
          <input
            className="border px-2 py-1 rounded w-full"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            required
          />
        </div>

        {/* Radius */}
        <div>
          <label className="text-sm font-medium">Radius (meters)</label>
          <input
            className="border px-2 py-1 rounded w-full"
            value={radiusMeters}
            onChange={(e) => setRadiusMeters(e.target.value)}
            required
          />
          <p className="text-xs text-gray-500">
            Use <strong>0</strong> for ad-hoc / no geofence.
          </p>
        </div>

        {/* Active */}
        <div className="flex items-center gap-2">
          <input
            id="active"
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <label htmlFor="active" className="text-sm font-medium">
            Active
          </label>
        </div>

        {/* Submit */}
        <button
          disabled={saving}
          className="col-span-2 py-2 bg-black text-white rounded disabled:opacity-50"
        >
          {saving ? "Saving..." : "Create Location"}
        </button>

        {/* MAP PREVIEW */}
        <div className="col-span-2">
          {lat && lng ? (
            <div className="h-64 w-full border rounded overflow-hidden">
              <Map
                lat={parseFloat(lat)}
                lng={parseFloat(lng)}
                radius={parseFloat(radiusMeters)}
              />
            </div>
          ) : (
            <p className="text-gray-500 text-sm italic">
              Enter coordinates or use the lookup to preview map.
            </p>
          )}
        </div>
      </form>

      {/* EXISTING LOCATIONS LIST */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Existing Locations</h2>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-2">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="p-4 bg-white shadow rounded flex justify-between"
              >
                <div>
                  <p className="font-bold">{loc.name}</p>
                  <p className="text-sm text-gray-600">{loc.code}</p>
                  <p className="text-xs text-gray-500">
                    {loc.lat}, {loc.lng} — {loc.radiusMeters}m radius
                    {loc.radiusMeters === 0 && " (ad-hoc / no geofence)"}
                  </p>
                </div>
                <div className="text-sm">
                  {loc.active ? (
                    <span className="text-green-600">Active</span>
                  ) : (
                    <span className="text-gray-500">Inactive</span>
                  )}
                </div>
              </div>
            ))}
            {locations.length === 0 && (
              <p className="text-sm text-gray-500 italic">
                No locations yet. Create one above.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}