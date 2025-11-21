// app/admin/(protected)/layout.tsx
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // In Next 16, cookies() is async – must be awaited
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header + Nav */}
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Admin</h1>
            <p className="text-xs text-gray-600">
              Time tracking, locations, employees, and payroll.
            </p>
          </div>
          <a
            href="/api/admin/logout"
            className="text-xs font-medium text-red-600 hover:underline"
          >
            Logout
          </a>
        </div>

        {/* Admin Nav */}
        <nav className="w-full border-t">
          <div className="max-w-5xl mx-auto flex items-center gap-6 px-4 py-3 text-sm font-medium">
            <a
              href="/admin"
              className="text-gray-700 hover:text-black hover:underline"
            >
              Dashboard
            </a>

            <a
              href="/admin/shifts"
              className="text-gray-700 hover:text-black hover:underline"
            >
              Shifts
            </a>

            <a
              href="/admin/employees"
              className="text-gray-700 hover:text-black hover:underline"
            >
              Employees
            </a>

            <a
              href="/admin/locations"
              className="text-gray-700 hover:text-black hover:underline"
            >
              Locations
            </a>

            <a
              href="/admin/payroll"
              className="text-gray-700 hover:text-black hover:underline"
            >
              Payroll
            </a>
          </div>
        </nav>
      </header>

      {/* Page Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}