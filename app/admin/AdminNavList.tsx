"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/employees", label: "Employees" },
  { href: "/admin/locations", label: "Locations" },
  { href: "/admin/shifts", label: "Shifts" },
  { href: "/admin/payroll", label: "Payroll" },
  { href: "/admin/exceptions", label: "Exceptions" },
  { href: "/admin/flagged-shifts", label: "Flagged Shifts" },
];

export default function AdminNavList() {
  const pathname = usePathname();

  return (
    <ul className="space-y-1">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/admin" && pathname?.startsWith(item.href));

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={[
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-100",
              ].join(" ")}
            >
              <span>{item.label}</span>
              {isActive && (
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}