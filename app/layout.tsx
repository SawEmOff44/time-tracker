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
      <body className="min-h-screen bg-slate-100 text-slate-900">
        {/* Public header */}
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
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
                <span className="text-sm font-semibold text-slate-900">
                  Time Tracking
                </span>
                <span className="text-[11px] text-slate-500">
                  GPS-aware clock in / out
                </span>
              </div>
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              <Link
                href="/clock"
                className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                Clock In / Out
              </Link>
              <Link
                href="/admin"
                className="rounded-md px-3 py-1.5 border border-slate-300 text-slate-800 hover:bg-slate-900 hover:text-slate-50 hover:border-slate-900 transition-colors"
              >
                Admin
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}