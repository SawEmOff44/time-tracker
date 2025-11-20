import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // cookies() is async in Next 16 – must await
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;

  if (!session) {
    redirect("/admin/login");
  }

  return <>{children}</>;
}
