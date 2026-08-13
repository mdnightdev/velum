import crypto from 'crypto';

interface VelumCredentials {
  username: string;
  password: string;
}

interface AuditLog {
  timestamp: string;
  botId: string;
  persona: string;
  action: string;
  success: boolean;
  latency: number;
  error?: string;
  notes?: string;
}

class SimpleChaosAgent {
  private credentials: VelumCredentials;
  private baseUrl: string;
  private token: string | null = null;
  private userId: number | null = null;
  private auditLogs: AuditLog[] = [];
  private isActive: boolean = false;

  constructor(botId: string, persona: string, baseUrl: string = 'http://localhost:3000/v2') {
    // Generate password that meets strong password requirements
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const password = `SecureP@ss${timestamp}${randomStr}!`;

    this.credentials = {
      username: botId,
      password: password
    };
    this.baseUrl = baseUrl;
  }

  private async request(endpoint: string, method: string = 'GET', body: any = null): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
      });
      const latency = Date.now() - startTime;
      const data = await response.json();
      return { success: response.ok, data, latency, status: response.status };
    } catch (error) {
      const latency = Date.now() - startTime;
      return { success: false, error: (error as Error).message, latency };
    }
  }

  private log(action: string, success: boolean, latency: number, error?: string, notes?: string): void {
    this.auditLogs.push({
      timestamp: new Date().toISOString(),
      botId: this.credentials.username,
      persona: 'chaos_bot',
      action,
      success,
      latency,
      error,
      notes
    });
  }

  async login(): Promise<boolean> {
    // Try login first
    const result = await this.request('/auth/login', 'POST', {
      username: this.credentials.username,
      password: this.credentials.password
    });

    if (result.success && result.data?.token) {
      this.token = result.data.token;
      this.userId = result.data.user.userId;
      this.isActive = true;
      this.log('login', true, result.latency, undefined, `userId: ${this.userId}`);
      return true;
    }

    // Try register if login fails
    const registerResult = await this.request('/auth/register', 'POST', {
      username: this.credentials.username,
      password: this.credentials.password,
      panicPhrase: 'test_panic'
    });

    if (registerResult.success && registerResult.data?.token) {
      this.token = registerResult.data.token;
      this.userId = registerResult.data.user.userId;
      this.isActive = true;
      this.log('register', true, registerResult.latency, undefined, `userId: ${this.userId}`);
      return true;
    }

    // If registration failed with 409 (conflict), user already exists
    if (registerResult.status === 409) {
      this.log('login', false, result.latency, `User already exists, login failed. Status: ${registerResult.status}`);
      return false;
    }

    this.log('login', false, result.latency, result.error || registerResult.error || `Failed to register. Status: ${registerResult.status}`);
    return false;
  }

  async sendMessage(loungeId: string, message: string): Promise<boolean> {
    if (!this.token) return false;

    const nonce = `nonce_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const result = await this.request(`/lounges/${loungeId}/messages`, 'POST', {
      content: message,
      client_msg_id: nonce,
      nonce: nonce
    });

    if (result.success && result.data?.message?.id) {
      this.log('sendMessage', true, result.latency, undefined, `msgId: ${result.data.message.id}`);
      return true;
    }

    this.log('sendMessage', false, result.latency, result.error);
    return false;
  }

  async createLounge(name: string): Promise<boolean> {
    if (!this.token) return false;

    const result = await this.request('/lounges', 'POST', {
      name,
      description: 'Test lounge'
    });

    if (result.success && result.data?.id) {
      this.log('createLounge', true, result.latency, undefined, `loungeId: ${result.data.id}`);
      return true;
    }

    this.log('createLounge', false, result.latency, result.error);
    return false;
  }

  async uploadAvatar(): Promise<boolean> {
    if (!this.token) return false;

    // Simple 1x1 pixel webp
    const avatarData = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x12, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x4c, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x41, 0x4d, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);

    const url = `${this.baseUrl}/user/upload-avatar`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'image/webp'
        },
        body: avatarData
      });

      const latency = Date.now();
      const data = await response.json();

      if (response.ok && data.url) {
        this.log('uploadAvatar', true, latency, undefined, `url: ${data.url}`);
        return true;
      }

      this.log('uploadAvatar', false, latency, 'No URL returned');
      return false;
    } catch (error) {
      this.log('uploadAvatar', false, 0, (error as Error).message);
      return false;
    }
  }

  async createTicket(): Promise<boolean> {
    if (!this.token) return false;

    const result = await this.request('/tickets', 'POST', {
      reason: 'Bug report',
      issueType: 'Test issue from chaos bot'
    });

    if (result.success && result.data?.ticket_id) {
      this.log('createTicket', true, result.latency, undefined, `ticketId: ${result.data.ticket_id}`);
      return true;
    }

    this.log('createTicket', false, result.latency, result.error);
    return false;
  }

  getAuditLogs(): AuditLog[] {
    return this.auditLogs;
  }

  getBotId(): string {
    return this.credentials.username;
  }

  isActiveSession(): boolean {
    return this.isActive && this.token !== null;
  }
}

export { SimpleChaosAgent };
export type { AuditLog };