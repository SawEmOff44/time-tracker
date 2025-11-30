"use client";

import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function WorkerTopbar({
  name,
  code,
}: {
  name: string | null;
  code: string | null;
}) {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

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
    <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/80">
      <div className="flex items-center justify-between px-4 py-2 text-xs">
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
      
      {userId && (
        <div className="flex gap-2 border-t border-slate-800 px-4 py-2">
          <Link
            href={`/worker/${userId}`}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Shifts
          </Link>
          <Link
            href={`/worker/${userId}/time-off`}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Time Off
          </Link>
          <Link
            href={`/worker/${userId}/documents`}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Documents
          </Link>
        </div>
      )}
    </div>
  );
}