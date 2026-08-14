import fs from 'fs';
import path from 'path';

interface BotMetrics {
  botId: string;
  persona: string;
  actions: {
    timestamp: number;
    action: string;
    success: boolean;
    latency: number;
    error?: string;
    details?: any;
  }[];
  failures: {
    timestamp: number;
    action: string;
    error: string;
    recoveryAttempted: boolean;
    recoverySuccess?: boolean;
  }[];
  adminInteractions: {
    timestamp: number;
    type: 'mute' | 'block' | 'sanction';
    detected: boolean;
    bypassAttempted: boolean;
    bypassSuccess?: boolean;
  }[];
  compromiseEvents: {
    timestamp: number;
    type: 'password_change' | 'token_leak' | 'session_hijack';
    recoveryAttempted: boolean;
    recoverySuccess?: boolean;
  }[];
  sessionState: {
    loginTime: number;
    logoutTime?: number;
    sessionDuration?: number;
    forcedLogout?: boolean;
  };
}

interface GlobalMetrics {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  averageLatency: number;
  commonFailures: Record<string, number>;
  activeBots: number;
  mutedBots: number;
  compromisedBots: number;
}

class ChaosLogger {
  private botMetrics: Map<string, BotMetrics> = new Map();
  private logDir: string;
  private globalMetrics: GlobalMetrics = {
    totalActions: 0,
    successfulActions: 0,
    failedActions: 0,
    averageLatency: 0,
    commonFailures: {},
    activeBots: 0,
    mutedBots: 0,
    compromisedBots: 0
  };

  constructor() {
    this.logDir = path.join(process.cwd(), 'chaos-logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  initializeBot(botId: string, persona: string): void {
    this.botMetrics.set(botId, {
      botId,
      persona,
      actions: [],
      failures: [],
      adminInteractions: [],
      compromiseEvents: [],
      sessionState: {
        loginTime: Date.now()
      }
    });
    this.globalMetrics.activeBots++;
  }

  logAction(botId: string, action: string, success: boolean, latency: number, error?: string, details?: any): void {
    const metrics = this.botMetrics.get(botId);
    if (!metrics) return;

    metrics.actions.push({
      timestamp: Date.now(),
      action,
      success,
      latency,
      error,
      details
    });

    this.globalMetrics.totalActions++;
    if (success) {
      this.globalMetrics.successfulActions++;
    } else {
      this.globalMetrics.failedActions++;
      if (error) {
        this.globalMetrics.commonFailures[error] = (this.globalMetrics.commonFailures[error] || 0) + 1;
      }
    }

    // Update average latency
    const totalLatency = this.globalMetrics.averageLatency * (this.globalMetrics.totalActions - 1) + latency;
    this.globalMetrics.averageLatency = totalLatency / this.globalMetrics.totalActions;
  }

  logFailure(botId: string, action: string, error: string, recoveryAttempted: boolean, recoverySuccess?: boolean): void {
    const metrics = this.botMetrics.get(botId);
    if (!metrics) return;

    metrics.failures.push({
      timestamp: Date.now(),
      action,
      error,
      recoveryAttempted,
      recoverySuccess
    });
  }

  logAdminInteraction(botId: string, type: 'mute' | 'block' | 'sanction', detected: boolean, bypassAttempted: boolean, bypassSuccess?: boolean): void {
    const metrics = this.botMetrics.get(botId);
    if (!metrics) return;

    metrics.adminInteractions.push({
      timestamp: Date.now(),
      type,
      detected,
      bypassAttempted,
      bypassSuccess
    });

    if (detected && type === 'mute') {
      this.globalMetrics.mutedBots++;
    }
  }

  logCompromiseEvent(botId: string, type: 'password_change' | 'token_leak' | 'session_hijack', recoveryAttempted: boolean, recoverySuccess?: boolean): void {
    const metrics = this.botMetrics.get(botId);
    if (!metrics) return;

    metrics.compromiseEvents.push({
      timestamp: Date.now(),
      type,
      recoveryAttempted,
      recoverySuccess
    });

    // Only increment if this is a new compromise (not a recovery attempt)
    if (!recoveryAttempted) {
      this.globalMetrics.compromisedBots++;
    }
  }

  logSessionEnd(botId: string, forcedLogout: boolean = false): void {
    const metrics = this.botMetrics.get(botId);
    if (!metrics) return;

    metrics.sessionState.logoutTime = Date.now();
    metrics.sessionState.sessionDuration = metrics.sessionState.logoutTime - metrics.sessionState.loginTime;
    metrics.sessionState.forcedLogout = forcedLogout;

    if (!forcedLogout) {
      this.globalMetrics.activeBots--;
    }
  }

  generateBotReport(botId: string): string {
    const metrics = this.botMetrics.get(botId);
    if (!metrics) return `No metrics found for bot ${botId}`;

    const successRate = metrics.actions.length > 0 
      ? (metrics.actions.filter(a => a.success).length / metrics.actions.length * 100).toFixed(1)
      : '0.0';

    const avgLatency = metrics.actions.length > 0
      ? (metrics.actions.reduce((sum, a) => sum + a.latency, 0) / metrics.actions.length).toFixed(0)
      : '0';

    let report = `
═══════════════════════════════════════════════════════════════
BOT REPORT: ${botId} (${metrics.persona})
═══════════════════════════════════════════════════════════════
Session Duration: ${metrics.sessionState.sessionDuration ? (metrics.sessionState.sessionDuration / 1000).toFixed(1) + 's' : 'N/A'}
Forced Logout: ${metrics.sessionState.forcedLogout ? 'YES' : 'NO'}

📊 ACTION METRICS
Total Actions: ${metrics.actions.length}
Success Rate: ${successRate}%
Average Latency: ${avgLatency}ms

🚨 FAILURES (${metrics.failures.length})
${metrics.failures.slice(-5).map(f => `  [${new Date(f.timestamp).toLocaleTimeString()}] ${f.action}: ${f.error}${f.recoveryAttempted ? (f.recoverySuccess ? ' ✅ Recovered' : ' ❌ Recovery failed') : ''}`).join('\n')}

🔧 ADMIN INTERACTIONS (${metrics.adminInteractions.length})
${metrics.adminInteractions.map(i => `  [${new Date(i.timestamp).toLocaleTimeString()}] ${i.type}: ${i.detected ? 'Detected' : 'Not detected'}${i.bypassAttempted ? (i.bypassSuccess ? ' ✅ Bypassed' : ' ❌ Bypass failed') : ''}`).join('\n')}

💀 COMPROMISE EVENTS (${metrics.compromiseEvents.length})
${metrics.compromiseEvents.map(c => `  [${new Date(c.timestamp).toLocaleTimeString()}] ${c.type}: ${c.recoveryAttempted ? (c.recoverySuccess ? ' ✅ Recovered' : ' ❌ Recovery failed') : 'No recovery'}`).join('\n')}

📝 RECENT ACTIONS
${metrics.actions.slice(-10).map(a => `  [${new Date(a.timestamp).toLocaleTimeString()}] ${a.action}: ${a.success ? '✅' : '❌'} (${a.latency}ms)`).join('\n')}
═══════════════════════════════════════════════════════════════
`;

    return report;
  }

  generateGlobalReport(): string {
    const successRate = this.globalMetrics.totalActions > 0
      ? (this.globalMetrics.successfulActions / this.globalMetrics.totalActions * 100).toFixed(1)
      : '0.0';

    let report = `
═══════════════════════════════════════════════════════════════
GLOBAL CHAOS SUITE REPORT
═══════════════════════════════════════════════════════════════
📊 OVERALL METRICS
Total Actions: ${this.globalMetrics.totalActions}
Successful: ${this.globalMetrics.successfulActions}
Failed: ${this.globalMetrics.failedActions}
Success Rate: ${successRate}%
Average Latency: ${this.globalMetrics.averageLatency.toFixed(0)}ms

🤖 BOT STATUS
Active Bots: ${this.globalMetrics.activeBots}
Muted Bots: ${this.globalMetrics.mutedBots}
Compromised Bots: ${this.globalMetrics.compromisedBots}

🚨 COMMON FAILURES
${Object.entries(this.globalMetrics.commonFailures)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([error, count]) => `  ${error}: ${count}x`)
  .join('\n')}

═══════════════════════════════════════════════════════════════
`;

    return report;
  }

  saveReports(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save global report
    const globalReport = this.generateGlobalReport();
    fs.writeFileSync(
      path.join(this.logDir, `global-report-${timestamp}.txt`),
      globalReport
    );

    // Save individual bot reports
    for (const [botId, metrics] of this.botMetrics) {
      const botReport = this.generateBotReport(botId);
      fs.writeFileSync(
        path.join(this.logDir, `bot-${botId}-${timestamp}.txt`),
        botReport
      );
    }

    // Save JSON data for analysis
    const jsonData = {
      timestamp: new Date().toISOString(),
      globalMetrics: this.globalMetrics,
      botMetrics: Array.from(this.botMetrics.entries())
    };
    fs.writeFileSync(
      path.join(this.logDir, `metrics-${timestamp}.json`),
      JSON.stringify(jsonData, null, 2)
    );
  }

  getMetrics(botId?: string): any {
    if (botId) {
      return this.botMetrics.get(botId);
    }
    return this.botMetrics;
  }
}

export const chaosLogger = new ChaosLogger();