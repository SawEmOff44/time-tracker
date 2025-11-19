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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResponse(null);

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
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center">Clock In / Out</h1>

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
              {/* For now these are hard-coded; later we’ll load from the DB */}
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
            {loading ? "Submitting..." : "Clock In / Out"}
          </button>
        </form>

        {/* Response box */}
        <div className="mt-4">
          <h2 className="text-sm font-semibold mb-1">Response</h2>
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
