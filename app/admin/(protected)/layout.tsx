// app/admin/(protected)/layout.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;

  if (!session) {
    redirect("/admin/login");
  }

  return <>{children}</>;
}