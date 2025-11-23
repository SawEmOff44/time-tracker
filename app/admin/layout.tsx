// app/admin/layout.tsx
import "../globals.css";
import Image from "next/image";
import Link from "next/link";
import { AdminLogoutButton } from "./AdminLogoutButton";

export const metadata = {
  title: "Rhinehart Time | Admin",
  description: "Admin dashboard for Rhinehart Time Tracker",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <header className="border-b bg-white">
          <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3 gap-4">
            {/* Logo + Brand */}
            <Link href="/admin" className="flex items-center gap-3">
              <Image
                src="/rhinehart-logo.jpeg"
                alt="Rhinehart Co. Logo"
                width={180}
                height={60}
                className="h-10 w-auto object-contain"
                priority
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight">
                  Rhinehart Time
                </span>
                <span className="text-[11px] text-gray-500">
                  Admin Control Panel
                </span>
              </div>
            </Link>

            {/* Nav + Logout */}
            <div className="flex items-center gap-6">
              <nav className="hidden sm:flex items-center gap-4 text-sm">
                <Link
                  href="/admin"
                  className="text-gray-700 hover:text-black transition"
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/employees"
                  className="text-gray-700 hover:text-black transition"
                >
                  Employees
                </Link>
                <Link
                  href="/admin/locations"
                  className="text-gray-700 hover:text-black transition"
                >
                  Locations
                </Link>
                <Link
                  href="/admin/shifts"
                  className="text-gray-700 hover:text-black transition"
                >
                  Shifts
                </Link>
                <Link
                  href="/admin/payroll"
                  className="text-gray-700 hover:text-black transition"
                >
                  Payroll
                </Link>
              </nav>

              <AdminLogoutButton />
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}