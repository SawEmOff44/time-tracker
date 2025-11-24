// app/clock/create-account/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Status = "idle" | "submitting" | "success" | "error";

export default function CreateAccountPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setMessage(null);

    if (pin !== confirmPin) {
      setStatus("error");
      setMessage("PIN and confirmation do not match.");
      return;
    }

    try {
      const res = await fetch("/api/public/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          employeeCode,
          pin,
        }),
      });

      const data = (await res.json()) as { error?: string; message?: string };

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Unable to create account.");
        return;
      }

      setStatus("success");
      setMessage(
        data.message ??
          "Account created. You can now use your ID and PIN to clock in."
      );

      // Small delay then send them back to clock page
      setTimeout(() => {
        router.push("/clock");
      }, 1500);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage("Unexpected error talking to the server.");
    }
  }

  const isSubmitting = status === "submitting";

  return (
    <div className="min-h-screen flex items-center justify-center clock-stone-bg">
      <div className="w-full max-w-md bg-slate-950/70 backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_35px_60px_rgba(0,0,0,0.6)] p-1">
        {/* Inner frosted panel */}
        <div className="bg-slate-900/80 rounded-3xl p-8 shadow-inner border border-white/5">
          <h1 className="text-xl font-semibold text-slate-50 text-center mb-2">
            Create Worker Account
          </h1>
          <p className="text-xs text-slate-300 text-center mb-6">
            Use this form once per worker to set up their own login.
            Afterwards they&apos;ll clock in using their ID and PIN on the main
            screen.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label>Full name</label>
              <input
                type="text"
                className="w-full mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. William Skiles"
                required
              />
            </div>

            <div>
              <label>Email</label>
              <input
                type="email"
                className="w-full mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label>Employee ID</label>
              <input
                type="text"
                className="w-full mt-1"
                value={employeeCode}
                onChange={(e) =>
                  setEmployeeCode(e.target.value.toUpperCase())
                }
                placeholder="e.g. WILL001"
                required
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Workers will type this ID on the clock screen instead of
                their name.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label>PIN</label>
                <input
                  type="password"
                  className="w-full mt-1"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="4–6 digits"
                  required
                />
              </div>
              <div>
                <label>Confirm PIN</label>
                <input
                  type="password"
                  className="w-full mt-1"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="repeat PIN"
                  required
                />
              </div>
            </div>

            {message && (
              <p
                className={`mt-2 text-xs text-center ${
                  status === "success" ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-3 w-full py-3 rounded-xl bg-emerald-500 text-slate-950 font-semibold text-sm tracking-wide hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-xs text-slate-400 text-center">
            Already have an ID and PIN?{" "}
            <Link
              href="/clock"
              className="text-amber-300 hover:text-amber-200 underline underline-offset-4"
            >
              Go back to clock in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}