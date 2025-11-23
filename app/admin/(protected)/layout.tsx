// app/admin/(protected)/layout.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Guard: only allow access if admin_session cookie is present
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;

  if (!session) {
    redirect("/admin/login");
  }

  // IMPORTANT: no extra header/nav/markup here
  // The visual layout (sidebar, etc.) is handled by app/admin/layout.tsx
  return <>{children}</>;
}