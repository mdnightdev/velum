import fs from 'fs';
import path from 'path';

export interface StoredCredentials {
  username: string;
  password: string;
  panicPhrase: string;
  safeWord: string;
  salt?: string;
  userId?: number;
  createdAt: string;
  lastLoginAt?: string;
  persona?: string;
  isActive: boolean;
  isTestUser?: boolean;
  testTags?: string[];
}

export interface AgentState {
  agentId: string;
  username: string;
  persona: string;
  currentSessionToken?: string;
  lastActionTime?: string;
  isActive: boolean;
  deviceType?: string;
  ipAddress?: string;
}

class PersistenceManager {
  private credentialsFile: string;
  private stateFile: string;
  private credentials: Map<string, StoredCredentials> = new Map();
  private agentStates: Map<string, AgentState> = new Map();

  constructor() {
    const dataDir = path.join(process.cwd(), 'chaos-data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.credentialsFile = path.join(dataDir, 'credentials.json');
    this.stateFile = path.join(dataDir, 'agent-states.json');

    this.loadCredentials();
    this.loadAgentStates();
  }

  private loadCredentials(): void {
    try {
      if (fs.existsSync(this.credentialsFile)) {
        const data = fs.readFileSync(this.credentialsFile, 'utf-8');
        const credentialsArray: StoredCredentials[] = JSON.parse(data);
        
        this.credentials.clear();
        credentialsArray.forEach(cred => {
          this.credentials.set(cred.username, cred);
        });
        
        console.log(`Loaded ${this.credentials.size} stored credentials`);
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
      this.credentials = new Map();
    }
  }

  private saveCredentials(): void {
    try {
      const credentialsArray = Array.from(this.credentials.values());
      fs.writeFileSync(this.credentialsFile, JSON.stringify(credentialsArray, null, 2));
    } catch (error) {
      console.error('Failed to save credentials:', error);
    }
  }

  private loadAgentStates(): void {
    try {
      if (fs.existsSync(this.stateFile)) {
        const data = fs.readFileSync(this.stateFile, 'utf-8');
        const statesArray: AgentState[] = JSON.parse(data);
        
        this.agentStates.clear();
        statesArray.forEach(state => {
          this.agentStates.set(state.agentId, state);
        });
        
        console.log(`Loaded ${this.agentStates.size} agent states`);
      }
    } catch (error) {
      console.error('Failed to load agent states:', error);
      this.agentStates = new Map();
    }
  }

  private saveAgentStates(): void {
    try {
      const statesArray = Array.from(this.agentStates.values());
      fs.writeFileSync(this.stateFile, JSON.stringify(statesArray, null, 2));
    } catch (error) {
      console.error('Failed to save agent states:', error);
    }
  }

  // Check if user exists
  userExists(username: string): boolean {
    return this.credentials.has(username);
  }

  // Get existing credentials
  getCredentials(username: string): StoredCredentials | undefined {
    return this.credentials.get(username);
  }

  // Store new credentials
  storeCredentials(credentials: StoredCredentials): void {
    this.credentials.set(credentials.username, credentials);
    this.saveCredentials();
  }

  // Update last login time
  updateLastLogin(username: string): void {
    const cred = this.credentials.get(username);
    if (cred) {
      cred.lastLoginAt = new Date().toISOString();
      this.saveCredentials();
    }
  }

  // Get all active usernames
  getActiveUsernames(): string[] {
    return Array.from(this.credentials.values())
      .filter(cred => cred.isActive)
      .map(cred => cred.username);
  }

  // Get user by persona
  getUsersByPersona(persona: string): StoredCredentials[] {
    return Array.from(this.credentials.values())
      .filter(cred => cred.persona === persona && cred.isActive);
  }

  // Deactivate user
  deactivateUser(username: string): void {
    const cred = this.credentials.get(username);
    if (cred) {
      cred.isActive = false;
      this.saveCredentials();
    }
  }

  // Agent state management
  saveAgentState(state: AgentState): void {
    this.agentStates.set(state.agentId, state);
    this.saveAgentStates();
  }

  getAgentState(agentId: string): AgentState | undefined {
    return this.agentStates.get(agentId);
  }

  getAllAgentStates(): AgentState[] {
    return Array.from(this.agentStates.values());
  }

  updateAgentSession(agentId: string, sessionToken: string): void {
    const state = this.agentStates.get(agentId);
    if (state) {
      state.currentSessionToken = sessionToken;
      state.lastActionTime = new Date().toISOString();
      this.saveAgentStates();
    }
  }

  clearAgentSession(agentId: string): void {
    const state = this.agentStates.get(agentId);
    if (state) {
      state.currentSessionToken = undefined;
      this.saveAgentStates();
    }
  }

  // Reset all states (for fresh test runs)
  resetAllStates(): void {
    this.agentStates.clear();
    this.saveAgentStates();
    console.log('All agent states reset');
  }

  // Get statistics
  getStatistics(): {
    totalUsers: number;
    activeUsers: number;
    usersByPersona: Record<string, number>;
  } {
    const usersByPersona: Record<string, number> = {};
    
    this.credentials.forEach(cred => {
      if (cred.persona) {
        usersByPersona[cred.persona] = (usersByPersona[cred.persona] || 0) + 1;
      }
    });

    return {
      totalUsers: this.credentials.size,
      activeUsers: Array.from(this.credentials.values()).filter(cred => cred.isActive).length,
      usersByPersona
    };
  }
}

// Singleton instance
export const persistenceManager = new PersistenceManager();