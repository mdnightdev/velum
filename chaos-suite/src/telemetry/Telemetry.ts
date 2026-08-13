export interface MetricEntry {
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

export interface WsStats {
  activeConnections: number;
  totalConnects: number;
  totalDisconnects: number;
  totalErrors: number;
  messagesSent: number;
  messagesReceived: number;
  reconnectAttempts: number;
}

export class Telemetry {
  private static instance: Telemetry;
  private metrics: MetricEntry[] = [];
  private wsStats: WsStats = {
    activeConnections: 0,
    totalConnects: 0,
    totalDisconnects: 0,
    totalErrors: 0,
    messagesSent: 0,
    messagesReceived: 0,
    reconnectAttempts: 0
  };
  private startTime = Date.now();

  private constructor() {}

  public static getInstance(): Telemetry {
    if (!Telemetry.instance) {
      Telemetry.instance = new Telemetry();
    }
    return Telemetry.instance;
  }

  public recordHttp(entry: MetricEntry): void {
    this.metrics.push(entry);
    // Keep max 10,000 metrics in buffer to avoid memory leak
    if (this.metrics.length > 10000) {
      this.metrics.shift();
    }
  }

  public wsConnected(): void {
    this.wsStats.activeConnections++;
    this.wsStats.totalConnects++;
  }

  public wsDisconnected(): void {
    this.wsStats.activeConnections = Math.max(0, this.wsStats.activeConnections - 1);
    this.wsStats.totalDisconnects++;
  }

  public wsError(): void {
    this.wsStats.totalErrors++;
  }

  public wsMessageSent(): void {
    this.wsStats.messagesSent++;
  }

  public wsMessageReceived(): void {
    this.wsStats.messagesReceived++;
  }

  public wsReconnect(): void {
    this.wsStats.reconnectAttempts++;
  }

  public getWsStats(): WsStats {
    return { ...this.wsStats };
  }

  public getSummary(): {
    durationSec: number;
    totalRequests: number;
    successRate: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    reqPerSec: number;
    errorBreakdown: Record<string, number>;
    wsStats: WsStats;
  } {
    const elapsedSec = Math.max(1, (Date.now() - this.startTime) / 1000);
    const totalRequests = this.metrics.length;
    if (totalRequests === 0) {
      return {
        durationSec: elapsedSec,
        totalRequests: 0,
        successRate: 100,
        p50Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
        reqPerSec: 0,
        errorBreakdown: {},
        wsStats: { ...this.wsStats }
      };
    }

    const successful = this.metrics.filter(m => m.success).length;
    const successRate = (successful / totalRequests) * 100;
    const durations = this.metrics.map(m => m.durationMs).sort((a, b) => a - b);

    const p50Ms = durations[Math.floor(durations.length * 0.5)] || 0;
    const p95Ms = durations[Math.floor(durations.length * 0.95)] || 0;
    const p99Ms = durations[Math.floor(durations.length * 0.99)] || 0;

    const errorBreakdown: Record<string, number> = {};
    for (const m of this.metrics) {
      if (!m.success) {
        const key = `${m.method} ${m.endpoint} -> ${m.statusCode || 'ERR'}`;
        errorBreakdown[key] = (errorBreakdown[key] || 0) + 1;
      }
    }

    return {
      durationSec: Math.round(elapsedSec),
      totalRequests,
      successRate: Math.round(successRate * 10) / 10,
      p50Ms: Math.round(p50Ms),
      p95Ms: Math.round(p95Ms),
      p99Ms: Math.round(p99Ms),
      reqPerSec: Math.round((totalRequests / elapsedSec) * 10) / 10,
      errorBreakdown,
      wsStats: { ...this.wsStats }
    };
  }

  public printDashboard(activeAgents: number): void {
    const summary = this.getSummary();
    console.log(`\n================== CHAOS SUITE TELEMETRY ==================`);
    console.log(` Active Agents : ${activeAgents} | Test Uptime: ${summary.durationSec}s`);
    console.log(` HTTP Throughput: ${summary.reqPerSec} req/sec | Total Requests: ${summary.totalRequests}`);
    console.log(` Success Rate   : ${summary.successRate}%`);
    console.log(` Latency        : p50 = ${summary.p50Ms}ms | p95 = ${summary.p95Ms}ms | p99 = ${summary.p99Ms}ms`);
    console.log(` WS Connections : Active = ${summary.wsStats.activeConnections} | Connected = ${summary.wsStats.totalConnects} | Errors = ${summary.wsStats.totalErrors}`);
    console.log(` WS Throughput  : Sent = ${summary.wsStats.messagesSent} | Received = ${summary.wsStats.messagesReceived} | Reconnects = ${summary.wsStats.reconnectAttempts}`);
    if (Object.keys(summary.errorBreakdown).length > 0) {
      console.log(` Top Errors     :`, JSON.stringify(summary.errorBreakdown));
    }
    console.log(`===========================================================\n`);
  }
}
