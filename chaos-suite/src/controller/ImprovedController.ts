import { ImprovedAgent } from '../agents/ImprovedAgent.js';
import { PersonaType, PERSONAS } from '../config/agentConfig.js';
import { chaosLogger } from '../utils/logger.js';
import { persistenceManager } from '../utils/persistence.js';
import { AdminVisibilityConfig, DEFAULT_VISIBILITY_CONFIG, STEALTH_MODE_CONFIG } from '../config/adminVisibility.js';

export interface ChaosConfig {
  totalAgents: number;
  personaDistribution: Record<PersonaType, number>;
  duration?: number; // Duration in milliseconds, undefined = run indefinitely
  maxConcurrentActions?: number;
  enableMetricsReporting?: boolean;
  metricsReportInterval?: number; // milliseconds
  adminVisibility?: AdminVisibilityConfig; // Admin visibility settings
}

export class ImprovedController {
  private agents: Map<string, ImprovedAgent> = new Map();
  private config: ChaosConfig;
  private isRunning: boolean = false;
  private metricsInterval?: NodeJS.Timeout;
  private startTime?: Date;

  constructor(config: ChaosConfig) {
    this.config = {
      ...config,
      adminVisibility: config.adminVisibility || DEFAULT_VISIBILITY_CONFIG
    };
  }

  private generateAgentId(index: number, persona: PersonaType): string {
    return `agent_${persona.toLowerCase()}_${index}`;
  }

  private distributePersonas(): PersonaType[] {
    const distribution: PersonaType[] = [];
    let agentIndex = 0;

    // Calculate the total requested from distribution
    const totalRequested = Object.values(this.config.personaDistribution).reduce((sum, count) => sum + count, 0);
    
    // Scale down the distribution proportionally if it exceeds totalAgents
    const scaleFactor = totalRequested > this.config.totalAgents 
      ? this.config.totalAgents / totalRequested 
      : 1;

    for (const [persona, count] of Object.entries(this.config.personaDistribution)) {
      const scaledCount = Math.floor(count * scaleFactor);
      for (let i = 0; i < scaledCount; i++) {
        if (distribution.length < this.config.totalAgents) {
          distribution.push(persona as PersonaType);
          agentIndex++;
        }
      }
    }

    // Fill remaining slots with CASUAL_USER if distribution doesn't match total
    while (distribution.length < this.config.totalAgents) {
      distribution.push('CASUAL_USER');
    }

    // Shuffle the distribution for randomness
    return distribution.sort(() => Math.random() - 0.5);
  }

  private createAgents(): void {
    const personaDistribution = this.distributePersonas();
    
    chaosLogger.log('INFO', 'CONTROLLER', `Creating ${this.config.totalAgents} agents with persona distribution:`);
    console.table(
      Object.entries(this.config.personaDistribution).map(([persona, count]) => ({
        Persona: persona,
        Count: count,
        Percentage: `${((count / this.config.totalAgents) * 100).toFixed(1)}%`
      }))
    );

    let deviceIndex = 0;
    personaDistribution.forEach((persona, index) => {
      const agentId = this.generateAgentId(index, persona);
      const agent = new ImprovedAgent(agentId, persona, deviceIndex, this.config.adminVisibility || DEFAULT_VISIBILITY_CONFIG);
      this.agents.set(agentId, agent);
      
      // Distribute devices across agents
      deviceIndex = (deviceIndex + 1) % 5; // 5 device types
      
      chaosLogger.log('DEBUG', 'CONTROLLER', `Created agent ${agentId} with persona ${persona}`);
    });
  }

  private startMetricsReporting(): void {
    if (!this.config.enableMetricsReporting) return;

    const interval = this.config.metricsReportInterval || 30000; // Default 30 seconds

    this.metricsInterval = setInterval(() => {
      this.printLiveMetrics();
    }, interval);
  }

  private printLiveMetrics(): void {
    const allMetrics = chaosLogger.getAllMetrics();
    const totalActions = allMetrics.reduce((sum, m) => sum + m.totalActions, 0);
    const successfulActions = allMetrics.reduce((sum, m) => sum + m.successfulActions, 0);
    const failedActions = allMetrics.reduce((sum, m) => sum + m.failedActions, 0);
    const activeAgents = allMetrics.filter(m => !m.endTime).length;

    console.log('\n=== LIVE CHAOS METRICS ===');
    console.log(`Active Agents: ${activeAgents}/${this.config.totalAgents}`);
    console.log(`Total Actions: ${totalActions}`);
    console.log(`Success Rate: ${totalActions > 0 ? ((successfulActions / totalActions) * 100).toFixed(2) : 0}%`);
    console.log(`Failed Actions: ${failedActions}`);
    console.log(`Runtime: ${this.startTime ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0}s`);
    console.log('========================\n');
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Chaos suite is already running');
      return;
    }

    this.isRunning = true;
    this.startTime = new Date();

    chaosLogger.log('INFO', 'CONTROLLER', 'Starting improved chaos suite');
    console.log('🚀 Starting Improved Chaos Engineering Suite');
    console.log(`📊 Configuration: ${this.config.totalAgents} agents, distributed across personas`);
    console.log(`⏱️  Duration: ${this.config.duration ? `${this.config.duration / 1000}s` : 'Indefinite'}`);
    console.log(`📈 Metrics Reporting: ${this.config.enableMetricsReporting ? 'Enabled' : 'Disabled'}`);

    // Check existing users
    const stats = persistenceManager.getStatistics();
    console.log(`👥 Existing Users: ${stats.totalUsers} (${stats.activeUsers} active)`);
    console.log(`📋 User Distribution by Persona:`, stats.usersByPersona);

    // Create agents
    this.createAgents();

    // Start metrics reporting if enabled
    if (this.config.enableMetricsReporting) {
      this.startMetricsReporting();
    }

    // Start all agents
    chaosLogger.log('INFO', 'CONTROLLER', 'Starting all agents');
    const agentPromises = Array.from(this.agents.values()).map(agent => 
      agent.run().catch(err => {
        chaosLogger.log('ERROR', 'CONTROLLER', `Agent ${agent.getCredentials().username} failed: ${err.message}`);
      })
    );

    // Wait for duration if specified
    if (this.config.duration) {
      setTimeout(() => {
        this.stop();
      }, this.config.duration);
    }

    // Wait for all agents to complete (if duration is set)
    if (this.config.duration) {
      await Promise.all(agentPromises);
    } else {
      // Run indefinitely - agents will run in background
      console.log('✅ All agents started. Running indefinitely. Press Ctrl+C to stop.');
    }
  }

  public stop(): void {
    if (!this.isRunning) {
      console.log('Chaos suite is not running');
      return;
    }

    console.log('🛑 Stopping chaos suite...');
    this.isRunning = false;

    // Stop all agents
    this.agents.forEach(agent => agent.stop());

    // Clear metrics interval
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Generate final reports
    console.log('📊 Generating final reports...');
    chaosLogger.saveMetricsToFile();
    chaosLogger.saveSummaryReport();

    const summary = chaosLogger.generateSummaryReport();
    console.log(summary);

    console.log('✅ Chaos suite stopped successfully');
  }

  public getAgentCount(): number {
    return this.agents.size;
  }

  public getActiveAgentCount(): number {
    let activeCount = 0;
    this.agents.forEach(agent => {
      if (agent.getState() !== 'REGISTER' && agent.getState() !== 'RECOVERY') {
        activeCount++;
      }
    });
    return activeCount;
  }

  public getAgentStates(): Record<string, string> {
    const states: Record<string, string> = {};
    this.agents.forEach((agent, agentId) => {
      states[agentId] = agent.getState();
    });
    return states;
  }

  public getAgentDetails(): Array<{
    agentId: string;
    username: string;
    persona: string;
    state: string;
    deviceInfo: any;
  }> {
    const details: Array<{
      agentId: string;
      username: string;
      persona: string;
      state: string;
      deviceInfo: any;
    }> = [];

    this.agents.forEach(agent => {
      details.push({
        agentId: agent['agentId'],
        username: agent.getCredentials().username,
        persona: agent.getPersona(),
        state: agent.getState(),
        deviceInfo: agent.getDeviceInfo()
      });
    });

    return details;
  }

  public restartAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      console.log(`Agent ${agentId} not found`);
      return false;
    }

    console.log(`Restarting agent ${agentId}...`);
    agent.stop();
    
    // Create new agent with same configuration
    const newAgent = new ImprovedAgent(agentId, agent.getPersona(), 0, this.config.adminVisibility || DEFAULT_VISIBILITY_CONFIG);
    this.agents.set(agentId, newAgent);
    
    // Start the new agent
    newAgent.run().catch(err => {
      chaosLogger.log('ERROR', 'CONTROLLER', `Restarted agent ${agentId} failed: ${err.message}`);
    });

    return true;
  }

  public addAgent(persona: PersonaType): string {
    const agentId = this.generateAgentId(this.agents.size, persona);
    const deviceIndex = this.agents.size % 5;
    const agent = new ImprovedAgent(agentId, persona, deviceIndex, this.config.adminVisibility || DEFAULT_VISIBILITY_CONFIG);
    this.agents.set(agentId, agent);
    
    agent.run().catch(err => {
      chaosLogger.log('ERROR', 'CONTROLLER', `Added agent ${agentId} failed: ${err.message}`);
    });

    console.log(`Added new agent ${agentId} with persona ${persona}`);
    return agentId;
  }

  public removeAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      console.log(`Agent ${agentId} not found`);
      return false;
    }

    agent.stop();
    this.agents.delete(agentId);
    console.log(`Removed agent ${agentId}`);
    return true;
  }
}