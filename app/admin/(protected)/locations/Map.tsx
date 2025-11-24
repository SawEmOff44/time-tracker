"use client";

type MapProps = {
  lat: number;
  lng: number;
  radius: number;
};

export default function Map({ lat, lng, radius }: MapProps) {
  const hasCoords =
    Number.isFinite(lat) && Number.isFinite(lng) && !Number.isNaN(radius);

  if (!hasCoords) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-xs text-slate-400">
        Enter valid latitude and longitude to preview.
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-slate-900 text-white">
      {/* Gradient background to fake a “mapy” feel */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black opacity-90" />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-20">
        <div className="w-full h-full bg-[radial-gradient(circle_at_center,_#ffffff_1px,_transparent_1px)] bg-[length:24px_24px]" />
      </div>

      {/* Crosshair in the center */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative">
          <div className="w-10 h-10 rounded-full border border-emerald-400/80 shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[1px] h-10 bg-emerald-300/80" />
            <div className="w-10 h-[1px] bg-emerald-300/80 absolute left-1/2 -translate-x-1/2" />
          </div>
        </div>
      </div>

      {/* Info panel */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/60 backdrop-blur-sm text-[0.7rem]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="uppercase tracking-wide text-[0.65rem] text-slate-500">
              Site center (approx)
            </div>
            <div className="font-mono text-xs">
              Lat: {lat.toFixed(6)} | Lng: {lng.toFixed(6)}
            </div>
          </div>
          <div className="text-right">
            <div className="uppercase tracking-wide text-[0.65rem] text-slate-500">
              Geofence radius
            </div>
            {radius === 0 ? (
              <div className="font-semibold text-amber-300">
                No geofence (0 m)
              </div>
            ) : (
              <div className="font-mono text-xs">
                {radius.toFixed(0)} m
              </div>
            )}
          </div>
        </div>
        {radius === 0 && (
          <div className="mt-1 text-[0.65rem] text-amber-200/90">
            This location will allow clock-ins from anywhere (ad-hoc site).
          </div>
        )}
      </div>
    </div>
  );
}