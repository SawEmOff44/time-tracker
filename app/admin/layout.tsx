// app/admin/layout.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const adminNav = [
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
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <Image
                  src="/rhinehart-logo.jpeg"
                  alt="Rhinehart Co. Logo"
                  width={150}
                  height={36}
                  className="h-9 w-auto object-contain"
                />
                <span className="hidden text-sm text-gray-500 sm:inline">
                  Admin Portal
                </span>
              </div>
            </Link>
          </div>

          <nav className="flex flex-wrap gap-2 text-sm">
            {adminNav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "rounded px-3 py-1 " +
                    (active
                      ? "bg-black text-white"
                      : "text-gray-700 hover:bg-gray-100")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}