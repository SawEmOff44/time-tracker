// app/admin/layout.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AdminLayoutProps = {
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/employees", label: "Employees" },
  { href: "/admin/shifts", label: "Shifts" },
  { href: "/admin/locations", label: "Locations" },
  { href: "/admin/payroll", label: "Payroll" },
  { href: "/admin/analytics", label: "Analytics" },
];

function AdminNavLink({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? // ACTIVE: dark pill with white text
            "bg-slate-900 text-white shadow-sm"
          : // INACTIVE: medium slate text, subtle hover
            "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <span>{label}</span>
    </Link>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* SIDEBAR */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-200 bg-slate-950">
        {/* Brand area */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-8 w-24">
              <Image
                src="/rhinehart-logo.jpeg"
                alt="Rhinehart Co. Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                Admin
              </span>
              <span className="text-[11px] text-slate-400">
                Time tracking panel
              </span>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <AdminNavLink
                key={item.href}
                href={item.href}
                label={item.label}
                isActive={isActive}
              />
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-slate-800 text-[11px] text-slate-500">
          Rhinehart Co. · Time Tracking
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-sm md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative h-7 w-20">
              <Image
                src="/rhinehart-logo.jpeg"
                alt="Rhinehart Co. Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </Link>
          <span className="text-xs font-medium text-slate-600">
            Admin Panel
          </span>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}