import { ApiClient } from './ApiClient.js';

export type AgentState = 'REGISTER' | 'ACTIVE' | 'ROGUE' | 'RECOVERY';

export interface AgentCredentials {
  username: string;
  password: string;
  panicPhrase: string;
  safeWord: string;
}

export class Agent {
  private state: AgentState = 'REGISTER';
  private credentials: AgentCredentials;
  private client: ApiClient;
  private token?: string;
  
  private static names = ['lexie', 'midnight', 'zen', 'jax', 'rio', 'nova', 'kai', 'luna', 'ace', 'ruby'];

  constructor(id: number) {
    const name = Agent.names[id % Agent.names.length];
    this.credentials = {
      username: `${name}_${id}_${Math.floor(Math.random() * 1000)}`,
      password: `Pass_${Math.random()}`,
      panicPhrase: `phrase_${Math.random()}`,
      safeWord: `word_${Math.random()}`
    };
    this.client = new ApiClient(this.credentials);
  }

  private log(message: string): void {
    console.log(`[${new Date().toISOString()}] [Agent ${this.credentials.username}] ${message}`);
  }

  public async run(): Promise<void> {
    this.log(`Starting in state: ${this.state}`);
    while (true) {
      try {
        await this.performAction();
      } catch (err) {
        this.log(`Error in state ${this.state}: ${(err as Error).message}`);
        this.state = 'RECOVERY';
      }
      // Add random delay to simulate human-like interactions
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    }
  }

  private async performAction(): Promise<void> {
    switch (this.state) {
      case 'REGISTER':
        await this.register();
        break;
      case 'ACTIVE':
        await this.activeAction();
        break;
      case 'ROGUE':
        await this.rogueAction();
        break;
      case 'RECOVERY':
        await this.recover();
        break;
    }
  }

  private async register(): Promise<void> {
    this.log(`Attempting registration...`);
    this.token = await this.client.register();
    this.log(`Registered successfully.`);
    
    // Seed action: Fund wallet
    this.log(`Funding wallet...`);
    await this.client.depositFunds(1000, this.token);

    // Seed action: Register card
    this.log(`Registering card...`);
    await this.client.registerCard(this.token);

    // Seed action: Send friend request (to 'midnight' admin)
    this.log(`Sending friend request to admin...`);
    await this.client.sendFriendRequest('midnight', this.token);
    
    // Seed action: Send message (assume lounge ID 1 exists)
    this.log(`Joining lounge and sending message...`);
    await this.client.sendMessage('1', `Hello! I am ${this.credentials.username.split('_')[0]}.`, this.token);
    
    this.state = 'ACTIVE';
    this.log(`Transitioned to state: ${this.state}`);
  }

  private async activeAction(): Promise<void> {
    if (!this.token) return;

    const action = Math.random();
    if (action < 0.6) {
      this.log(`Listing item on marketplace...`);
      await this.client.createListing(`Item_${Math.random()}`, 10, 1, this.token);
    } else {
      // Try to transfer to another agent (simplified)
      this.log(`Attempting transfer...`);
      // Note: In a real scenario, we'd need to know another agent's username.
      // For now, we'll try to transfer to a placeholder username to test the flow.
      await this.client.transfer('midnight', 1, this.token).catch(() => {});
    }
  }

  private async rogueAction(): Promise<void> {
    // TODO: Implement adversarial behavior
  }

  private async recover(): Promise<void> {
    this.log(`Recovering...`);
    // TODO: Implement backoff/recovery logic
    this.state = 'ACTIVE';
  }
}
