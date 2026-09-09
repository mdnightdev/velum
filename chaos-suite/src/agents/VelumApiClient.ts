import crypto from 'crypto';

export interface VelumCredentials {
  username: string;
  password: string;
  panicPhrase: string;
  safeWord: string;
  salt?: string;
}

export interface VelumApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  latency?: number;
}

export interface VelumUser {
  id: number;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  role: string;
  createdAt: string;
}

export interface VelumLounge {
  id: number;
  slug?: string;
  name: string;
  description?: string;
  ownerId?: number;
  parentLoungeId?: number;
  isOfficial: boolean;
  isPrivate: boolean;
  isHidden: boolean;
  type: string;
  avatarUrl?: string;
  sublounges?: VelumLounge[];
  lounge_id?: string; // The room ID used for messaging
}

export interface VelumMessage {
  id: number;
  loungeId: number;
  senderId: number;
  content: string;
  sequenceId: number;
  encrypted: boolean;
  createdAt: string;
  username?: string;
  avatar?: string;
}

export class VelumApiClient {
  private baseUrl: string;
  private credentials: VelumCredentials;
  private sessionToken?: string;
  private userId?: number;
  private deviceInfo: { type: string; userAgent: string };
  private ipAddress?: string;

  constructor(credentials: VelumCredentials, baseUrl: string = 'http://localhost:3000/v2') {
    this.credentials = credentials;
    this.baseUrl = baseUrl;
    
    // Generate salt if not provided
    if (!this.credentials.salt) {
      this.credentials.salt = crypto.randomBytes(16).toString('hex');
    }

    // Random device simulation
    this.deviceInfo = this.generateRandomDevice();
    this.ipAddress = this.generateRandomIP();
  }

  private generateRandomDevice(): { type: string; userAgent: string } {
    const devices = [
      { type: 'desktop', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      { type: 'desktop', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      { type: 'mobile', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' },
      { type: 'mobile', userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' },
      { type: 'tablet', userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' }
    ];
    return devices[Math.floor(Math.random() * devices.length)];
  }

  private generateRandomIP(): string {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  private getHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': this.deviceInfo.userAgent,
      'X-Forwarded-For': this.ipAddress || '127.0.0.1',
      'X-Device-Type': this.deviceInfo.type,
      ...additionalHeaders
    };

    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<VelumApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        ...options,
        headers: this.getHeaders(options.headers as Record<string, string> || {})
      });

      const latency = Date.now() - startTime;
      const responseData: any = response.ok ? await response.json().catch(() => ({})) : await response.json().catch(() => ({ error: response.statusText }));

      const result: VelumApiResponse<T> = {
        success: response.ok,
        data: response.ok ? (responseData as T) : undefined,
        error: response.ok ? undefined : (responseData.error || response.statusText),
        statusCode: response.status,
        latency
      };

      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        error: (error as Error).message,
        latency
      };
    }
  }

  // Authentication
  async register(): Promise<VelumApiResponse<{ token: string; userId: number }>> {
    const result = await this.request<{ token: string; userId: number }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: this.credentials.username,
        password: this.credentials.password,
        panicPhrase: this.credentials.panicPhrase,
        safeWord: this.credentials.safeWord,
        salt: this.credentials.salt
      })
    });

    if (result.success && result.data?.token) {
      this.sessionToken = result.data.token;
      this.userId = result.data.userId;
    }

    return result;
  }

  async login(): Promise<VelumApiResponse<{ token: string; userId: number }>> {
    const result = await this.request<{ token: string; userId: number }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: this.credentials.username,
        password: this.credentials.password
      })
    });

    if (result.success && result.data?.token) {
      this.sessionToken = result.data.token;
      this.userId = result.data.userId;
    }

    return result;
  }

  async logout(): Promise<VelumApiResponse> {
    const result = await this.request('/auth/logout', {
      method: 'POST'
    });

    if (result.success) {
      this.sessionToken = undefined;
      this.userId = undefined;
    }

    return result;
  }

  // User Discovery
  async searchUsers(query: string = ''): Promise<VelumApiResponse<{ users: VelumUser[] }>> {
    const queryParams = query ? `?q=${encodeURIComponent(query)}` : '';
    return this.request<{ users: VelumUser[] }>(`/user/directory/search${queryParams}`);
  }

  async getUserProfile(userId: number): Promise<VelumApiResponse<VelumUser>> {
    return this.request<VelumUser>(`/user/${userId}/profile`);
  }

  // Lounge Discovery
  async getLounges(): Promise<VelumApiResponse<{ lounges: VelumLounge[] }>> {
    return this.request<{ lounges: VelumLounge[] }>('/lounges');
  }

  async getUserLounges(): Promise<VelumApiResponse<{ lounges: VelumLounge[] }>> {
    return this.request<{ lounges: VelumLounge[] }>('/lounges/user');
  }

  async getLoungeDetails(loungeId: string): Promise<VelumApiResponse<VelumLounge>> {
    return this.request<VelumLounge>(`/lounges/${loungeId}`);
  }

  async getLoungeRooms(loungeId: string): Promise<VelumApiResponse<VelumLounge[]>> {
    return this.request<VelumLounge[]>(`/lounges/${loungeId}/rooms`);
  }

  async getLoungeMembers(loungeId: string): Promise<VelumApiResponse<any[]>> {
    return this.request<any[]>(`/lounges/${loungeId}/members`);
  }

  // Lounge Actions
  async createLounge(name: string, description: string = '', isPrivate: boolean = false): Promise<VelumApiResponse<VelumLounge>> {
    return this.request<VelumLounge>('/lounges', {
      method: 'POST',
      body: JSON.stringify({ name, description, is_private: isPrivate })
    });
  }

  async createSublounge(parentLoungeId: string, name: string, description: string = ''): Promise<VelumApiResponse<VelumLounge>> {
    return this.request<VelumLounge>(`/lounges/${parentLoungeId}/sublounges`, {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });
  }

  async joinLounge(loungeId: string): Promise<VelumApiResponse> {
    return this.request('/lounges/join', {
      method: 'POST',
      body: JSON.stringify({ lounge_id: loungeId })
    });
  }

  async leaveLounge(loungeId: string): Promise<VelumApiResponse> {
    return this.request(`/lounges/${loungeId}/leave`, {
      method: 'POST'
    });
  }

  // Messaging
  async getMessages(loungeId: string, limit: number = 50): Promise<VelumApiResponse<VelumMessage[]>> {
    return this.request<VelumMessage[]>(`/lounges/${loungeId}/messages?limit=${limit}`);
  }

  async sendMessage(loungeId: string, message: string): Promise<VelumApiResponse<VelumMessage>> {
    // Use the actual room ID (slug or lounge_id format)
    const roomId = loungeId;
    return this.request<VelumMessage>(`/lounges/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: message })
    });
  }

  // User Actions
  async blockUser(targetUserId: number): Promise<VelumApiResponse<{ success: boolean; isBlocked: boolean }>> {
    return this.request<{ success: boolean; isBlocked: boolean }>(`/user/${targetUserId}/block`, {
      method: 'POST'
    });
  }

  async muteUser(targetUserId: number): Promise<VelumApiResponse<{ success: boolean; isMuted: boolean }>> {
    return this.request<{ success: boolean; isMuted: boolean }>(`/user/${targetUserId}/mute`, {
      method: 'POST'
    });
  }

  async reportUser(targetUserId: number, reason: string): Promise<VelumApiResponse> {
    return this.request('/user/report', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, reason })
    });
  }

  async deleteChat(targetUserId: number): Promise<VelumApiResponse> {
    return this.request(`/user/${targetUserId}/chat`, {
      method: 'DELETE'
    });
  }

  // Profile
  async updateProfile(data: { displayName?: string; bio?: string; avatar?: string }): Promise<VelumApiResponse> {
    return this.request('/user/profile', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async uploadAvatar(avatarData: Buffer): Promise<VelumApiResponse<{ url: string }>> {
    const url = `${this.baseUrl}/user/upload-avatar`;
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders({
          'Content-Type': 'image/webp'
        }),
        body: new Uint8Array(avatarData)
      });

      const latency = Date.now() - startTime;
      const responseData: any = response.ok ? await response.json().catch(() => ({})) : await response.json().catch(() => ({ error: response.statusText }));

      const result: VelumApiResponse<{ url: string }> = {
        success: response.ok,
        data: response.ok ? (responseData as { url: string }) : undefined,
        error: response.ok ? undefined : (responseData.error || response.statusText),
        statusCode: response.status,
        latency
      };

      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        error: (error as Error).message,
        latency
      };
    }
  }

  async markAsRead(loungeId: string, messageId: string): Promise<VelumApiResponse> {
    return this.request(`/lounges/${loungeId}/read`, {
      method: 'POST',
      body: JSON.stringify({ last_read_msg_id: messageId, last_read_seq: null })
    });
  }

  // Tickets
  async createTicket(reason: string, description: string): Promise<VelumApiResponse<{ ticket_id?: string; id?: string }>> {
    return this.request('/tickets', {
      method: 'POST',
      body: JSON.stringify({ reason, issueType: description })
    });
  }

  // Account Management
  async deleteAccount(): Promise<VelumApiResponse> {
    return this.request('/user/me', {
      method: 'DELETE'
    });
  }

  // Session helpers
  isAuthenticated(): boolean {
    return !!this.sessionToken;
  }

  getUserId(): number | undefined {
    return this.userId;
  }

  getUsername(): string {
    return this.credentials.username;
  }

  getSessionToken(): string | undefined {
    return this.sessionToken;
  }
}