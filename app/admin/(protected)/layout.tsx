// app/admin/(protected)/layout.tsx

import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminLogoutButton from "@/app/admin/AdminLogoutButton";

export default function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // ✅ Server-side auth check – runs before rendering children
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;

  if (!session) {
    // Not logged in → send to login
    redirect("/admin/login");
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Admin Panel
          </h1>
          <p className="text-xs text-gray-500">
            Manage employees, locations, shifts & payroll.
          </p>
        </div>

        <AdminLogoutButton />
      </div>

      {/* Admin Navigation */}
      <div className="border-b pb-3">
        <AdminNav />
      </div>

      {/* Page Content */}
      <div className="pt-3">{children}</div>
    </div>
  );
}

/**
 * Small client-only nav so we can highlight the active tab
 * without turning the whole layout into a client component.
 */
function AdminNav() {
  "use client";
  const { usePathname } = require("next/navigation");
  const pathname = usePathname() as string;

  const links = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/employees", label: "Employees" },
    { href: "/admin/locations", label: "Locations" },
    { href: "/admin/shifts", label: "Shifts" },
    { href: "/admin/payroll", label: "Payroll" },
  ];

  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm">
      {links.map((link) => {
        const isActive =
          pathname === link.href ||
          (link.href !== "/admin" && pathname.startsWith(link.href));

        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors " +
              (isActive
                ? "bg-black text-white"
                : "text-gray-600 hover:text-black hover:bg-gray-100")
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}