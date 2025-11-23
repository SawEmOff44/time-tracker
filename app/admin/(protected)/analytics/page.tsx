// app/admin/(protected)/analytics/page.tsx

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          High-level analytics for Rhinehart Co. will live here. For now,
          all core time tracking and admin tools are fully operational.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
        <p className="font-medium text-gray-800 mb-2">
          Analytics dashboard – coming next
        </p>
        <ul className="list-disc ml-5 space-y-1 text-gray-600">
          <li>Weekly hours by day & per-employee totals</li>
          <li>Location utilization over time</li>
          <li>ADHOC shift monitoring & risk flags</li>
          <li>Downloadable CSV summaries for payroll review</li>
        </ul>
      </div>
    </div>
  );
}