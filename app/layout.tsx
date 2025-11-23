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
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {/* Public header */}
        <header className="border-b bg-white">
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
                <span className="text-sm font-semibold">Time Tracking</span>
              </div>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/clock"
                className="rounded px-3 py-1.5 text-gray-700 hover:bg-gray-100"
              >
                Clock In / Out
              </Link>
              <Link
                href="/admin"
                className="rounded px-3 py-1.5 text-gray-700 hover:bg-gray-100"
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