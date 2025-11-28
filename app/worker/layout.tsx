// app/worker/layout.tsx
import { cookies } from "next/headers";
import WorkerTopbar from "./WorkerTopbar";

export default function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const name = cookieStore.get("worker_session_name")?.value ?? null;
  const code = cookieStore.get("worker_session_code")?.value ?? null;

  return (
    <div className="space-y-4">
      <WorkerTopbar name={name} code={code} />
      {children}
    </div>
  );
}