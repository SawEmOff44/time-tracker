// app/worker/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function WorkerIndexPage() {
  const cookieStore = cookies();
  const code = cookieStore.get("worker_session_code")?.value;

  if (!code) {
    // Not logged in
    redirect("/worker/login");
  }

  redirect(`/worker/${encodeURIComponent(code)}`);
}