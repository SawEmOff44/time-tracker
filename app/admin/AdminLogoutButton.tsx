"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // even if the request fails, still push them back to the login screen
    } finally {
      setLoading(false);
      router.push("/admin");
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="inline-flex items-center rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-100 shadow-sm hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900"
    >
      {loading ? "Signing out…" : "Logout"}
    </button>
  );
}