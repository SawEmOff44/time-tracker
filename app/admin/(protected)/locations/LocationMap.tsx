"use client";

import { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import type { LatLngLiteral } from "leaflet";

const DEFAULT_CENTER: LatLngLiteral = {
  lat: 32.778, // Dallas-ish fallback
  lng: -96.795,
};

export type LocationMapProps = {
  lat: number | null;
  lng: number | null;
  radiusMeters: number | null;
  /**
   * Called when the user clicks on the map. Optional.
   */
  onChangeCoords?: (coords: { lat: number; lng: number }) => void;
};

function MapClickHandler({
  onChangeCoords,
}: {
  onChangeCoords?: (coords: { lat: number; lng: number }) => void;
}) {
  useMapEvents({
    click(e) {
      if (!onChangeCoords || !e.latlng) return;
      const { lat, lng } = e.latlng;
      onChangeCoords({ lat, lng });
    },
  });

  return null;
}

function MapRecenter({
  lat,
  lng,
}: {
  lat: number | null;
  lng: number | null;
}) {
  const map = useMap();

  const center = useMemo<LatLngLiteral>(() => {
    if (typeof lat === "number" && typeof lng === "number") {
      return { lat, lng };
    }
    return DEFAULT_CENTER;
  }, [lat, lng]);

  // when center changes, recenter the map
  map.setView(center);
  return null;
}

export default function LocationMap({
  lat,
  lng,
  radiusMeters,
  onChangeCoords,
}: LocationMapProps) {
  const center: LatLngLiteral =
    typeof lat === "number" && typeof lng === "number"
      ? { lat, lng }
      : DEFAULT_CENTER;

  const showCircle =
    typeof lat === "number" &&
    typeof lng === "number" &&
    typeof radiusMeters === "number" &&
    radiusMeters > 0;

  const showMarker =
    typeof lat === "number" && typeof lng === "number" && !showCircle;

  return (
    <div className="w-full">
      <MapContainer
        center={center}
        zoom={16}
        scrollWheelZoom={true}
        className="w-full h-80 rounded-lg border border-slate-800 overflow-hidden"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* keep map in sync with latest lat/lng */}
        <MapRecenter lat={lat} lng={lng} />

        {/* click-to-set coords */}
        <MapClickHandler onChangeCoords={onChangeCoords} />

        {showCircle && (
          <Circle
            center={center}
            radius={radiusMeters!}
            pathOptions={{
              color: "#2563eb",
              weight: 2,
              fillColor: "#60a5fa",
              fillOpacity: 0.25,
            }}
          />
        )}

        {showMarker && <Marker position={center} />}
      </MapContainer>
    </div>
  );
}