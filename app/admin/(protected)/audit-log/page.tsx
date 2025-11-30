'use client';
import { useEffect, useState } from 'react';
import adminFetch from '@/app/admin/_utils/adminFetch';

interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    loadLogs();
  }, [page, entityFilter, actionFilter, startDate, endDate]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityFilter) params.set('entity', entityFilter);
      if (actionFilter) params.set('action', actionFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('limit', pageSize.toString());
      params.set('offset', (page * pageSize).toString());

      const data = await adminFetch(`/api/admin/audit-log?${params.toString()}`);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (entityFilter) params.set('entity', entityFilter);
      if (actionFilter) params.set('action', actionFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const response = await fetch(`/api/admin/audit-log/export?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Failed to export logs');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Failed to export logs');
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'text-green-400';
      case 'UPDATE': return 'text-blue-400';
      case 'DELETE': return 'text-red-400';
      case 'APPROVE': return 'text-emerald-400';
      case 'REJECT': return 'text-orange-400';
      case 'EXPORT': return 'text-purple-400';
      case 'LOGIN': return 'text-gray-400';
      case 'LOGOUT': return 'text-gray-400';
      default: return 'text-slate-400';
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-sm text-gray-400 mt-1">
            Complete history of administrative actions and system events
          </p>
        </div>
        <button
          onClick={exportLogs}
          disabled={loading || logs.length === 0}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded text-sm disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm mb-1">Entity Type</label>
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-2 rounded bg-white/5 border border-white/10"
            >
              <option value="">All Entities</option>
              <option value="shift">Shifts</option>
              <option value="employee">Employees</option>
              <option value="location">Locations</option>
              <option value="payroll">Payroll</option>
              <option value="time-off">Time Off</option>
              <option value="correction">Corrections</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-2 rounded bg-white/5 border border-white/10"
            >
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="APPROVE">Approve</option>
              <option value="REJECT">Reject</option>
              <option value="EXPORT">Export</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-2 rounded bg-white/5 border border-white/10"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-2 rounded bg-white/5 border border-white/10"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
          <div>
            Showing {logs.length} of {total} entries
          </div>
          <button
            onClick={() => {
              setEntityFilter('');
              setActionFilter('');
              setStartDate('');
              setEndDate('');
              setPage(0);
            }}
            className="text-amber-400 hover:text-amber-300"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {/* Audit Log Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No audit logs found</div>
      ) : (
        <>
          <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Timestamp</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Entity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Details</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">{log.userName}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`font-medium ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {log.entity}
                        {log.entityId && (
                          <span className="text-xs text-gray-500 ml-1">#{log.entityId.slice(0, 8)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate">
                        {log.details ? JSON.parse(log.details).description || JSON.stringify(JSON.parse(log.details)) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {log.ipAddress || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-sm border border-white/10 rounded hover:bg-white/5 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-sm border border-white/10 rounded hover:bg-white/5 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
