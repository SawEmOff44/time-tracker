// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Rhinehart Time",
  description: "Simple GPS-aware time tracking",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        {/* Top nav fixed above everything */}
        <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-8 w-auto">
                <Image
                  src="/rhinehart-logo.jpeg"
                  alt="Rhinehart Co. logo"
                  width={160}
                  height={32}
                  className="h-8 w-auto object-contain"
                  priority
                />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] font-semibold tracking-[0.2em] text-amber-400">
                  ADMIN
                </span>
                <span className="text-xs font-medium text-slate-200">
                  Time tracking control panel
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-3 text-sm">
              <Link
                href="/clock"
                className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-100 shadow-sm hover:border-amber-400 hover:text-amber-200 hover:shadow-amber-500/20"
              >
                Clock In / Out
              </Link>
              <Link
                href="/worker"
                className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-100 shadow-sm hover:border-amber-400 hover:text-amber-200 hover:shadow-amber-500/20"
              >
                Worker Portal
              </Link>
              {/* 🔹 Admin button now matches Clock styling (no yellow fill) */}
              <Link
                href="/admin"
                className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-100 shadow-sm hover:border-amber-400 hover:text-amber-200 hover:shadow-amber-500/20"
              >
                Admin
              </Link>
            </nav>
          </div>
        </header>

        {/* Wider content area so admin pages breathe more */}
        <main className="mx-auto max-w-[1600px] px-4 pt-20 pb-8">
          {children}
        </main>
      </body>
    </html>
  );
}