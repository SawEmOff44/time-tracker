"use client";

export default function AdminLogoutButton() {
  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <button
      onClick={handleLogout}
      className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 transition"
    >
      Logout
    </button>
  );
}