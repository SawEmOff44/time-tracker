import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      documents: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    return <div className="text-sm text-red-300">Employee not found.</div>;
  }

  return (
    <div className="space-y-8">
      <Link
        href="/admin/employees"
        className="text-xs text-slate-400 hover:text-slate-200"
      >
        ← Back to employees
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-slate-50">
          {user.name}{" "}
          <span className="text-sm text-slate-400">
            ({user.employeeCode ?? "No code"})
          </span>
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Created {user.createdAt.toLocaleDateString("en-US")}
        </p>
      </div>

      {/* Contact snapshot */}
      <section className="card">
        <h2 className="text-sm font-semibold text-slate-100 mb-3">
          Contact info
        </h2>
        <dl className="grid gap-2 text-xs text-slate-200 sm:grid-cols-2">
          <div>
            <dt className="text-slate-400">Email</dt>
            <dd>{user.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Phone</dt>
            <dd>{user.phone ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-400">Address</dt>
            <dd>
              {[user.addressLine1, user.addressLine2]
                .filter(Boolean)
                .join(" ")}
              <br />
              {[user.city, user.state, user.postalCode]
                .filter(Boolean)
                .join(", ")}
            </dd>
          </div>
        </dl>
      </section>

      {/* Admin-only notes – use a server action to save adminNotes */}
      {/* ... */}

      {/* Documents table with visibility toggle */}
      {/* ... */}
    </div>
  );
}