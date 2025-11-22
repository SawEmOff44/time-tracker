// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Rhinehart Co Time Tracker",
  description: "Time tracking and payroll support for Rhinehart Co.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Background is controlled by globals.css (white) */}
      <body className="min-h-screen">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Link href="/">
                <div className="flex items-center gap-2 cursor-pointer">
                  <Image
                    src="/rhinehart-logo.jpeg"
                    alt="Rhinehart Co. Logo"
                    width={160}
                    height={40}
                    className="h-10 w-auto object-contain"
                    priority
                  />
                </div>
              </Link>
            </div>

            <nav className="flex items-center gap-4 text-sm">
              <Link href="/clock" className="hover:underline">
                Clock In / Out
              </Link>
              <Link
                href="/admin/login"
                className="text-gray-500 hover:text-gray-800 hover:underline"
              >
                Admin
              </Link>
            </nav>
          </div>
        </header>

        {/* Page content sits on the white body */}
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}