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
      aria-current={isActive ? "page" : undefined}
      className={`sidebar-link flex items-center rounded-xl px-3 py-2.5 text-sm font-medium leading-tight transition-colors
        ${
          isActive
            ? "sidebar-link-active bg-amber-400 text-slate-950 shadow-sm"
            : "text-slate-200 hover:bg-slate-800/70 hover:text-white"
        }`}
    >
      <span>{label}</span>
    </Link>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-900">
      {/* SIDEBAR */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-800 bg-slate-950">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-9 w-28">
              <Image
                src="/rhinehart-logo.jpeg"
                alt="Rhinehart Co. Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold text-slate-100 tracking-wide">
                RHINEHART TIME
              </span>
              <span className="text-[11px] text-slate-400">
                Admin control panel
              </span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
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

        <div className="px-5 py-4 border-t border-slate-800 text-[11px] text-slate-500">
          <div className="font-medium text-slate-300">Rhinehart Co.</div>
          <div className="mt-0.5">Time tracking &amp; payroll audit</div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {/* TOP BAR for mobile */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-sm md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative h-8 w-24">
              <Image
                src="/rhinehart-logo.jpeg"
                alt="Rhinehart Co. Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Admin panel
            </span>
          </Link>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}