import { AgentCredentials } from './Agent.js';

export class ApiClient {
  private baseUrl = 'http://localhost:3000/v2';
  private credentials: AgentCredentials;

  constructor(credentials: AgentCredentials) {
    this.credentials = credentials;
  }

  public async register(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.credentials.username,
        password: this.credentials.password
      })
    });
    if (!response.ok) throw new Error(`Registration failed: ${response.statusText}`);
    const data = await response.json();
    return data.token;
  }

  public async sendMessage(loungeId: string, message: string, token: string): Promise<void> {
    await fetch(`${this.baseUrl}/lounges/${loungeId}/messages`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ message })
    });
  }

  public async depositFunds(amount: number, token: string): Promise<void> {
    await fetch(`${this.baseUrl}/payments/wallet-deposit`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ amount })
    });
  }

  public async transfer(recipientUsername: string, amount: number, token: string): Promise<void> {
    await fetch(`${this.baseUrl}/bank/transfer`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ recipientUsername, amount })
    });
  }

  public async createListing(title: string, price: number, stock: number, token: string): Promise<void> {
    await fetch(`${this.baseUrl}/market/listings`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ title, price, stock, category: 'GENERAL' })
    });
  }

  public async registerCard(token: string): Promise<void> {
    await fetch(`${this.baseUrl}/card/card`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ type: 'DEBIT' })
    });
  }

  public async sendFriendRequest(username: string, token: string): Promise<void> {
    await fetch(`${this.baseUrl}/friend/requests`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ username })
    });
  }
}
