import React from 'react';
import { BookOpen } from 'lucide-react';
import { SuspiciousEvent, AuditLog } from '../types';

interface AdminDiagnosticsViewProps {
  suspicious: SuspiciousEvent[];
  logs: AuditLog[];
  c: {
    bgPanel: string;
    border: string;
    textMuted: string;
  };
}

export default function AdminDiagnosticsView({
  suspicious,
  logs,
  c
}: AdminDiagnosticsViewProps) {
  return (
    <div className={`p-6 rounded-2xl border ${c.bgPanel} shadow-xl animate-fadeIn`}>
      <div className="flex items-center justify-between border-b border-white-5 pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-accent" />
          <div>
            <h4 className="font-extrabold text-sm uppercase tracking-wider">Signals Audit Surveillance</h4>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left side box: anomalous activity catalog */}
        <div className="p-5 rounded-xl border bg-text-primary-2 border-white-5">
          <div className="text-[10px] font-mono font-black text-status-dnd uppercase mb-3 border-b border-white-5 pb-2 tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-dnd animate-pulse" />
            <span>Anomalous Events Diagnosed</span>
          </div>
          <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
            {suspicious.map(ev => (
              <div key={ev.event_id} className="pb-3 border-b border-white-5 last:border-0 last:pb-0 font-sans">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded font-mono font-black border ${ev.risk_level === 'critical' ? 'text-status-dnd bg-status-dnd/10 border-rose-500/15' : 'text-status-away bg-status-away/10 border-yellow-500/15'}`}>
                    {ev.risk_level}
                  </span>
                  <span className="text-text-primary mt-0.5 text-xs font-semibold leading-relaxed">{ev.description}</span>
                </div>
                <span className="text-text-disabled font-mono text-[9px] block text-right mt-1 font-bold">{ev.created_at}</span>
              </div>
            ))}
            {suspicious.length === 0 && (
              <div className="text-text-disabled text-center py-20 font-mono text-[10.5px] font-black uppercase tracking-wider">// Zero threats inside current matrices //</div>
            )}
          </div>
        </div>

        {/* Right side box: administrative actions */}
        <div className="p-5 rounded-xl border bg-text-primary-2 border-white-5">
          <div className="text-[10px] font-mono font-black text-accent-hover uppercase mb-3 border-b border-white-5 pb-2 tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-hover" />
            <span>Oversight Audit Commits</span>
          </div>
          <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
            {logs.map(log => (
              <div key={log.log_id} className="pb-3 border-b border-white-5 last:border-0 last:pb-0 font-sans">
                <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
                  <span className="text-status-online bg-status-online/10 border border-emerald-500/15 px-2 py-0.5 rounded text-[8px] font-black uppercase">{log.admin_name}</span>
                  <span className="text-text-secondary text-[8px] font-black">{log.timestamp}</span>
                </div>
                <p className="text-text-primary leading-relaxed font-mono text-[10.5px] mt-1.5">
                  <span className="text-text-primary font-extrabold uppercase text-[10px] bg-text-primary-5 border border-white-5 px-1.5 py-0.5 rounded-md mr-1">{log.action}</span>
                  target user #{log.target_id} &bull; {log.reason}
                </p>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-text-disabled text-center py-20 font-mono text-[10.5px] font-black uppercase tracking-wider">// Zero administrative changes parsed //</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
