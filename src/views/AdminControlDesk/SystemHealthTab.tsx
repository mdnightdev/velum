import React, { useState, useEffect } from 'react';
import { Activity, Server, Cpu, Database, Wifi, ShieldCheck, Clock, RefreshCw, FileText, AlertTriangle, Layers } from 'lucide-react';
import { getSessionId } from '../../utils/auth';

interface SystemHealthTabProps {
  adminFetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

interface DiagnosticsData {
  buildVersion: string;
  env: string;
  uptimeSeconds: number;
  timestamp: string;
  websocketState: {
    activeConnections: number;
    activeSessionsCount: number;
    activeRoomsCount: number;
    reconnectCount: number;
  };
  dbConnection: {
    healthy: boolean;
    latencyMs: number;
    poolActive: boolean;
  };
  lastServerEventTimestamp: string;
  authContext?: {
    userId: number | null;
    role: string;
  };
}

interface AuditLogEntry {
  id: number;
  logId: string;
  adminId: number;
  adminName: string;
  action: string;
  targetId: string | null;
  reason: string;
  timestamp: string;
}

export default function SystemHealthTab({ adminFetch }: SystemHealthTabProps) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthData = async () => {
    setIsRefreshing(true);
    try {
      let diagRes: Response;
      let logsRes: Response;

      if (adminFetch) {
        diagRes = await adminFetch('/v2/diagnostics');
        logsRes = await adminFetch('/v2/admin/audit-logs?limit=30');
      } else {
        const token = getSessionId();
        const headers = {
          Authorization: `Bearer ${token}`,
          'x-session-id': token
        };
        diagRes = await fetch('/v2/diagnostics', { headers });
        logsRes = await fetch('/v2/admin/audit-logs?limit=30', { headers });
      }

      if (diagRes.ok) {
        const diagData = await diagRes.json();
        setDiagnostics(diagData);
      } else {
        setError('Failed to fetch platform diagnostics.');
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setAuditLogs(Array.isArray(logsData.logs) ? logsData.logs : []);
      }
    } catch (err) {
      setError('Connection error while fetching system health metrics.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    return `${minutes}m ${secs}s`;
  };

  const panelClass = 'bg-velum-800 border border-velum-600 rounded-xl p-4';
  const borderClass = 'border-velum-600';

  return (
    <div className="space-y-6 animate-fadeIn text-text-primary">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white-10">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" />
            <h3 className="text-base font-bold uppercase tracking-wider font-mono">
              System Observability & Health Diagnostics
            </h3>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Real-time platform metrics, WebSocket session states, database latency, and live audit event stream.
          </p>
        </div>

        <button
          onClick={fetchHealthData}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white-5 hover:bg-white-10 border border-white-10 text-xs font-semibold cursor-pointer transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-accent ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh Diagnostics'}</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-status-dnd-bg/20 border border-status-dnd/40 rounded-xl text-status-dnd text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Build Version */}
        <div className={panelClass}>
          <div className="flex items-center justify-between text-text-secondary mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Build Version</span>
            <Layers className="w-4 h-4 text-accent" />
          </div>
          <div className="text-lg font-mono font-bold text-text-primary truncate">
            {diagnostics?.buildVersion || '2.2.0-v2-prod'}
          </div>
          <div className="text-[10px] text-text-secondary mt-1 font-mono">
            Env: {diagnostics?.env || 'production'}
          </div>
        </div>

        {/* Database Health & Latency */}
        <div className={panelClass}>
          <div className="flex items-center justify-between text-text-secondary mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Database Status</span>
            <Database className="w-4 h-4 text-accent" />
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${diagnostics?.dbConnection.healthy ? 'bg-status-online shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-status-dnd'}`} />
            <span className="text-lg font-mono font-bold">
              {diagnostics?.dbConnection.healthy ? 'ONLINE' : 'DEGRADED'}
            </span>
          </div>
          <div className="text-[10px] text-text-secondary mt-1 font-mono">
            Query Latency: {diagnostics?.dbConnection.latencyMs ?? 0} ms
          </div>
        </div>

        {/* WebSocket Sessions */}
        <div className={panelClass}>
          <div className="flex items-center justify-between text-text-secondary mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Active WS Sessions</span>
            <Wifi className="w-4 h-4 text-accent" />
          </div>
          <div className="text-lg font-mono font-bold text-text-primary">
            {diagnostics?.websocketState.activeSessionsCount ?? 0}
          </div>
          <div className="text-[10px] text-text-secondary mt-1 font-mono flex justify-between">
            <span>Conn: {diagnostics?.websocketState.activeConnections ?? 0}</span>
            <span>Rooms: {diagnostics?.websocketState.activeRoomsCount ?? 0}</span>
          </div>
        </div>

        {/* Server Process Uptime */}
        <div className={panelClass}>
          <div className="flex items-center justify-between text-text-secondary mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Process Uptime</span>
            <Clock className="w-4 h-4 text-accent" />
          </div>
          <div className="text-lg font-mono font-bold text-text-primary">
            {diagnostics ? formatUptime(diagnostics.uptimeSeconds) : '0m 0s'}
          </div>
          <div className="text-[10px] text-text-secondary mt-1 font-mono">
            Reconnects: {diagnostics?.websocketState.reconnectCount ?? 0}
          </div>
        </div>
      </div>

      {/* Secondary Metrics / Diagnostics Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Telemetry Card */}
        <div className={`${panelClass} lg:col-span-1 space-y-4`}>
          <div className="flex items-center gap-2 border-b border-white-5 pb-3">
            <Cpu className="w-4 h-4 text-accent" />
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono">System Telemetry</h4>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-white-[0.02] border border-white-5">
              <span className="text-text-secondary">Last Server Event</span>
              <span className="text-text-primary font-bold">
                {diagnostics?.lastServerEventTimestamp 
                  ? new Date(diagnostics.lastServerEventTimestamp).toLocaleTimeString()
                  : 'N/A'}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-white-[0.02] border border-white-5">
              <span className="text-text-secondary">Pool Connection</span>
              <span className="text-status-online font-bold">ACTIVE</span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-white-[0.02] border border-white-5">
              <span className="text-text-secondary">Diagnostics Auth Role</span>
              <span className="text-accent font-bold">{diagnostics?.authContext?.role || 'ANONYMOUS'}</span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-white-[0.02] border border-white-5">
              <span className="text-text-secondary">Timestamp</span>
              <span className="text-text-primary font-bold">
                {diagnostics?.timestamp ? new Date(diagnostics.timestamp).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Audit Log Stream */}
        <div className={`${panelClass} lg:col-span-2 space-y-4`}>
          <div className="flex items-center justify-between border-b border-white-5 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              <h4 className="text-xs font-bold uppercase tracking-wider font-mono">
                Live Audit Event Stream ({auditLogs.length})
              </h4>
            </div>
            <span className="text-[10px] text-text-secondary font-mono">Structured Audit Logs</span>
          </div>

          <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-xs text-text-secondary font-mono">
                No audit events recorded yet.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id || log.logId}
                  className="p-3 rounded-xl bg-white-[0.02] hover:bg-white-[0.04] border border-white-5 transition space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="px-2 py-0.5 rounded bg-accent-10 text-accent font-bold text-[10px] uppercase tracking-wide">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-text-secondary">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-text-primary font-sans pt-1">
                    <span className="font-semibold text-text-primary">
                      Admin: <span className="text-accent">{log.adminName}</span> (ID: {log.adminId})
                    </span>
                    {log.targetId && (
                      <span className="text-[10px] font-mono text-text-secondary">
                        Target: {log.targetId}
                      </span>
                    )}
                  </div>
                  {log.reason && (
                    <p className="text-[11px] text-text-secondary font-mono pt-0.5">
                      Reason: {log.reason}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
