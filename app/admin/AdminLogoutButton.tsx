// app/admin/AdminLogoutButton.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

function AdminLogoutButtonInner() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleLogout = () => {
    startTransition(async () => {
      try {
        await fetch("/api/admin/logout", {
          method: "POST",
        });
      } catch (err) {
        console.error("Error logging out:", err);
      } finally {
        router.push("/admin/login");
        router.refresh();
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
    >
      {isPending ? "Logging out…" : "Logout"}
    </button>
  );
}

export default AdminLogoutButtonInner;
export const AdminLogoutButton = AdminLogoutButtonInner;