// app/admin/layout.tsx
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-slate-700 bg-slate-900/60 backdrop-blur">
        <nav>
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-4">
            {/* Left: Admin label / home */}
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-100 shadow-sm hover:border-amber-400 hover:text-amber-200 hover:shadow-amber-500/20"
              >
                Admin
              </Link>
            </div>

            {/* Right: quick links */}
            <div className="flex items-center gap-2">
              <Link
                href="/worker"
                className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-100 shadow-sm hover:border-amber-400 hover:text-amber-200 hover:shadow-amber-500/20"
              >
                Worker Portal
              </Link>
              <Link
                href="/clock"
                className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-100 shadow-sm hover:border-amber-400 hover:text-amber-200 hover:shadow-amber-500/20"
              >
                Clock In / Out
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Give admin pages room to breathe */}
      <main className="mx-auto max-w-[1600px] px-6 py-6">{children}</main>
    </>
  );
}