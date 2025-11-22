// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Rhinehart Co. Time Tracking",
  description: "Location-aware time tracking for field crews.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <div className="min-h-screen flex flex-col">
          {/* Global header (public) */}
          <header className="border-b bg-white/80 backdrop-blur">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
              {/* Logo always sends to /clock */}
              <Link href="/clock" className="flex items-center gap-3">
                <Image
                  src="/rhinehart-logo.jpeg"
                  alt="Rhinehart Co. Logo"
                  width={150}
                  height={50}
                  className="h-10 w-auto object-contain"
                  priority
                />
                <span className="text-sm font-medium text-gray-700 tracking-tight">
                  Time Tracking
                </span>
              </Link>

              {/* Simple top-level nav */}
              <nav className="flex items-center gap-3 text-sm">
                <Link
                  href="/clock"
                  className="px-2 py-1 rounded-md text-gray-700 hover:text-black hover:bg-gray-100 transition-colors"
                >
                  Clock In / Out
                </Link>
                <Link
                  href="/admin"
                  className="px-2 py-1 rounded-md text-gray-700 hover:text-black hover:bg-gray-100 transition-colors"
                >
                  Admin
                </Link>
              </nav>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 bg-gray-50/60">{children}</main>
        </div>
      </body>
    </html>
  );
}