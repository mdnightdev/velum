import fs from 'fs';
import path from 'path';

export interface AgentMetrics {
  agentId: string;
  username: string;
  persona: string;
  startTime: Date;
  endTime?: Date;
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  actionsByType: Record<string, number>;
  errors: Array<{
    timestamp: Date;
    action: string;
    error: string;
    endpoint?: string;
    statusCode?: number;
  }>;
  uptime: number; // milliseconds
  downtime: number; // milliseconds
  lastActionTime?: Date;
  sessionTokens: string[];
  createdLounges: string[];
  joinedLounges: string[];
  messagesSent: number;
  ticketsCreated: number;
  usersBlocked: number;
  usersMuted: number;
  usersReported: number;
}

class ChaosLogger {
  private metrics: Map<string, AgentMetrics> = new Map();
  private logFile: string;
  private metricsFile: string;
  private errorFile: string;

  constructor() {
    const logDir = path.join(process.cwd(), 'chaos-logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(logDir, `chaos-${timestamp}.log`);
    this.metricsFile = path.join(logDir, `metrics-${timestamp}.json`);
    this.errorFile = path.join(logDir, `errors-${timestamp}.log`);
  }

  initializeAgent(agentId: string, username: string, persona: string): void {
    this.metrics.set(agentId, {
      agentId,
      username,
      persona,
      startTime: new Date(),
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      actionsByType: {},
      errors: [],
      uptime: 0,
      downtime: 0,
      sessionTokens: [],
      createdLounges: [],
      joinedLounges: [],
      messagesSent: 0,
      ticketsCreated: 0,
      usersBlocked: 0,
      usersMuted: 0,
      usersReported: 0
    });

    this.log('INFO', agentId, `Agent initialized as ${username} with persona ${persona}`);
  }

  log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', agentId: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] [${agentId}] ${message}`;
    
    if (data) {
      const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
      fs.appendFileSync(this.logFile, `${logEntry} | Data: ${dataStr}\n`);
    } else {
      fs.appendFileSync(this.logFile, `${logEntry}\n`);
    }

    // Also print to console for real-time monitoring
    console.log(logEntry);
  }

  recordAction(agentId: string, actionType: string, success: boolean, details?: any): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    metrics.totalActions++;
    if (success) {
      metrics.successfulActions++;
    } else {
      metrics.failedActions++;
    }

    metrics.actionsByType[actionType] = (metrics.actionsByType[actionType] || 0) + 1;
    metrics.lastActionTime = new Date();

    // Update specific counters
    switch (actionType) {
      case 'sendMessage':
        metrics.messagesSent++;
        break;
      case 'createTicket':
        metrics.ticketsCreated++;
        break;
      case 'blockUser':
        metrics.usersBlocked++;
        break;
      case 'muteUser':
        metrics.usersMuted++;
        break;
      case 'reportUser':
        metrics.usersReported++;
        break;
    }

    this.log(success ? 'DEBUG' : 'WARN', agentId, 
      `Action: ${actionType} - ${success ? 'SUCCESS' : 'FAILED'}`, 
      details
    );
  }

  recordError(agentId: string, action: string, error: string, endpoint?: string, statusCode?: number): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    const errorEntry = {
      timestamp: new Date(),
      action,
      error,
      endpoint,
      statusCode
    };

    metrics.errors.push(errorEntry);

    const errorLog = `[${new Date().toISOString()}] [${agentId}] ${action} | ${error} | ${endpoint || 'N/A'} | ${statusCode || 'N/A'}`;
    fs.appendFileSync(this.errorFile, `${errorLog}\n`);

    this.log('ERROR', agentId, `${action} failed: ${error}`, { endpoint, statusCode });
  }

  recordSessionToken(agentId: string, token: string): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    metrics.sessionTokens.push(token);
    this.log('DEBUG', agentId, 'New session token obtained');
  }

  recordLoungeCreation(agentId: string, loungeId: string): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    metrics.createdLounges.push(loungeId);
    this.log('INFO', agentId, `Created lounge: ${loungeId}`);
  }

  recordLoungeJoin(agentId: string, loungeId: string): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    metrics.joinedLounges.push(loungeId);
    this.log('INFO', agentId, `Joined lounge: ${loungeId}`);
  }

  recordUptime(agentId: string, milliseconds: number): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    metrics.uptime += milliseconds;
  }

  recordDowntime(agentId: string, milliseconds: number): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    metrics.downtime += milliseconds;
  }

  finalizeAgent(agentId: string): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    metrics.endTime = new Date();
    this.log('INFO', agentId, 'Agent finalized', {
      totalActions: metrics.totalActions,
      successRate: `${((metrics.successfulActions / metrics.totalActions) * 100).toFixed(2)}%`,
      uptime: `${metrics.uptime}ms`,
      downtime: `${metrics.downtime}ms`
    });
  }

  getMetrics(agentId: string): AgentMetrics | undefined {
    return this.metrics.get(agentId);
  }

  getAllMetrics(): AgentMetrics[] {
    return Array.from(this.metrics.values());
  }

  generateSummaryReport(): string {
    const allMetrics = this.getAllMetrics();
    if (allMetrics.length === 0) return 'No metrics available';

    const totalActions = allMetrics.reduce((sum, m) => sum + m.totalActions, 0);
    const totalSuccessful = allMetrics.reduce((sum, m) => sum + m.successfulActions, 0);
    const totalFailed = allMetrics.reduce((sum, m) => sum + m.failedActions, 0);
    const totalUptime = allMetrics.reduce((sum, m) => sum + m.uptime, 0);
    const totalDowntime = allMetrics.reduce((sum, m) => sum + m.downtime, 0);

    const report = `
=== CHAOS TEST SUMMARY REPORT ===
Generated: ${new Date().toISOString()}

=== OVERALL STATISTICS ===
Total Agents: ${allMetrics.length}
Total Actions: ${totalActions}
Successful Actions: ${totalSuccessful} (${((totalSuccessful / totalActions) * 100).toFixed(2)}%)
Failed Actions: ${totalFailed} (${((totalFailed / totalActions) * 100).toFixed(2)}%)
Total Uptime: ${totalUptime}ms (${(totalUptime / 1000).toFixed(2)}s)
Total Downtime: ${totalDowntime}ms (${(totalDowntime / 1000).toFixed(2)}s)

=== AGENT BREAKDOWN ===
${allMetrics.map(m => `
Agent: ${m.username} (${m.persona})
  Actions: ${m.totalActions} | Success: ${m.successfulActions} | Failed: ${m.failedActions}
  Success Rate: ${((m.successfulActions / m.totalActions) * 100).toFixed(2)}%
  Uptime: ${m.uptime}ms | Downtime: ${m.downtime}ms
  Messages: ${m.messagesSent} | Tickets: ${m.ticketsCreated}
  Blocked: ${m.usersBlocked} | Muted: ${m.usersMuted} | Reported: ${m.usersReported}
  Lounges Created: ${m.createdLounges.length} | Joined: ${m.joinedLounges.length}
  Errors: ${m.errors.length}
`).join('\n')}

=== ERROR ANALYSIS ===
Total Errors: ${allMetrics.reduce((sum, m) => sum + m.errors.length, 0)}
Most Common Error Types:
${this.getMostCommonErrors(allMetrics).map(([error, count]) => `  ${error}: ${count} occurrences`).join('\n')}
`;

    return report;
  }

  private getMostCommonErrors(metrics: AgentMetrics[]): Array<[string, number]> {
    const errorCounts: Record<string, number> = {};
    
    metrics.forEach(m => {
      m.errors.forEach(e => {
        const key = `${e.action}: ${e.error}`;
        errorCounts[key] = (errorCounts[key] || 0) + 1;
      });
    });

    return Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }

  saveMetricsToFile(): void {
    try {
      fs.writeFileSync(this.metricsFile, JSON.stringify(this.getAllMetrics(), null, 2));
      this.log('INFO', 'SYSTEM', 'Metrics saved to file');
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }

  saveSummaryReport(): void {
    try {
      const summaryFile = this.metricsFile.replace('.json', '-summary.txt');
      fs.writeFileSync(summaryFile, this.generateSummaryReport());
      this.log('INFO', 'SYSTEM', 'Summary report saved to file');
    } catch (error) {
      console.error('Failed to save summary report:', error);
    }
  }
}

// Singleton instance
export const chaosLogger = new ChaosLogger();