import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="space-y-4">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/rhinehart-logo.jpeg"
              alt="Rhinehart Co. logo"
              width={150}
              height={40}
              className="h-8 w-auto object-contain"
            />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">
                Rhinehart Time
              </div>
              <div className="text-xs text-gray-500">
                Admin control panel
              </div>
            </div>
          </div>
          <nav className="flex gap-2 text-xs md:text-sm">
            {[
              { href: "/admin", label: "Dashboard" },
              { href: "/admin/employees", label: "Employees" },
              { href: "/admin/locations", label: "Locations" },
              { href: "/admin/shifts", label: "Shifts" },
              { href: "/admin/payroll", label: "Payroll" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-3 py-1.5 text-gray-700 hover:bg-gray-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-8">{children}</div>
    </div>
  );
}