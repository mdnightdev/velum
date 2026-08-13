import { ChaosAgent } from '../agents/ChaosAgent.js';
import { chaosLogger } from '../utils/chaosLogger.js';
import fs from 'fs';
import path from 'path';

interface ChaosConfig {
  agentCount: number;
  duration: number;
  baseUrl: string;
  personaDistribution: Record<string, number>;
}

const DEFAULT_CONFIG: ChaosConfig = {
  agentCount: 10,
  duration: 60000, // 60 seconds
  baseUrl: 'http://localhost:3000/v2',
  personaDistribution: {
    SOCIAL_BUTTERFLY: 3,
    CASUAL_USER: 3,
    TECH_SAVVY: 2,
    SUPPORT_SEEKER: 1,
    DRAMA_QUEEN: 1
  }
};

export class ChaosController {
  private agents: Map<string, ChaosAgent> = new Map();
  private config: ChaosConfig;
  private isRunning: boolean = false;

  constructor(config: Partial<ChaosConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private generateAgentId(persona: string, index: number): string {
    const names = ['alex', 'jordan', 'taylor', 'morgan', 'casey', 'riley', 'quinn', 'avery', 'skylar', 'reese'];
    const name = names[index % names.length];
    return `${name}_${persona.toLowerCase()}_${index}`;
  }

  private distributePersonas(): string[] {
    const personas: string[] = [];
    let index = 0;

    for (const [persona, count] of Object.entries(this.config.personaDistribution)) {
      for (let i = 0; i < count; i++) {
        personas.push(persona);
        index++;
      }
    }

    // Fill remaining slots with CASUAL_USER if needed
    while (personas.length < this.config.agentCount) {
      personas.push('CASUAL_USER');
    }

    // Shuffle for unpredictability
    return personas.sort(() => Math.random() - 0.5);
  }

  async initialize(): Promise<void> {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🚀 Velum Chaos Engineering Suite V3 Initializing');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📊 Configuration: ${this.config.agentCount} agents`);
    console.log(`⏱️  Duration: ${this.config.duration / 1000}s`);
    console.log(`🌐 Base URL: ${this.config.baseUrl}`);
    console.log('');

    const personas = this.distributePersonas();
    
    // Create agents
    for (let i = 0; i < this.config.agentCount; i++) {
      const persona = personas[i];
      const agentId = this.generateAgentId(persona, i);
      
      const agent = new ChaosAgent({
        agentId,
        persona: persona as any,
        deviceIndex: i,
        baseUrl: this.config.baseUrl
      });

      this.agents.set(agentId, agent);
      console.log(`✅ Initialized agent: ${agentId} (${persona})`);
    }

    console.log('');
    console.log(`🤖 Total agents created: ${this.agents.size}`);
    console.log('═══════════════════════════════════════════════════════════════');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Chaos suite is already running');
      return;
    }

    this.isRunning = true;
    console.log('🎬 Starting chaos agents...');
    console.log('');

    // Start all agents in parallel
    const agentPromises = Array.from(this.agents.values()).map(agent => 
      agent.start(this.config.duration)
    );

    await Promise.all(agentPromises);

    this.isRunning = false;
    console.log('');
    console.log('🏁 Chaos suite completed');
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping chaos agents...');
    
    for (const agent of this.agents.values()) {
      agent.stop();
    }

    this.isRunning = false;
    console.log('✅ All agents stopped');
  }

  generateReports(): void {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 GENERATING CHAOS REPORTS');
    console.log('═══════════════════════════════════════════════════════════════');

    // Save all reports
    chaosLogger.saveReports();

    // Print global report
    console.log(chaosLogger.generateGlobalReport());

    // Print individual bot reports
    for (const [agentId] of this.agents) {
      console.log(chaosLogger.generateBotReport(agentId));
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📁 Reports saved to chaos-logs/');
    console.log('═══════════════════════════════════════════════════════════════');
  }

  getAgentCount(): number {
    return this.agents.size;
  }

  isActive(): boolean {
    return this.isRunning;
  }
}