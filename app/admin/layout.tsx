// app/admin/layout.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useTransition } from "react";

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
      className={`sidebar-link flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? "bg-amber-400 text-slate-900 shadow-md"
          : "hover:bg-slate-800/80"
      }`}
    >
      <span>{label}</span>
      {isActive && (
        <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
      )}
    </Link>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      try {
        await fetch("/admin/logout", { method: "POST" });
      } catch (err) {
        console.error("Logout failed:", err);
      } finally {
        router.push("/admin/login");
        router.refresh();
      }
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50">
      {/* SIDEBAR */}
      <aside className="hidden w-64 flex-col border-r border-slate-800 bg-slate-950/95 pt-4 md:flex">
        <div className="flex items-center gap-3 px-5 pb-4">
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
          </Link>
        </div>

        <div className="px-5 pb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-400">
          Admin
          <span className="ml-2 text-slate-400">Time tracking control panel</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 pt-2">
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

        <div className="border-t border-slate-800 px-4 py-4 text-xs text-slate-500">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            className="flex w-full items-center justify-center rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-slate-700 disabled:opacity-60"
          >
            {isPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="flex flex-1 flex-col">
        {/* TOP BAR for mobile / small screens */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur md:hidden">
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
            <span className="text-xs font-medium text-slate-400">
              Admin panel
            </span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-60"
          >
            {isPending ? "…" : "Sign out"}
          </button>
        </header>

        {/* CONTENT */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {/* key change: allow more width for tables (Recent shifts, etc.) */}
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}