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
  const reportsList = reports.filter((r) => {
    if (reportFilter === 'complaints' && r.type !== 'user_misconduct') return false;
    if (reportFilter === 'bugs' && r.type !== 'bug_report') return false;
    if (reportFilter === 'suggestions' && r.type !== 'suggestion') return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white-5 pb-5 mb-6">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-status-away" />
          <div>
            <h3 className="font-extrabold text-sm uppercase tracking-wider">Reports &amp; Disputes</h3>
          </div>
        </div>

        {/* Custom categorizer */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReportFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase border transition cursor-pointer ${
              reportFilter === 'all'
                ? 'bg-accent-20 text-text-primary border-accent-40'
                : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            All Reports
          </button>
          <button
            onClick={() => setReportFilter('complaints')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase border transition cursor-pointer ${
              reportFilter === 'complaints'
                ? 'bg-status-dnd/20 text-status-dnd border-rose-500/30'
                : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            User Disputes
          </button>
          <button
            onClick={() => setReportFilter('bugs')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase border transition cursor-pointer ${
              reportFilter === 'bugs'
                ? 'bg-amber-500/20 text-status-away border-amber-500/30'
                : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            System Bugs
          </button>
          <button
            onClick={() => setReportFilter('suggestions')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase border transition cursor-pointer ${
              reportFilter === 'suggestions'
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            Suggestions
          </button>
        </div>
      </div>

      {/* Redesigned highly structured table display */}
      <div className="overflow-x-auto rounded-xl border border-white-5 bg-white/[0.01]">
        <table className="w-full text-xs font-sans text-left border-collapse">
          <thead>
            <tr className="text-text-secondary text-[9px] font-black uppercase tracking-widest border-b border-white-5">
              <th className="py-4 pl-4">CASE ID</th>
              <th className="py-4">REPORT TYPE</th>
              <th className="py-4">SUBMITTER</th>
              <th className="py-4 max-w-sm">STATEMENT / COMPLAINT LOGS</th>
              <th className="py-4">DATE SUBMITTED</th>
              <th className="py-4 text-right pr-4">OPERATIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {reportsList.map((rep) => (
              <tr
                key={rep.report_id}
                className={`transition duration-150 ${
                  rep.priority === 'HIGH'
                    ? 'bg-rose-500/10 hover:bg-rose-500/15 border-l-2 border-rose-500'
                    : 'hover:bg-text-primary-2'
                }`}
              >
                <td className="py-4 pl-4 font-mono text-accent font-black">#{rep.report_id}</td>
                <td className="py-4">
                  <span className="font-bold text-text-primary uppercase text-[9.5px] px-2 py-0.5 rounded bg-text-primary-5 border border-white-10 font-mono">
                    {(rep.type || '').replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-4 text-text-primary font-bold">{rep.reporter_name || 'Anonymous'}</td>
                <td className="py-4 text-text-secondary font-medium max-w-sm truncate leading-snug">
                  <span className="italic">"{rep.reason || 'Empty report details.'}"</span>
                </td>
                <td className="py-4 font-mono text-text-secondary text-[10px]">
                  {new Date(rep.created_at).toLocaleString()}
                </td>
                <td className="py-4 text-right pr-4">
                  <div className="flex items-center justify-end gap-2">
                    {rep.status !== 'closed' ? (
                      <button
                        onClick={async () => {
                          try {
                            const res = await adminFetch(`/api/admin/reports/${rep.report_id}/status`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'closed' }),
                            });
                            if (res.ok) {
                              alert(`Report marked as resolved/closed.`);
                              fetchData();
                            }
                          } catch {
                            alert('Operation failed.');
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-accent-20 bg-accent-10 hover:bg-accent text-accent hover:text-text-primary text-[10px] font-bold font-mono uppercase transition cursor-pointer"
                      >
                        Resolve Case
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-400 font-mono uppercase mr-2">
                        Resolved
                      </span>
                    )}
                    {(adminRole === 'LOGIN_ADMIN' || user?.role === 'CLI_ADMIN') && (
                      <button
                        onClick={async () => {
                          if (
                            confirm(
                              `ALERT: Are you absolutely sure you want to permanently delete report case #${rep.report_id}?`
                            )
                          ) {
                            try {
                              const res = await adminFetch(`/api/admin/reports/${rep.report_id}/delete`, {
                                method: 'POST',
                              });
                              if (res.ok) {
                                alert(`Case #${rep.report_id} successfully deleted.`);
                                fetchData();
                              } else {
                                alert('Failed to delete report.');
                              }
                            } catch {
                              alert('Server unreachable.');
                            }
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-red-500/20 bg-status-dnd/10 hover:bg-red-500 hover:text-text-primary text-red-400 text-[10px] font-bold font-mono uppercase transition cursor-pointer"
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
          <div className="text-center py-20 text-text-disabled font-mono text-xs uppercase">
            // Zero reporting catalogs filed in databases //
          </div>
        )}
      </div>
    </div>
  );
}
