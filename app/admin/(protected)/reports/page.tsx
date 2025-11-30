'use client';
import { useEffect, useState } from 'react';
import adminFetch from '@/app/admin/_utils/adminFetch';

interface ReportData {
  laborCost: {
    total: number;
    byEmployee: Array<{
      employeeName: string;
      hours: number;
      cost: number;
    }>;
    byLocation: Array<{
      locationName: string;
      hours: number;
      cost: number;
    }>;
  };
  overtime: {
    totalOvertimeHours: number;
    totalOvertimeCost: number;
    byEmployee: Array<{
      employeeName: string;
      overtimeHours: number;
      overtimeCost: number;
    }>;
  };
  locationProfitability: Array<{
    locationName: string;
    totalHours: number;
    totalCost: number;
    shiftCount: number;
  }>;
}

export default function ReportsPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  }, []);

  const loadReport = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const data = await adminFetch(`/api/admin/reports?startDate=${startDate}&endDate=${endDate}`);
      setReportData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    if (!startDate || !endDate) return;
    
    try {
      const response = await fetch(`/api/admin/reports/pdf?startDate=${startDate}&endDate=${endDate}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${startDate}-to-${endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Failed to export PDF');
    }
  };

  const setDatePreset = (preset: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (preset) {
      case 'thisWeek':
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(now.setDate(diff));
        end = new Date();
        break;
      case 'lastWeek':
        const lastWeekStart = new Date(now);
        lastWeekStart.setDate(now.getDate() - now.getDay() - 6);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
        start = lastWeekStart;
        end = lastWeekEnd;
        break;
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date();
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisQuarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date();
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date();
        break;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Advanced Reports</h1>
        {reportData && (
          <button
            onClick={exportPDF}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
          >
            Export PDF
          </button>
        )}
      </div>

      {/* Date Selection */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold mb-4">Date Range</h2>
        
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setDatePreset('thisWeek')} className="px-3 py-1 text-sm border rounded hover:bg-white/5">
            This Week
          </button>
          <button onClick={() => setDatePreset('lastWeek')} className="px-3 py-1 text-sm border rounded hover:bg-white/5">
            Last Week
          </button>
          <button onClick={() => setDatePreset('thisMonth')} className="px-3 py-1 text-sm border rounded hover:bg-white/5">
            This Month
          </button>
          <button onClick={() => setDatePreset('lastMonth')} className="px-3 py-1 text-sm border rounded hover:bg-white/5">
            Last Month
          </button>
          <button onClick={() => setDatePreset('thisQuarter')} className="px-3 py-1 text-sm border rounded hover:bg-white/5">
            This Quarter
          </button>
          <button onClick={() => setDatePreset('thisYear')} className="px-3 py-1 text-sm border rounded hover:bg-white/5">
            This Year
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded bg-white/5 border border-white/10"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded bg-white/5 border border-white/10"
            />
          </div>
        </div>

        <button
          onClick={loadReport}
          disabled={loading || !startDate || !endDate}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Generate Report'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {reportData && (
        <>
          {/* Labor Cost Summary */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-semibold mb-4">Labor Cost Analysis</h2>
            
            <div className="mb-6">
              <div className="text-3xl font-bold text-amber-500">
                ${reportData.laborCost.total.toFixed(2)}
              </div>
              <div className="text-sm text-gray-400">Total Labor Cost</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold mb-3 text-gray-400">By Employee</h3>
                <div className="space-y-2">
                  {reportData.laborCost.byEmployee.map((emp) => (
                    <div key={emp.employeeName} className="flex items-center justify-between p-2 rounded bg-white/5">
                      <div>
                        <div className="font-medium">{emp.employeeName}</div>
                        <div className="text-xs text-gray-400">{emp.hours.toFixed(2)} hours</div>
                      </div>
                      <div className="font-semibold">${emp.cost.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3 text-gray-400">By Location</h3>
                <div className="space-y-2">
                  {reportData.laborCost.byLocation.map((loc) => (
                    <div key={loc.locationName} className="flex items-center justify-between p-2 rounded bg-white/5">
                      <div>
                        <div className="font-medium">{loc.locationName}</div>
                        <div className="text-xs text-gray-400">{loc.hours.toFixed(2)} hours</div>
                      </div>
                      <div className="font-semibold">${loc.cost.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Overtime Analysis */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-semibold mb-4">Overtime Analysis</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded bg-white/5">
                <div className="text-2xl font-bold text-orange-500">
                  {reportData.overtime.totalOvertimeHours.toFixed(2)}
                </div>
                <div className="text-sm text-gray-400">Total OT Hours</div>
              </div>
              <div className="p-4 rounded bg-white/5">
                <div className="text-2xl font-bold text-orange-500">
                  ${reportData.overtime.totalOvertimeCost.toFixed(2)}
                </div>
                <div className="text-sm text-gray-400">Total OT Cost</div>
              </div>
            </div>

            <h3 className="text-sm font-semibold mb-3 text-gray-400">By Employee</h3>
            <div className="space-y-2">
              {reportData.overtime.byEmployee.map((emp) => (
                <div key={emp.employeeName} className="flex items-center justify-between p-2 rounded bg-white/5">
                  <div>
                    <div className="font-medium">{emp.employeeName}</div>
                    <div className="text-xs text-gray-400">{emp.overtimeHours.toFixed(2)} OT hours</div>
                  </div>
                  <div className="font-semibold">${emp.overtimeCost.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Location Profitability */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-semibold mb-4">Location Performance</h2>
            
            <div className="space-y-2">
              {reportData.locationProfitability.map((loc) => (
                <div key={loc.locationName} className="p-3 rounded bg-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">{loc.locationName}</div>
                    <div className="text-lg font-bold">${loc.totalCost.toFixed(2)}</div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>{loc.totalHours.toFixed(2)} hours</span>
                    <span>{loc.shiftCount} shifts</span>
                    <span>${(loc.totalCost / loc.totalHours).toFixed(2)}/hr avg</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
