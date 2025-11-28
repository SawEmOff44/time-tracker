// app/worker/login/page.tsx
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function WorkerLoginPage() {
  const router = useRouter();
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!employeeCode || !pin) {
      setError("Employee code and PIN are required.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/worker/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode: employeeCode.trim(), pin }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "Login failed. Check your code and PIN.");
        return;
      }

      // Cookie is set by the API; just send them to worker portal
      router.push("/worker");
    } catch (err) {
      console.error(err);
      setError("Unexpected error while logging in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/80 px-6 py-7 shadow-[0_24px_80px_rgba(15,23,42,0.95)]"
      >
        <h1 className="text-lg font-semibold text-slate-50 text-center">
          Worker Portal
        </h1>
        <p className="mt-1 text-xs text-slate-400 text-center">
          View your hours and request shift changes.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
              Employee code
            </label>
            <input
              type="text"
              className="mt-1 w-full"
              placeholder="e.g. WILL"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
              PIN
            </label>
            <input
              type="password"
              className="mt-1 w-full"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-amber-400 py-2.5 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}