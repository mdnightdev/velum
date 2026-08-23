import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Report } from '../../types';

interface AdminReportsProps {
  reports: Report[];
  reportFilter: 'all' | 'complaints' | 'bugs' | 'suggestions';
  setReportFilter: (filter: 'all' | 'complaints' | 'bugs' | 'suggestions') => void;
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN';
  user?: any;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  fetchData: () => void;
}

export default function AdminReports({
  reports,
  reportFilter,
  setReportFilter,
  adminRole,
  user,
  adminFetch,
  fetchData,
}: AdminReportsProps) {
  // Filter reports list dynamically
  const safeReports = Array.isArray(reports) ? reports : [];
  const reportsList = safeReports.filter((r) => {
    if (reportFilter === 'complaints' && r.type !== 'user_misconduct') return false;
    if (reportFilter === 'bugs' && r.type !== 'bug_report') return false;
    if (reportFilter === 'suggestions' && r.type !== 'suggestion') return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-velum-600 pb-3">
        
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setReportFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              reportFilter === 'all'
                ? 'bg-accent/15 text-accent border border-accent/30'
                : 'bg-velum-800 text-text-secondary border border-velum-600 hover:bg-velum-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setReportFilter('complaints')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              reportFilter === 'complaints'
                ? 'bg-status-dnd/15 text-status-dnd border border-status-dnd/30'
                : 'bg-velum-800 text-text-secondary border border-velum-600 hover:bg-velum-700'
            }`}
          >
            Disputes
          </button>
          <button
            onClick={() => setReportFilter('bugs')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              reportFilter === 'bugs'
                ? 'bg-status-away/15 text-status-away border border-status-away/30'
                : 'bg-velum-800 text-text-secondary border border-velum-600 hover:bg-velum-700'
            }`}
          >
            Bugs
          </button>
          <button
            onClick={() => setReportFilter('suggestions')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              reportFilter === 'suggestions'
                ? 'bg-accent/15 text-accent border border-accent/30'
                : 'bg-velum-800 text-text-secondary border border-velum-600 hover:bg-velum-700'
            }`}
          >
            Suggestions
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-velum-600 bg-velum-800">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="text-text-secondary text-xs border-b border-velum-600">
              <th className="py-2.5 pl-3 font-medium"> ID</th>
              <th className="py-2.5 font-medium">Type</th>
              <th className="py-2.5 font-medium">User</th>
              <th className="py-2.5 max-w-sm font-medium">Description</th>
              <th className="py-2.5 font-medium">Date</th>
              <th className="py-2.5 text-right pr-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-velum-700">
            {reportsList.map((rep) => (
              <tr
                key={rep.report_id}
                className={`transition ${
                  rep.priority === 'HIGH'
                    ? 'bg-status-dnd/10 border-l-2 border-status-dnd'
                    : 'hover:bg-velum-750'
                }`}
              >
                <td className="py-2.5 pl-3 font-mono text-accent">#{rep.report_id}</td>
                <td className="py-2.5">
                  <span className="text-xs px-2 py-0.5 rounded bg-velum-750 border border-velum-600 text-text-primary capitalize">
                    {(rep.type || '').replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-2.5 text-text-primary font-medium">{rep.reporter_name || 'Anonymous'}</td>
                <td className="py-2.5 text-text-secondary max-w-sm truncate">
                  {rep.reason || 'No description provided.'}
                </td>
                <td className="py-2.5 text-text-secondary text-xs">
                  {new Date(rep.created_at).toLocaleDateString()}
                </td>
                <td className="py-2.5 text-right pr-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {rep.status !== 'closed' ? (
                      <button
                        onClick={async () => {
                          try {
                            const res = await adminFetch(`/v2/admin/reports/${rep.report_id}/status`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'closed' }),
                            });
                            if (res.ok) {
                              fetchData();
                            }
                          } catch (_) {}
                        }}
                        className="px-2 py-1 rounded bg-accent/15 hover:bg-accent/25 text-accent text-xs font-medium transition cursor-pointer"
                      >
                        Resolve
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-status-online mr-1">
                        Resolved
                      </span>
                    )}
                    {(adminRole === 'LOGIN_ADMIN' || user?.role === 'CLI_ADMIN') && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await adminFetch(`/v2/admin/reports/${rep.report_id}/delete`, {
                              method: 'POST',
                            });
                            if (res.ok) {
                              fetchData();
                            }
                          } catch (_) {}
                        }}
                        className="px-2 py-1 rounded bg-status-dnd/15 hover:bg-status-dnd/25 text-status-dnd text-xs font-medium transition cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reportsList.length === 0 && (
          <div className="text-center py-12 text-text-secondary text-xs">
           </div>
        )}
      </div>
    </div>
  );
}
