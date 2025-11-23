import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import AdminNavList from "../AdminNavList";

export default function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Simple auth check – same behavior as before
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* SIDEBAR */}
          <aside className="w-64 shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-32">
                  <Image
                    src="/rhinehart-logo.jpeg"
                    alt="Rhinehart Co. logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-sm font-semibold text-slate-900">
                  Rhinehart Time
                </p>
                <p className="text-xs text-slate-500">
                  Admin control panel
                </p>
              </div>
            </div>

            <nav className="flex-1 p-3">
              <AdminNavList />
            </nav>

            <div className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
              v0.1 · Internal use only
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <main className="flex-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}