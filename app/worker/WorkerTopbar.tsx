"use client";

import { useRouter } from "next/navigation";

export default function WorkerTopbar({
  name,
  code,
}: {
  name: string | null;
  code: string | null;
}) {
  const router = useRouter();

  if (!code) return null;

  async function handleLogout() {
    try {
      await fetch("/api/worker/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      router.push("/worker/login");
    }
  }

  return (
    <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs">
      <div className="text-slate-300">
        Logged in as{" "}
        <span className="font-semibold text-slate-50">{name || code}</span>{" "}
        <span className="text-slate-500">({code})</span>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:bg-slate-800"
      >
        Log out
      </button>
    </div>
  );
}