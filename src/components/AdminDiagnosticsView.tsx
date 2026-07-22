import React, { useState, useEffect } from 'react';
import { BookOpen, Activity, Monitor, CheckCircle2, AlertTriangle, Cpu, Terminal, RefreshCw } from 'lucide-react';
import { SuspiciousEvent, AuditLog, ClientDiagnosticLog } from '../types';
import { APP_VERSION, FULL_BUILD_VERSION } from '../version';

interface AdminDiagnosticsViewProps {
  suspicious: SuspiciousEvent[];
  logs: AuditLog[];
  initialDiagLogs?: ClientDiagnosticLog[];
  adminFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  c: {
    bgPanel: string;
    border: string;
    textMuted: string;
  };
}

export default function AdminDiagnosticsView({
  suspicious,
  logs,
  initialDiagLogs = [],
  adminFetch,
  c
}: AdminDiagnosticsViewProps) {
  const [diagLogs, setDiagLogs] = useState<ClientDiagnosticLog[]>(initialDiagLogs);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ClientDiagnosticLog | null>(null);

  useEffect(() => {
    if (initialDiagLogs && initialDiagLogs.length > 0) {
      setDiagLogs(initialDiagLogs);
      if (!selectedLog) {
        setSelectedLog(initialDiagLogs[0]);
      }
    }
  }, [initialDiagLogs]);

  const fetchDiagLogs = async () => {
    setIsLoading(true);
    try {
      let res: Response;
      if (adminFetch) {
        res = await adminFetch('/api/admin/diagnostics/logs');
      } else {
        const token = sessionStorage.getItem('velum-sessionId') || localStorage.getItem('velum_token') || '';
        res = await fetch('/api/admin/diagnostics/logs', {
          headers: { 
            Authorization: `Bearer ${token}`,
            'x-session-id': token
          }
        });
      }

      if (res.ok) {
        const data = await res.json();
        setDiagLogs(data || []);
        if (data && data.length > 0 && !selectedLog) {
          setSelectedLog(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch client diagnostic logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagLogs();
  }, []);

  const handleResolve = async (logId: string) => {
    try {
      let res: Response;
      if (adminFetch) {
        res = await adminFetch(`/api/admin/diagnostics/logs/${logId}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'resolved' })
        });
      } else {
        const token = sessionStorage.getItem('velum-sessionId') || localStorage.getItem('velum_token') || '';
        res = await fetch(`/api/admin/diagnostics/logs/${logId}/resolve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'x-session-id': token
          },
          body: JSON.stringify({ status: 'resolved' })
        });
      }

      if (res.ok) {
        setDiagLogs(prev => prev.map(l => l.id === logId ? { ...l, status: 'resolved' } : l));
        if (selectedLog?.id === logId) {
          setSelectedLog(prev => prev ? { ...prev, status: 'resolved' } : null);
        }
      }
    } catch (err) {
      console.error('Failed to resolve log:', err);
    }
  };

  return (
    <div className={`p-6 rounded-2xl border ${c.bgPanel} shadow-xl animate-fadeIn space-y-6`}>
      <div className="flex items-center justify-between border-b border-white-5 pb-4">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-accent" />
          <div>
            <h4 className="font-extrabold text-sm uppercase tracking-wider">Signals Audit Surveillance & Client Diagnostics</h4>
          </div>
        </div>
        <button
          onClick={fetchDiagLogs}
          disabled={isLoading}
          className="px-3 py-1.5 bg-velum-750 hover:bg-velum-700 text-xs font-mono font-bold text-accent border border-accent/20 rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Bundles</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left side box: anomalous activity catalog */}
        <div className="p-5 rounded-xl border bg-velum-850/60 border-white-5">
          <div className="text-[10px] font-mono font-black text-status-dnd uppercase mb-3 border-b border-white-5 pb-2 tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-dnd animate-pulse" />
            <span>Anomalous Events Diagnosed ({suspicious.length})</span>
          </div>
          <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
            {suspicious.map((ev, idx) => {
              const risk = ev.risk_level || ev.severity || 'INTERMEDIATE';
              const text = ev.description || (ev as any).details || (ev as any).reason || (ev as any).event_type || 'Anomalous Activity';
              return (
                <div key={ev.event_id || idx} className="pb-3 border-b border-white-5 last:border-0 last:pb-0 font-sans">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] uppercase px-2 py-0.5 rounded font-mono font-bold border ${
                      risk === 'critical' || risk === 'HIGH' 
                        ? 'text-status-dnd bg-status-dnd/10 border-rose-500/20' 
                        : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                    }`}>
                      {risk}
                    </span>
                    <span className="text-text-primary text-xs font-medium leading-relaxed">{text}</span>
                  </div>
                  {ev.ip_address && (
                    <span className="text-text-disabled font-mono text-[9px] block mt-1">IP: {ev.ip_address}</span>
                  )}
                  <span className="text-text-disabled font-mono text-[9px] block text-right mt-1 font-bold">
                    {ev.created_at ? new Date(ev.created_at).toLocaleString() : (ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '')}
                  </span>
                </div>
              );
            })}
            {suspicious.length === 0 && (
              <div className="text-text-disabled text-center py-16 font-mono text-[10.5px] font-black uppercase tracking-wider">// Zero threats inside current matrices //</div>
            )}
          </div>
        </div>

        {/* Right side box: administrative actions */}
        <div className="p-5 rounded-xl border bg-velum-850/60 border-white-5">
          <div className="text-[10px] font-mono font-black text-accent-hover uppercase mb-3 border-b border-white-5 pb-2 tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-hover" />
            <span>Oversight Audit Commits ({logs.length})</span>
          </div>
          <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
            {logs.map((log, idx) => (
              <div key={log.log_id || idx} className="pb-3 border-b border-white-5 last:border-0 last:pb-0 font-sans">
                <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
                  <span className="text-status-online bg-status-online/10 border border-emerald-500/15 px-2 py-0.5 rounded text-[8px] font-black uppercase">{log.admin_name || `Admin #${log.admin_id}`}</span>
                  <span className="text-text-secondary text-[8px] font-black">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}</span>
                </div>
                <p className="text-text-primary leading-relaxed font-mono text-[10.5px] mt-1.5">
                  <span className="text-text-primary font-extrabold uppercase text-[10px] bg-white-5 border border-white-5 px-1.5 py-0.5 rounded-md mr-1">{log.action}</span>
                  {log.target_id ? `target user #${log.target_id} • ` : ''} {log.reason || log.details || ''}
                </p>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-text-disabled text-center py-16 font-mono text-[10.5px] font-black uppercase tracking-wider">// Zero administrative changes parsed //</div>
            )}
          </div>
        </div>
      </div>

      {/* Full-width Section: User Client Diagnostic Bundles */}
      <div className="p-5 rounded-xl border bg-velum-850/60 border-white-10 space-y-4">
        <div className="flex items-center justify-between border-b border-white-5 pb-3">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-accent" />
            <span className="text-xs font-mono font-bold text-text-primary uppercase tracking-wider">Client Diagnostic Telemetry Submissions ({diagLogs.length})</span>
          </div>
          <span className="text-[10px] font-mono text-text-disabled uppercase">Cloud DB Link Active</span>
        </div>

        {diagLogs.length === 0 ? (
          <div className="text-text-disabled text-center py-10 font-mono text-xs uppercase tracking-wider">
            // No client diagnostic bundles submitted yet //
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {diagLogs.map((diag) => (
                <div
                  key={diag.id}
                  onClick={() => setSelectedLog(diag)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition select-none ${
                    selectedLog?.id === diag.id
                      ? 'bg-velum-750 border-accent/60 text-text-primary shadow-lg'
                      : 'bg-velum-800/80 border-white-5 text-text-secondary hover:bg-velum-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-accent">{diag.username || `User #${diag.user_id}`}</span>
                      <span className="px-1.5 py-0.2 bg-white-5 border border-white-10 rounded text-[9px] text-text-secondary">
                        {diag.app_version || FULL_BUILD_VERSION}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${
                      diag.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {diag.status}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-text-secondary flex items-center justify-between mt-2">
                    <span>IP: {diag.ip_address}</span>
                    <span>{new Date(diag.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                  {diag.notes && (
                    <div className="mt-2 text-[10px] text-text-primary italic font-sans bg-black/20 p-2 rounded border border-white-5 truncate">
                      "{diag.notes}"
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Detailed Inspector Panel */}
            <div className="p-4 rounded-xl bg-velum-900 border border-white-10 font-mono text-xs space-y-3 overflow-y-auto max-h-[360px]">
              {selectedLog ? (
                <>
                  <div className="flex items-center justify-between border-b border-white-5 pb-2">
                    <div>
                      <span className="text-accent font-bold uppercase text-[11px] block">{selectedLog.id}</span>
                      <span className="text-[10px] text-text-secondary">{new Date(selectedLog.created_at).toLocaleString()}</span>
                    </div>
                    {selectedLog.status !== 'resolved' && (
                      <button
                        onClick={() => handleResolve(selectedLog.id)}
                        className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer transition"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Resolve
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-text-primary font-bold">App Version / Build:</span>
                      <span className="px-2 py-0.5 bg-accent/10 border border-accent/30 text-accent rounded font-bold">
                        {selectedLog.app_version || FULL_BUILD_VERSION}
                      </span>
                    </div>
                    <div className="text-text-secondary"><span className="text-text-primary font-bold">User Identity:</span> {selectedLog.username} (ID: {selectedLog.user_id})</div>
                    <div className="text-text-secondary"><span className="text-text-primary font-bold">IP Address:</span> {selectedLog.ip_address}</div>
                    <div className="text-text-secondary"><span className="text-text-primary font-bold">Screen Display:</span> {selectedLog.screen_resolution} (DPR: {selectedLog.device_pixel_ratio}x)</div>
                    <div className="text-text-secondary"><span className="text-text-primary font-bold">Viewport Matrix:</span> {selectedLog.viewport_size}</div>
                    <div className="text-text-secondary"><span className="text-text-primary font-bold">Network State:</span> {selectedLog.online_status ? 'Online' : 'Offline'} ({selectedLog.connection_type})</div>
                    <div className="text-text-secondary"><span className="text-text-primary font-bold">Local Storage:</span> {selectedLog.storage_summary?.localStorage_keys_count} keys (~{selectedLog.storage_summary?.localStorage_approx_size_kb} KB)</div>
                    <div className="text-text-secondary break-all"><span className="text-text-primary font-bold">User Agent:</span> {selectedLog.user_agent}</div>
                  </div>

                  {selectedLog.notes && (
                    <div className="pt-2 border-t border-white-5">
                      <span className="text-[10px] font-bold uppercase text-accent block mb-1">User Incident Notes</span>
                      <p className="text-text-primary font-sans text-xs bg-black/40 p-2.5 rounded border border-white-5 leading-relaxed">
                        {selectedLog.notes}
                      </p>
                    </div>
                  )}

                  {selectedLog.error_buffer && selectedLog.error_buffer.length > 0 && (
                    <div className="pt-2 border-t border-white-5">
                      <span className="text-[10px] font-bold uppercase text-rose-400 block mb-1">Recent Client Error Buffer ({selectedLog.error_buffer.length})</span>
                      <div className="space-y-1 bg-black/40 p-2 rounded text-[10px] max-h-[120px] overflow-y-auto">
                        {selectedLog.error_buffer.map((err, idx) => (
                          <div key={idx} className="text-rose-300 font-mono">
                            [{err.timestamp.split('T')[1]?.slice(0, 8) || err.timestamp}] {err.message} {err.source ? `(${err.source}:${err.lineno})` : ''}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-text-disabled text-center py-20 uppercase tracking-wider text-[11px]">
                  // Select a client diagnostic log to view raw payload //
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
