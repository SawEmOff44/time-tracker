// app/admin/(protected)/payroll/page.tsx

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PayrollPageProps = {
  searchParams?: {
    start?: string;
    end?: string;
  };
};

function parseDateOnly(value?: string): Date | undefined {
  if (!value) return undefined;
  // Expecting YYYY-MM-DD from <input type="date">
  const iso = `${value}T00:00:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

export default async function PayrollPage({ searchParams }: PayrollPageProps) {
  const startParam = searchParams?.start || "";
  const endParam = searchParams?.end || "";

  const startDate = parseDateOnly(startParam);
  const endDate = parseDateOnly(endParam);

  // Build Prisma filter
  const where: any = {};
  if (startDate || endDate) {
    where.clockIn = {};
    if (startDate) {
      where.clockIn.gte = startDate;
    }
    if (endDate) {
      // End of day for the end date
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      where.clockIn.lte = endOfDay;
    }
  }

  const shifts = await prisma.shift.findMany({
    where,
    orderBy: { clockIn: "desc" },
    include: {
      user: true,
      location: true,
    },
  });

  const rows = shifts.map((s) => {
    const clockIn = s.clockIn ? new Date(s.clockIn) : null;
    const clockOut = s.clockOut ? new Date(s.clockOut) : null;

    const hours =
      clockIn && clockOut
        ? (clockOut.getTime() - clockIn.getTime()) / 1000 / 60 / 60
        : 0;

    return {
      id: s.id,
      employee: s.user?.name || "Unknown",
      code: s.user?.employeeCode || "",
      date: clockIn ? clockIn.toISOString().slice(0, 10) : "",
      clockIn: clockIn ? clockIn.toLocaleTimeString() : "",
      clockOut: clockOut ? clockOut.toLocaleTimeString() : "",
      hours,
      location: s.location?.name || "Unknown",
    };
  });

  const totalHours = rows.reduce((sum, r) => sum + (r.hours || 0), 0);

  // Build CSV export URL with same filters
  const search = new URLSearchParams();
  if (startParam) search.set("start", startParam);
  if (endParam) search.set("end", endParam);
  const exportHref =
    "/api/export/payroll" + (search.toString() ? `?${search.toString()}` : "");

  return (
    <main className="flex-1 p-6">
      {/* Header + Export */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Payroll &amp; Shifts</h1>
          <p className="text-sm text-gray-600">
            Review recorded shifts and export to CSV for payroll.
          </p>
        </div>

        <a
          href={exportHref}
          className="inline-flex items-center px-4 py-2 rounded bg-black text-white text-sm font-medium hover:bg-gray-800"
        >
          Download CSV
        </a>
      </div>

      {/* Filters */}
      <form
        method="GET"
        className="mb-4 flex flex-col md:flex-row md:items-end gap-3"
      >
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            name="start"
            defaultValue={startParam}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            name="end"
            defaultValue={endParam}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-3 py-2 rounded bg-black text-white text-xs font-semibold hover:bg-gray-800"
          >
            Apply
          </button>
          {(startParam || endParam) && (
            <a
              href="/admin/payroll"
              className="px-3 py-2 rounded border text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50"
            >
              Clear
            </a>
          )}
        </div>
      </form>

      {/* Summary */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="text-sm text-gray-700">
          <span className="font-semibold">Total Shifts:</span> {rows.length}
        </div>
        <div className="text-sm text-gray-700">
          <span className="font-semibold">Total Hours:</span>{" "}
          {totalHours.toFixed(2)}
        </div>
        {startParam || endParam ? (
          <div className="text-xs text-gray-500">
            Filtered by{" "}
            {startParam && (
              <>
                from <span className="font-mono">{startParam}</span>{" "}
              </>
            )}
            {endParam && (
              <>
                to <span className="font-mono">{endParam}</span>
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Employee</th>
              <th className="px-3 py-2 text-left font-semibold">Code</th>
              <th className="px-3 py-2 text-left font-semibold">Date</th>
              <th className="px-3 py-2 text-left font-semibold">Clock In</th>
              <th className="px-3 py-2 text-left font-semibold">Clock Out</th>
              <th className="px-3 py-2 text-right font-semibold">Hours</th>
              <th className="px-3 py-2 text-left font-semibold">Location</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-gray-500"
                >
                  No shifts found for this period.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b last:border-b-0 hover:bg-gray-50"
                >
                  <td className="px-3 py-2">{r.employee}</td>
                  <td className="px-3 py-2">{r.code}</td>
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2">{r.clockIn}</td>
                  <td className="px-3 py-2">{r.clockOut}</td>
                  <td className="px-3 py-2 text-right">
                    {r.hours ? r.hours.toFixed(2) : "-"}
                  </td>
                  <td className="px-3 py-2">{r.location}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}