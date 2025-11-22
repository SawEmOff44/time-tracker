// app/admin/(protected)/layout.tsx

import type { ReactNode } from "react";
import Link from "next/link";
import AdminLogoutButton from "@/app/admin/AdminLogoutButton";

export default function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">

      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Admin Panel
          </h1>
          <p className="text-xs text-gray-500">
            Manage employees, locations, shifts, payroll
          </p>
        </div>

        <AdminLogoutButton />
      </div>

      {/* Admin Navigation */}
      <div className="border-b pb-3">
        <nav className="flex gap-3 text-sm">
          <AdminNavLink href="/admin" label="Dashboard" />
          <AdminNavLink href="/admin/employees" label="Employees" />
          <AdminNavLink href="/admin/locations" label="Locations" />
          <AdminNavLink href="/admin/shifts" label="Shifts" />
          <AdminNavLink href="/admin/payroll" label="Payroll" />
        </nav>
      </div>

      <div className="pt-3">{children}</div>
    </div>
  );
}


// SMALL client-only component for active link highlighting
function AdminNavLink({ href, label }: { href: string; label: string }) {
  "use client";
  const { usePathname } = require("next/navigation");
  const pathname = usePathname();

  const isActive =
    pathname === href ||
    (href !== "/admin" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={
        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors " +
        (isActive
          ? "bg-black text-white"
          : "text-gray-600 hover:text-black hover:bg-gray-100")
      }
    >
      {label}
    </Link>
  );
}