// app/admin/(protected)/layout.tsx

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/employees", label: "Employees" },
  { href: "/admin/locations", label: "Locations" },
  { href: "/admin/shifts", label: "Shifts" },
  { href: "/admin/payroll", label: "Payroll" },
];

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-[#f5f4f3] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1f1f20] text-gray-100 flex flex-col">
        {/* Logo / Brand */}
        <div className="h-20 flex items-center justify-center border-b border-white/10 px-4">
          <div className="flex items-center gap-2">
            <div className="relative h-10 w-32">
              <Image
                src="/rhinehart-logo.jpeg"
                alt="Rhinehart Co. Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="
                block px-4 py-2 text-sm font-medium
                text-gray-200 hover:text-white hover:bg-white/10
                transition-colors
              "
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Footer / Small text */}
        <div className="p-4 text-[11px] text-gray-500 border-t border-white/10">
          <div>Rhinehart Time</div>
          <div className="text-gray-400">
            © {new Date().getFullYear()} Rhinehart Co.
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* You can add a top bar here later if you want */}
        {children}
      </div>
    </div>
  );
}