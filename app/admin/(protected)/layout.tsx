// app/admin/layout.tsx
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Top nav is provided by the root `app/layout.tsx`. Keep this file
  // focused on providing the admin content wrapper to avoid duplicating
  // the primary navigation.
  return (
    <main className="mx-auto max-w-[1600px] px-6 py-6">{children}</main>
  );
}