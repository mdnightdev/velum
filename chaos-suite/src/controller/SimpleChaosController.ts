import { SimpleChaosAgent, AuditLog } from '../agents/SimpleChaosAgent.js';
import fs from 'fs';
import path from 'path';

interface Config {
  agentCount: number;
  duration: number;
  baseUrl: string;
  runId?: number;
}

class SimpleChaosController {
  private agents: SimpleChaosAgent[] = [];
  private config: Config;
  private allAuditLogs: AuditLog[] = [];

  constructor(config: Config) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    console.log('Initializing simple chaos agents...');
    
    for (let i = 0; i < this.config.agentCount; i++) {
      const botId = `chaos_bot_${this.config.runId}_${i}`;
      const agent = new SimpleChaosAgent(botId, 'chaos', this.config.baseUrl);
      this.agents.push(agent);
    }

    console.log(`Created ${this.agents.length} agents`);
  }

  async run(): Promise<void> {
    console.log('Starting chaos test...');
    const endTime = Date.now() + this.config.duration;

    while (Date.now() < endTime) {
      for (const agent of this.agents) {
        // Ensure agent is logged in
        if (!agent.isActiveSession()) {
          await agent.login();
          await this.sleep(2000); // Wait between logins
        }

        // Execute random action with realistic delay
        await this.executeRandomAction(agent);
        
        // Collect audit logs
        this.allAuditLogs.push(...agent.getAuditLogs());
        
        // Realistic delay between actions (3-8 seconds)
        await this.sleep(3000 + Math.random() * 5000);
      }

      // Wait between agent cycles (10-30 seconds)
      await this.sleep(10000 + Math.random() * 20000);
    }

    console.log('Chaos test completed');
  }

  private async executeRandomAction(agent: SimpleChaosAgent): Promise<void> {
    const actions = [
      () => agent.sendMessage('velum_general', `Random message ${Date.now()}`),
      () => agent.createLounge(`Test Lounge ${Date.now()}`),
      () => agent.uploadAvatar(),
      () => agent.createTicket()
    ];

    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    await randomAction();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateAuditReport(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(process.cwd(), 'chaos-logs', `audit-report-${timestamp}.md`);

    // Generate markdown table
    let report = `# Velum Chaos Audit Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Total Agents: ${this.agents.length}\n`;
    report += `Total Actions: ${this.allAuditLogs.length}\n\n`;

    // Summary statistics
    const successful = this.allAuditLogs.filter(log => log.success).length;
    const failed = this.allAuditLogs.filter(log => !log.success).length;
    const avgLatency = this.allAuditLogs.reduce((sum, log) => sum + log.latency, 0) / this.allAuditLogs.length;

    report += `## Summary\n\n`;
    report += `| Metric | Value |\n`;
    report += `|--------|-------|\n`;
    report += `| Successful Actions | ${successful} |\n`;
    report += `| Failed Actions | ${failed} |\n`;
    report += `| Success Rate | ${((successful / this.allAuditLogs.length) * 100).toFixed(1)}% |\n`;
    report += `| Average Latency | ${avgLatency.toFixed(0)}ms |\n\n`;

    // Detailed action breakdown
    report += `## Action Breakdown\n\n`;
    const actionCounts: Record<string, { success: number; failed: number }> = {};
    
    for (const log of this.allAuditLogs) {
      if (!actionCounts[log.action]) {
        actionCounts[log.action] = { success: 0, failed: 0 };
      }
      if (log.success) {
        actionCounts[log.action].success++;
      } else {
        actionCounts[log.action].failed++;
      }
    }

    report += `| Action | Success | Failed | Total |\n`;
    report += `|--------|---------|--------|-------|\n`;
    for (const [action, counts] of Object.entries(actionCounts)) {
      report += `| ${action} | ${counts.success} | ${counts.failed} | ${counts.success + counts.failed} |\n`;
    }

    // Detailed log table
    report += `\n## Detailed Action Log\n\n`;
    report += `| Timestamp | Bot ID | Action | Success | Latency (ms) | Error |\n`;
    report += `|-----------|--------|--------|---------|--------------|-------|\n`;

    for (const log of this.allAuditLogs) {
      report += `| ${log.timestamp} | ${log.botId} | ${log.action} | ${log.success ? '✅' : '❌'} | ${log.latency} | ${log.error || ''} |\n`;
    }

    // Error breakdown
    const errorLogs = this.allAuditLogs.filter(log => !log.success && log.error);
    if (errorLogs.length > 0) {
      report += `\n## Error Breakdown\n\n`;
      const errorCounts: Record<string, number> = {};
      for (const log of errorLogs) {
        const error = log.error || 'Unknown error';
        errorCounts[error] = (errorCounts[error] || 0) + 1;
      }

      report += `| Error | Count |\n`;
      report += `|-------|-------|\n`;
      for (const [error, count] of Object.entries(errorCounts)) {
        report += `| ${error} | ${count} |\n`;
      }
    }

    // Write report
    if (!fs.existsSync(path.join(process.cwd(), 'chaos-logs'))) {
      fs.mkdirSync(path.join(process.cwd(), 'chaos-logs'), { recursive: true });
    }

    fs.writeFileSync(reportPath, report);
    console.log(`Audit report saved to: ${reportPath}`);

    // Also save as JSON for programmatic access
    const jsonPath = path.join(process.cwd(), 'chaos-logs', `audit-report-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        totalAgents: this.agents.length,
        totalActions: this.allAuditLogs.length,
        successful,
        failed,
        successRate: (successful / this.allAuditLogs.length) * 100,
        averageLatency: avgLatency
      },
      actionCounts,
      auditLogs: this.allAuditLogs
    }, null, 2));

    console.log(`JSON report saved to: ${jsonPath}`);
  }
}

export { SimpleChaosController };