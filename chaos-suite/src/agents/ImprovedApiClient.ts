import { DEVICE_TYPES } from '../config/agentConfig.js';
import { chaosLogger } from '../utils/logger.js';
import crypto from 'crypto';

// Simple random number generator
const random = () => Math.random();

// Generate proper cryptographic salt
const generateSalt = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

export interface AgentCredentials {
  username: string;
  password: string;
  panicPhrase: string;
  safeWord: string;
  salt?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export class ImprovedApiClient {
  private baseUrl = 'http://localhost:3000/v2';
  private credentials: AgentCredentials;
  private currentToken?: string;
  private deviceInfo: { type: string; userAgent: string };
  private ipAddress?: string;

  constructor(credentials: AgentCredentials, deviceIndex?: number) {
    this.credentials = credentials;
    // Only generate salt if not provided (for new registrations)
    if (!this.credentials.salt) {
      this.credentials.salt = generateSalt();
    }
    // Random device assignment
    const deviceIndexToUse = deviceIndex !== undefined ? deviceIndex : Math.floor(Math.random() * DEVICE_TYPES.length);
    this.deviceInfo = DEVICE_TYPES[deviceIndexToUse];
    // Simulate random IP address
    this.ipAddress = this.generateRandomIP();
  }

  private generateRandomIP(): string {
    return `${Math.floor(random() * 255)}.${Math.floor(random() * 255)}.${Math.floor(random() * 255)}.${Math.floor(random() * 255)}`;
  }

  private getHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': this.deviceInfo.userAgent,
      'X-Forwarded-For': this.ipAddress || '127.0.0.1',
      'X-Device-Type': this.deviceInfo.type,
      ...additionalHeaders
    };

    if (this.currentToken) {
      headers['Authorization'] = `Bearer ${this.currentToken}`;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = Date.now();

    try {
      // Log the full request details for debugging
      const bodyData = options.body ? JSON.parse(options.body as string) : {};
      chaosLogger.log('DEBUG', this.credentials.username, 
        `REQUEST: ${options.method || 'GET'} ${url} - Body: ${JSON.stringify(bodyData)}`,
        { body: bodyData, headers: this.getHeaders(options.headers as Record<string, string> || {}) }
      );

      const response = await fetch(url, {
        ...options,
        headers: this.getHeaders(options.headers as Record<string, string> || {})
      });

      const duration = Date.now() - startTime;
      const responseData: any = await response.json().catch(() => ({}));

      // Log the full response for debugging
      chaosLogger.log('DEBUG', this.credentials.username, 
        `RESPONSE: ${response.status} (${duration}ms) - ${responseData.error || responseData.message || 'No error message'}`,
        { 
          status: response.status, 
          ok: response.ok, 
          data: responseData,
          headers: Object.fromEntries(response.headers.entries())
        }
      );

      const result: ApiResponse<T> = {
        success: response.ok,
        data: response.ok ? (responseData as T) : undefined,
        error: response.ok ? undefined : (responseData.error || response.statusText),
        statusCode: response.status
      };

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      chaosLogger.recordError(
        this.credentials.username,
        `${options.method || 'GET'} ${endpoint}`,
        (error as Error).message,
        endpoint,
        undefined
      );

      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  setToken(token: string): void {
    this.currentToken = token;
  }

  getToken(): string | undefined {
    return this.currentToken;
  }

  clearToken(): void {
    this.currentToken = undefined;
  }

  // Authentication
  async register(): Promise<ApiResponse<{ token: string; userId: number }>> {
    // Registration requires username, password, panicPhrase, safeWord, and salt
    const result = await this.request<{ token: string; userId: number }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: this.credentials.username,
        password: this.credentials.password,
        panicPhrase: this.credentials.panicPhrase,
        safeWord: this.credentials.safeWord,
        salt: this.credentials.salt || generateSalt()
      })
    });

    if (result.success && result.data?.token) {
      this.currentToken = result.data.token;
      chaosLogger.recordSessionToken(this.credentials.username, result.data.token);
    }

    return result;
  }

  async login(): Promise<ApiResponse<{ token: string; userId: number }>> {
    const result = await this.request<{ token: string; userId: number }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: this.credentials.username,
        password: this.credentials.password
      })
    });

    if (result.success && result.data?.token) {
      this.currentToken = result.data.token;
      chaosLogger.recordSessionToken(this.credentials.username, result.data.token);
    }

    return result;
  }

  async loginWithPanicPhrase(): Promise<ApiResponse<{ token: string; userId: number }>> {
    const result = await this.request<{ token: string; userId: number }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: this.credentials.username,
        panicPhrase: this.credentials.panicPhrase
      })
    });

    if (result.success && result.data?.token) {
      this.currentToken = result.data.token;
      chaosLogger.recordSessionToken(this.credentials.username, result.data.token);
    }

    return result;
  }

  async logout(): Promise<ApiResponse> {
    const result = await this.request('/auth/logout', {
      method: 'POST'
    });

    if (result.success) {
      this.clearToken();
    }

    return result;
  }

  // Lounge operations
  async createLounge(name: string, description: string, isPrivate: boolean = false): Promise<ApiResponse<{ loungeId: string }>> {
    const result = await this.request<{ loungeId: string }>('/lounges', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        is_private: isPrivate
      })
    });

    if (result.success) {
      chaosLogger.recordLoungeCreation(this.credentials.username, result.data?.loungeId || 'unknown');
    }

    return result;
  }

  async joinLounge(loungeId: string): Promise<ApiResponse> {
    const result = await this.request(`/lounges/${loungeId}/join`, {
      method: 'POST'
    });

    if (result.success) {
      chaosLogger.recordLoungeJoin(this.credentials.username, loungeId);
    }

    return result;
  }

  async leaveLounge(loungeId: string): Promise<ApiResponse> {
    return this.request(`/lounges/${loungeId}/leave`, {
      method: 'POST'
    });
  }

  async getLounges(): Promise<ApiResponse<any[]>> {
    return this.request('/lounges');
  }

  // Messaging
  async sendMessage(loungeId: string, message: string): Promise<ApiResponse> {
    return this.request(`/lounges/${loungeId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }

  async getMessages(loungeId: string, limit: number = 50): Promise<ApiResponse<any[]>> {
    return this.request(`/lounges/${loungeId}/messages?limit=${limit}`);
  }

  // User interactions
  async muteUser(targetUserId: number): Promise<ApiResponse<{ isMuted: boolean }>> {
    return this.request(`/user/${targetUserId}/mute`, {
      method: 'POST'
    });
  }

  async blockUser(targetUserId: number): Promise<ApiResponse<{ isBlocked: boolean }>> {
    return this.request(`/user/${targetUserId}/block`, {
      method: 'POST'
    });
  }

  async unblockUser(targetUserId: number): Promise<ApiResponse<{ isBlocked: boolean }>> {
    return this.request(`/user/${targetUserId}/block`, {
      method: 'POST' // Toggle endpoint
    });
  }

  async deleteChat(targetUserId: number): Promise<ApiResponse> {
    return this.request(`/user/${targetUserId}/chat`, {
      method: 'DELETE'
    });
  }

  async reportUser(targetUserId: number, reason: string): Promise<ApiResponse> {
    return this.request('/user/report', {
      method: 'POST',
      body: JSON.stringify({
        targetUserId,
        reason
      })
    });
  }

  async getUserProfile(userId: number): Promise<ApiResponse> {
    return this.request(`/user/${userId}/profile`);
  }

  async searchUsers(query: string): Promise<ApiResponse<any[]>> {
    return this.request(`/user/directory/search?q=${encodeURIComponent(query)}`);
  }

  // Sanctions (admin features)
  async sanctionUser(targetUserId: number, sanctionType: string, reason: string, duration?: number): Promise<ApiResponse> {
    return this.request(`/admin/users/${targetUserId}/sanction`, {
      method: 'POST',
      body: JSON.stringify({
        sanctionType,
        reason,
        duration
      })
    });
  }

  // Tickets
  async createTicket(reason: string, issueType: string): Promise<ApiResponse<{ ticketId: string }>> {
    return this.request('/tickets', {
      method: 'POST',
      body: JSON.stringify({
        reason,
        issueType
      })
    });
  }

  async getTickets(): Promise<ApiResponse<any[]>> {
    return this.request('/tickets');
  }

  // Account management
  async requestAccountDeletion(): Promise<ApiResponse> {
    return this.request('/user/me', {
      method: 'DELETE'
    });
  }

  async updateProfile(data: {
    displayName?: string;
    bio?: string;
    avatar?: string;
    location?: string;
  }): Promise<ApiResponse> {
    return this.request('/user/profile', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Friend operations
  async sendFriendRequest(username: string): Promise<ApiResponse> {
    return this.request('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ username })
    });
  }

  async acceptFriendRequest(requestId: number): Promise<ApiResponse> {
    return this.request(`/friends/accept/${requestId}`, {
      method: 'POST'
    });
  }

  async rejectFriendRequest(requestId: number): Promise<ApiResponse> {
    return this.request(`/friends/reject/${requestId}`, {
      method: 'POST'
    });
  }

  async getFriends(): Promise<ApiResponse<any[]>> {
    return this.request('/friends');
  }

  // Direct messaging
  async sendDirectMessage(targetUserId: number, message: string): Promise<ApiResponse> {
    return this.request('/messages/direct', {
      method: 'POST',
      body: JSON.stringify({
        targetUserId,
        message
      })
    });
  }

  // System operations
  async getHealthStatus(): Promise<ApiResponse> {
    return this.request('/health');
  }

  async getSystemStatus(): Promise<ApiResponse> {
    return this.request('/system/status');
  }

  // Edge case testing
  async testInvalidEndpoint(): Promise<ApiResponse> {
    return this.request('/invalid/endpoint');
  }

  async testMalformedData(endpoint: string, malformedData: any): Promise<ApiResponse> {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(malformedData)
    });
  }

  async testRateLimit(): Promise<ApiResponse> {
    // Rapid fire requests to test rate limiting
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(this.sendMessage('1', `Rate limit test message ${i}`));
    }
    await Promise.all(promises);
    return { success: true };
  }

  // Device and IP simulation helpers
  switchDevice(): void {
    const randomDevice = DEVICE_TYPES[Math.floor(Math.random() * DEVICE_TYPES.length)];
    this.deviceInfo = randomDevice;
    this.ipAddress = this.generateRandomIP();
  }

  getDeviceInfo(): { type: string; userAgent: string; ipAddress?: string } {
    return {
      ...this.deviceInfo,
      ipAddress: this.ipAddress
    };
  }
}