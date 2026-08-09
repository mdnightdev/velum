import { Agent } from '../agents/Agent.js';

export class Controller {
  private agents: Agent[] = [];

  constructor(private agentCount: number) {}

  public async start(): Promise<void> {
    console.log(`[Controller] Initializing ${this.agentCount} agents...`);
    for (let i = 0; i < this.agentCount; i++) {
      const agent = new Agent(i);
      this.agents.push(agent);
      // Run agents in the background
      agent.run().catch(err => console.error(`[Agent ${i}] Error:`, err));
    }
  }
}
