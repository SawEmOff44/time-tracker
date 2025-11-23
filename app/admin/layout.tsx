// app/admin/layout.tsx
"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/employees", label: "Employees" },
  { href: "/admin/locations", label: "Locations" },
  { href: "/admin/shifts", label: "Shifts" },
  { href: "/admin/payroll", label: "Payroll" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3 gap-4">
          {/* Logo + title */}
          <div className="flex items-center gap-3">
            <Link href="/clock" className="flex items-center gap-2">
              <Image
                src="/rhinehart-logo.jpeg"
                alt="Rhinehart Co. Logo"
                width={140}
                height={40}
                className="object-contain"
                priority
              />
            </Link>
            <div>
              <div className="text-sm font-semibold tracking-tight">
                Rhinehart Time
              </div>
              <div className="text-[11px] text-slate-500">
                Admin control panel
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-2 text-xs sm:text-sm">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-2 py-1 rounded-md border transition-colors ${
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-200"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}