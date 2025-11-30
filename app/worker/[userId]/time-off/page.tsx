'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface TimeOffRequest {
  id: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

interface UserData {
  name: string;
  ptoBalance: number;
}

export default function WorkerTimeOffPage() {
  const params = useParams();
  const userId = params.userId as string;
  
  const [user, setUser] = useState<UserData | null>(null);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('PTO');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch user PTO balance
      const userRes = await fetch(`/api/worker/${userId}`, { credentials: 'include' });
      if (!userRes.ok) throw new Error('Failed to load user data');
      const userData = await userRes.json();
      setUser(userData);

      // Fetch time-off requests
      const reqRes = await fetch(`/api/worker/${userId}/time-off`, { credentials: 'include' });
      if (!reqRes.ok) throw new Error('Failed to load requests');
      const reqData = await reqRes.json();
      setRequests(reqData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }

    const daysRequested = calculateDays();

    if (type === 'PTO' && user && daysRequested > user.ptoBalance) {
      setError(`Insufficient PTO balance. You have ${user.ptoBalance} days available.`);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/worker/${userId}/time-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type,
          startDate,
          endDate,
          daysRequested,
          reason: reason || null
        })
      });

      if (!res.ok) throw new Error('Failed to submit request');

      setSuccess('Time-off request submitted successfully!');
      setShowForm(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Time Off</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded"
        >
          {showForm ? 'Cancel' : 'Request Time Off'}
        </button>
      </div>

      {/* PTO Balance */}
      {user && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-gray-400 mb-1">PTO Balance</div>
          <div className="text-3xl font-bold text-amber-500">
            {user.ptoBalance.toFixed(1)} days
          </div>
        </div>
      )}

      {/* Request Form */}
      {showForm && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold mb-4">New Time-Off Request</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 rounded bg-white/5 border border-white/10"
              >
                <option value="PTO">PTO</option>
                <option value="SICK">Sick Leave</option>
                <option value="VACATION">Vacation</option>
                <option value="UNPAID">Unpaid Leave</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10"
                />
              </div>
            </div>

            {startDate && endDate && (
              <div className="text-sm text-gray-400">
                Requesting {calculateDays()} day{calculateDays() !== 1 ? 's' : ''}
              </div>
            )}

            <div>
              <label className="block text-sm mb-1">Reason (optional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded bg-white/5 border border-white/10"
                placeholder="Add any additional details..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !startDate || !endDate}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4">
          <p className="text-sm text-green-200">{success}</p>
        </div>
      )}

      {/* Requests List */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold mb-4">Your Requests</h2>
        
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No time-off requests yet
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div key={request.id} className="p-3 rounded bg-white/5 border border-white/10">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{request.type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                      {' • '}
                      {request.daysRequested} day{request.daysRequested !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {request.reason && (
                  <div className="text-sm text-gray-300 mb-2">
                    <span className="text-gray-500">Reason:</span> {request.reason}
                  </div>
                )}

                {request.reviewNotes && (
                  <div className="text-sm text-amber-300 mb-2">
                    <span className="text-amber-500">Admin Note:</span> {request.reviewNotes}
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
    </div>
  );
}
