"use client";

import { useEffect } from "react";

export default function WorkerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Worker route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-slate-100">
      <h2 className="text-lg font-semibold text-red-200">Something went wrong</h2>
      <p className="text-sm text-red-200/80">The worker page failed to render. You can try to recover below.</p>
      {error?.message && (
        <pre className="whitespace-pre-wrap rounded-lg bg-slate-900/70 p-3 text-xs text-red-300 border border-red-500/20">{error.message}</pre>
      )}
      <div className="flex gap-3">
        <button onClick={() => reset()} className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300">
          Retry
        </button>
        <button onClick={() => location.reload()} className="rounded-full border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700">
          Reload
        </button>
      </div>
    </div>
  );
}
