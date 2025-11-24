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
  { href: "/admin/exceptions", label: "Exceptions" },
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
      className={`sidebar-link block rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-amber-400 text-slate-950 shadow-sm sidebar-link-active"
          : "hover:bg-slate-800/80 hover:text-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* SIDEBAR */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-800 bg-slate-950/95 backdrop-blur">
        {/* Logo / brand */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-8 w-28">
              <Image
                src="/rhinehart-logo.jpeg"
                alt="Rhinehart Co. Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </Link>
        </div>

        {/* Nav items */}
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

        {/* Footer / logout */}
        <div className="px-4 py-4 border-t border-slate-800 text-xs text-slate-400 space-y-2">
          <div>Rhinehart Co. Time Tracking</div>
          <form action="/admin/logout" method="post">
            <button
              type="submit"
              className="w-full rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold px-3 py-1.5 transition border border-slate-700"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col">
        {/* Top bar for mobile */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative h-7 w-24">
              <Image
                src="/rhinehart-logo.jpeg"
                alt="Rhinehart Co. Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </Link>
          <span className="text-xs font-medium text-slate-300">
            Admin Panel
          </span>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}