import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Works with Next 14+ (await is safe even if cookies() is sync)
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top bar with logo + nav */}
      <header className="bg-white border-b shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo + title */}
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-3">
              <Image
                src="/rhinehart-logo.jpeg"
                alt="Rhinehart Co. Logo"
                width={150}
                height={50}
                className="object-contain"
                priority
              />
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-gray-800">
                  Rhinehart Co. Time
                </div>
                <div className="text-xs text-gray-500">Admin Panel</div>
              </div>
            </Link>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
            <Link
              href="/admin"
              className="text-gray-700 hover:text-black transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/employees"
              className="text-gray-700 hover:text-black transition-colors"
            >
              Employees
            </Link>
            <Link
              href="/admin/locations"
              className="text-gray-700 hover:text-black transition-colors"
            >
              Locations
            </Link>
            <Link
              href="/admin/shifts"
              className="text-gray-700 hover:text-black transition-colors"
            >
              Shifts
            </Link>
            <Link
              href="/admin/payroll"
              className="text-gray-700 hover:text-black transition-colors"
            >
              Payroll
            </Link>

            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                className="text-xs font-semibold text-red-600 hover:text-red-700 uppercase tracking-wide"
              >
                Logout
              </button>
            </form>
          </nav>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden border-t bg-white px-4 pb-3 flex gap-3 text-xs font-medium overflow-x-auto">
          <Link href="/admin" className="py-1 text-gray-700 hover:text-black">
            Dashboard
          </Link>
          <Link
            href="/admin/employees"
            className="py-1 text-gray-700 hover:text-black"
          >
            Employees
          </Link>
          <Link
            href="/admin/locations"
            className="py-1 text-gray-700 hover:text-black"
          >
            Locations
          </Link>
          <Link
            href="/admin/shifts"
            className="py-1 text-gray-700 hover:text-black"
          >
            Shifts
          </Link>
          <Link
            href="/admin/payroll"
            className="py-1 text-gray-700 hover:text-black"
          >
            Payroll
          </Link>
          <form action="/api/admin/logout" method="POST">
            <button
              type="submit"
              className="py-1 text-red-600 hover:text-red-700"
            >
              Logout
            </button>
          </form>
        </nav>
      </header>

      {/* Page content */}
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}