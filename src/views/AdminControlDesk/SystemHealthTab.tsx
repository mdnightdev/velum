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

  return (
    <div className="space-y-3 text-text-primary">
      {/* Top Action Bar (Compact) */}
      <div className="flex items-center justify-end">
        <button
          onClick={fetchHealthData}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-velum-800 hover:bg-velum-700 border border-velum-600 text-xs font-medium cursor-pointer transition disabled:opacity-50 text-text-primary"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-accent ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {error && (
        <div className="p-2.5 bg-status-dnd/10 border border-status-dnd/30 rounded-lg text-status-dnd text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Metrics Grid (Embedded Single Row) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {/* Build Version */}
        <div className="bg-velum-750 border border-velum-600 rounded-lg p-3">
          <div className="flex items-center justify-between text-text-secondary mb-1">
            <span className="text-xs font-medium">Version</span>
            <Layers className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="text-base font-bold text-text-primary truncate">
            {diagnostics?.buildVersion || '2.2.0'}
          </div>
          <div className="text-xs text-text-secondary mt-0.5 capitalize">
            {diagnostics?.env || 'production'}
          </div>
        </div>

        {/* Database Health & Latency */}
        <div className="bg-velum-750 border border-velum-600 rounded-lg p-3">
          <div className="flex items-center justify-between text-text-secondary mb-1">
            <span className="text-xs font-medium">Database</span>
            <Database className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${diagnostics?.dbConnection.healthy ? 'bg-status-online' : 'bg-status-dnd'}`} />
            <span className="text-base font-bold text-text-primary">
              {diagnostics?.dbConnection.healthy ? 'Online' : 'Degraded'}
            </span>
          </div>
          <div className="text-xs text-text-secondary mt-0.5">
            Latency: {diagnostics?.dbConnection.latencyMs ?? 0} ms
          </div>
        </div>

        {/* WebSocket Sessions */}
        <div className="bg-velum-750 border border-velum-600 rounded-lg p-3">
          <div className="flex items-center justify-between text-text-secondary mb-1">
            <span className="text-xs font-medium">Connections</span>
            <Wifi className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="text-base font-bold text-text-primary">
            {diagnostics?.websocketState.activeSessionsCount ?? 0}
          </div>
          <div className="text-xs text-text-secondary mt-0.5 flex justify-between">
            <span>Conn: {diagnostics?.websocketState.activeConnections ?? 0}</span>
            <span>Rooms: {diagnostics?.websocketState.activeRoomsCount ?? 0}</span>
          </div>
        </div>

        {/* Server Process Uptime */}
        <div className="bg-velum-750 border border-velum-600 rounded-lg p-3">
          <div className="flex items-center justify-between text-text-secondary mb-1">
            <span className="text-xs font-medium">Uptime</span>
            <Clock className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="text-base font-bold text-text-primary">
            {diagnostics ? formatUptime(diagnostics.uptimeSeconds) : '0m 0s'}
          </div>
          <div className="text-xs text-text-secondary mt-0.5">
            Reconnects: {diagnostics?.websocketState.reconnectCount ?? 0}
          </div>
        </div>
      </div>

      {/* Detail Section: Telemetry + Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
        {/* Telemetry Key-Values */}
        <div className="bg-velum-750 border border-velum-600 rounded-lg p-3.5 lg:col-span-1 space-y-3">
          <div className="flex items-center gap-2 border-b border-velum-600 pb-2">
            <Cpu className="w-4 h-4 text-accent" />
            <h4 className="text-xs font-semibold text-text-primary">Telemetry</h4>
          </div>

          <div className="divide-y divide-velum-600 text-xs">
            <div className="flex justify-between items-center py-2">
              <span className="text-text-secondary">Last Server Event</span>
              <span className="text-text-primary font-medium">
                {diagnostics?.lastServerEventTimestamp 
                  ? new Date(diagnostics.lastServerEventTimestamp).toLocaleTimeString()
                  : 'N/A'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-text-secondary">Pool Status</span>
              <span className="text-status-online font-medium">Active</span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-text-secondary">Auth Role</span>
              <span className="text-accent font-medium">{diagnostics?.authContext?.role || 'User'}</span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-text-secondary">Timestamp</span>
              <span className="text-text-primary font-medium">
                {diagnostics?.timestamp ? new Date(diagnostics.timestamp).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Audit Log Stream */}
        <div className="bg-velum-750 border border-velum-600 rounded-lg p-3.5 lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between border-b border-velum-600 pb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              <h4 className="text-xs font-semibold text-text-primary">
                Audit Logs ({auditLogs.length})
              </h4>
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-xs text-text-secondary">
                No audit events recorded yet.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id || log.logId}
                  className="p-2.5 rounded-lg bg-velum-800 border border-velum-600 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-accent/15 text-accent font-medium text-xs">
                      {log.action}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-text-primary pt-0.5">
                    <span className="text-text-primary">
                      Admin: <span className="text-accent font-medium">{log.adminName}</span>
                    </span>
                    {log.targetId && (
                      <span className="text-xs text-text-secondary">
                        Target: {log.targetId}
                      </span>
                    )}
                  </div>
                  {log.reason && (
                    <p className="text-xs text-text-secondary pt-0.5">
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
