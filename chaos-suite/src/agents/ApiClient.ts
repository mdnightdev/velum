export interface AgentCredentials {
  username: string;
  password?: string;
  panicPhrase?: string;
  safeWord?: string;
  salt?: string;
}

import { Telemetry } from '../telemetry/Telemetry.js';

export class ApiClient {
  private baseUrl: string;
  private credentials: AgentCredentials;
  private telemetry = Telemetry.getInstance();

  constructor(credentials: AgentCredentials, baseUrl: string = 'http://localhost:3000/v2') {
    this.credentials = credentials;
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    token?: string
  ): Promise<T> {
    const start = Date.now();
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-session-id'] = token;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });

      const durationMs = Date.now() - start;
      const success = response.ok;

      this.telemetry.recordHttp({
        endpoint,
        method,
        statusCode: response.status,
        durationMs,
        timestamp: start,
        success,
        error: success ? undefined : response.statusText
      });

      if (!success) {
        const text = await response.text().catch(() => '');
        throw new Error(`API Error [${response.status}] ${response.statusText}: ${text}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return (await response.json()) as T;
      }
      return {} as T;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      if (!err.message.startsWith('API Error')) {
        this.telemetry.recordHttp({
          endpoint,
          method,
          statusCode: 0,
          durationMs,
          timestamp: start,
          success: false,
          error: err.message
        });
      }
      throw err;
    }
  }

  public async register(): Promise<{ token: string; userId: number; username: string }> {
    const res = await this.request<{ token: string; user: { userId: number; username: string } }>(
      '/auth/register',
      'POST',
      {
        username: this.credentials.username,
        password: this.credentials.password,
        panicPhrase: this.credentials.panicPhrase,
        passcode: '1234'
      }
    );
    return { token: res.token, userId: res.user.userId, username: res.user.username };
  }

  public async login(): Promise<{ token: string; userId: number; username: string }> {
    const res = await this.request<{ token: string; user: { userId: number; username: string } }>(
      '/auth/login',
      'POST',
      {
        username: this.credentials.username,
        password: this.credentials.password
      }
    );
    return { token: res.token, userId: res.user.userId, username: res.user.username };
  }

  public async getLounges(token: string): Promise<any[]> {
    return this.request<any[]>('/lounges', 'GET', undefined, token);
  }

  public async sendMessage(loungeId: string, message: string, token: string): Promise<void> {
    await this.request(`/lounges/${loungeId}/messages`, 'POST', { content: message, message }, token);
  }

  public async getMessages(loungeId: string, token: string): Promise<any[]> {
    return this.request<any[]>(`/lounges/${loungeId}/messages`, 'GET', undefined, token);
  }

  public async depositFunds(amount: number, token: string): Promise<void> {
    await this.request('/payments/wallet-deposit', 'POST', { amount }, token);
  }

  public async getWalletBalance(token: string): Promise<any> {
    return this.request('/bank/wallet', 'GET', undefined, token);
  }

  public async transfer(recipientUsername: string, amount: number, token: string): Promise<void> {
    await this.request('/bank/transfer', 'POST', { recipientUsername, amount }, token);
  }

  public async createListing(title: string, price: number, stock: number, token: string): Promise<any> {
    return this.request('/marketplace/listings', 'POST', {
      title,
      description: `${title} - Velum digital asset listing in marketplace.`,
      price,
      stock,
      category: 'GENERAL'
    }, token);
  }

  public async getListings(token: string): Promise<any[]> {
    return this.request<any[]>('/marketplace/listings', 'GET', undefined, token);
  }

  public async purchaseListing(listingId: number, quantity: number, token: string): Promise<void> {
    await this.request(`/marketplace/listings/${listingId}/purchase`, 'POST', { quantity }, token);
  }

  public async sendFriendRequest(username: string, token: string): Promise<void> {
    await this.request('/friends/requests', 'POST', { receiverUsername: username }, token);
  }

  public async getFriends(token: string): Promise<any[]> {
    return this.request<any[]>('/friends/relationships', 'GET', undefined, token);
  }

  public async triggerPanicPhrase(token: string): Promise<void> {
    await this.request('/auth/login', 'POST', {
      username: this.credentials.username,
      panicPhrase: this.credentials.panicPhrase
    });
  }
}
