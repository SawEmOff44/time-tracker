'use client';
import { useEffect, useState } from 'react';
import adminFetch from '@/app/admin/_utils/adminFetch';

interface TimeOffRequest {
  id: string;
  user: {
    name: string;
  };
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string | null;
  createdAt: string;
}

export default function TimeOffPage() {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const url = filter === 'all' 
        ? '/api/admin/time-off' 
        : `/api/admin/time-off?status=${filter}`;
      const data = await adminFetch(url);
      setRequests(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load time-off requests');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (requestId: string, status: 'APPROVED' | 'REJECTED', notes: string = '') => {
    try {
      await adminFetch(`/api/admin/time-off/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reviewNotes: notes })
      });
      
      loadRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to update request');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      case 'APPROVED': return 'bg-green-500/20 text-green-300 border-green-500/40';
      case 'REJECTED': return 'bg-red-500/20 text-red-300 border-red-500/40';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PTO': return 'text-blue-400';
      case 'SICK': return 'text-red-400';
      case 'VACATION': return 'text-green-400';
      case 'UNPAID': return 'text-gray-400';
      default: return 'text-purple-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Time-Off Requests</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm rounded border ${
            filter === 'all' ? 'bg-amber-600 border-amber-600' : 'border-white/10 hover:bg-white/5'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('PENDING')}
          className={`px-3 py-1.5 text-sm rounded border ${
            filter === 'PENDING' ? 'bg-amber-600 border-amber-600' : 'border-white/10 hover:bg-white/5'
          }`}
        >
          Pending
        </button>
        <button
          onClick={() => setFilter('APPROVED')}
          className={`px-3 py-1.5 text-sm rounded border ${
            filter === 'APPROVED' ? 'bg-amber-600 border-amber-600' : 'border-white/10 hover:bg-white/5'
          }`}
        >
          Approved
        </button>
        <button
          onClick={() => setFilter('REJECTED')}
          className={`px-3 py-1.5 text-sm rounded border ${
            filter === 'REJECTED' ? 'bg-amber-600 border-amber-600' : 'border-white/10 hover:bg-white/5'
          }`}
        >
          Rejected
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No time-off requests found
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div key={request.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{request.user.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400">
                    <span className={`font-medium ${getTypeColor(request.type)}`}>{request.type}</span>
                    {' • '}
                    {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                    {' • '}
                    {request.daysRequested} day{request.daysRequested !== 1 ? 's' : ''}
                  </div>
                </div>
                
                {request.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReview(request.id, 'APPROVED')}
                      className="px-3 py-1.5 text-sm rounded bg-green-600 hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        const notes = prompt('Rejection reason (optional):');
                        if (notes !== null) handleReview(request.id, 'REJECTED', notes);
                      }}
                      className="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>

              {request.reason && (
                <div className="text-sm text-gray-300 mb-2">
                  <span className="text-gray-500">Reason:</span> {request.reason}
                </div>
              )}

              <div className="text-xs text-gray-500">
                Requested {new Date(request.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
