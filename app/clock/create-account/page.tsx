// app/clock/create-account/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

type RegisterResponse = {
  message?: string;
  error?: string;
};

export default function CreateAccountPage() {
  const [name, setName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<RegisterResponse | null>(null);

  const hasMismatch = pin !== confirmPin && confirmPin.length > 0;

  const canSubmit =
    !!name &&
    !!employeeCode &&
    !!pin &&
    !!confirmPin &&
    !hasMismatch &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setStatus(null);

    try {
      const res = await fetch("/api/clock/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          employeeCode,
          pin,
        }),
      });

      const data = (await res.json()) as RegisterResponse;

      if (!res.ok) {
        setStatus({
          error: data.error || "Could not create account.",
        });
      } else {
        setStatus({
          message:
            data.message ??
            "Account created. A supervisor must approve you before you can clock in.",
        });
        // Lock fields after success so people don't spam it
        // but keep the values visible.
      }
    } catch (err) {
      console.error(err);
      setStatus({ error: "Unexpected error creating account." });
    } finally {
      setSubmitting(false);
    }
  }

  const messageColor = status?.error ? "text-red-400" : "text-emerald-300";

  return (
    <div className="min-h-screen flex items-center justify-center clock-stone-bg">
      <div className="w-full max-w-xl rounded-3xl bg-slate-950/80 shadow-[0_40px_120px_rgba(15,23,42,0.95)] border border-slate-700/70 backdrop-blur-xl px-8 py-8 sm:px-10 sm:py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-slate-50">
              Create your worker account
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Your supervisor will review and approve you before you can clock
              in.
            </p>
          </div>
          <Link
            href="/clock"
            className="text-xs font-medium text-slate-300 hover:text-slate-100 underline underline-offset-4"
          >
            Back to clock
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              Full name
            </label>
            <input
              type="text"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              Employee code
            </label>
            <input
              type="text"
              placeholder="e.g. ALI001"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
              className="mt-1 w-full"
              required
            />
            <p className="mt-1 text-[11px] text-slate-400">
              This is the code you&apos;ll use to clock in.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              Email (optional)
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                PIN
              </label>
              <input
                type="password"
                placeholder="4–8 digits"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="mt-1 w-full"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Confirm PIN
              </label>
              <input
                type="password"
                placeholder="Re-enter PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="mt-1 w-full"
                required
              />
              {hasMismatch && (
                <p className="mt-1 text-[11px] text-red-400">
                  PINs do not match.
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3 rounded-xl font-semibold bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:opacity-60 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-300 focus:ring-offset-slate-950"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        {status && (
          <p className={`mt-4 text-xs sm:text-sm text-center ${messageColor}`}>
            {status.error ?? status.message}
          </p>
        )}

        {!status?.error && (
          <p className="mt-3 text-[11px] text-slate-400 text-center">
            Once approved, use your employee code & PIN on the main clock page
            to start tracking time.
          </p>
        )}
      </div>
    </div>
  );
}