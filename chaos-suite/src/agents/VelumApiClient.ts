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

export interface VelumAuthUser {
  userId: number;
  username: string;
  role?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  salt?: string;
}

export interface VelumAuthPayload {
  token: string;
  user: VelumAuthUser;
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

  private applyAuthPayload(data: VelumAuthPayload | undefined): boolean {
    if (!data?.token || data.user?.userId == null) return false;
    this.sessionToken = data.token;
    this.userId = Number(data.user.userId);
    return Number.isFinite(this.userId);
  }

  clearSession(): void {
    this.sessionToken = undefined;
    this.userId = undefined;
  }

  setCredentials(credentials: VelumCredentials): void {
    this.credentials = credentials;
    this.clearSession();
  }

  async register(): Promise<VelumApiResponse<VelumAuthPayload>> {
    const result = await this.request<VelumAuthPayload>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: this.credentials.username,
        password: this.credentials.password,
        panicPhrase: this.credentials.panicPhrase,
      }),
    });

    if (result.success) {
      if (!this.applyAuthPayload(result.data)) {
        return {
          success: false,
          error: 'Register OK but missing token or user.userId',
          statusCode: result.statusCode,
          latency: result.latency,
        };
      }
    }

    return result;
  }

  async login(): Promise<VelumApiResponse<VelumAuthPayload>> {
    const result = await this.request<VelumAuthPayload>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: this.credentials.username,
        password: this.credentials.password,
      }),
    });

    if (result.success) {
      if (!this.applyAuthPayload(result.data)) {
        return {
          success: false,
          error: 'Login OK but missing token or user.userId',
          statusCode: result.statusCode,
          latency: result.latency,
        };
      }
    }

    return result;
  }

  async logout(): Promise<VelumApiResponse> {
    const result = await this.request('/auth/logout', {
      method: 'POST',
    });

    this.clearSession();
    return result;
  }


  async ping(): Promise<VelumApiResponse<{ status?: string }>> {
    return this.request<{ status?: string }>('/health', { method: 'GET' });
  }

  async searchUsers(query: string = ''): Promise<VelumApiResponse<{ users: VelumUser[] }>> {
    const queryParams = query ? `?q=${encodeURIComponent(query)}` : '';
    return this.request<{ users: VelumUser[] }>(`/user/directory/search${queryParams}`);
  }

  async getUserProfile(userId: number): Promise<VelumApiResponse<VelumUser>> {
    return this.request<VelumUser>(`/user/${userId}/profile`);
  }

  async getLounges(): Promise<VelumApiResponse<{ lounges: VelumLounge[] }>> {
    return this.request<{ lounges: VelumLounge[] }>('/lounges');
  }

  async getUserLounges(): Promise<VelumApiResponse<{ lounges: VelumLounge[] }>> {
    return this.request<{ lounges: VelumLounge[] }>('/lounges/user');
  }

  async getLoungeDetails(loungeId: string): Promise<VelumApiResponse<VelumLounge>> {
    const res = await this.request<{ lounge: VelumLounge }>(`/lounges/${loungeId}`);
    if (!res.success) {
      return { success: false, error: res.error, statusCode: res.statusCode, latency: res.latency };
    }
    if (!res.data?.lounge) {
      return {
        success: false,
        error: 'Missing lounge in details response',
        statusCode: res.statusCode,
        latency: res.latency,
      };
    }
    return { success: true, data: res.data.lounge, statusCode: res.statusCode, latency: res.latency };
  }

  async getLoungeRooms(loungeId: string): Promise<VelumApiResponse<{ rooms: VelumLounge[] }>> {
    return this.request<{ rooms: VelumLounge[] }>(`/lounges/${loungeId}/rooms`);
  }

  async getLoungeMembers(loungeId: string): Promise<VelumApiResponse<any[]>> {
    return this.request<any[]>(`/lounges/${loungeId}/members`);
  }

  async createLounge(
    name: string,
    description: string = '',
    isPrivate: boolean = false
  ): Promise<VelumApiResponse<VelumLounge>> {
    const res = await this.request<{ lounge: VelumLounge }>('/lounges', {
      method: 'POST',
      body: JSON.stringify({ name, description, is_private: isPrivate }),
    });
    if (!res.success) {
      return { success: false, error: res.error, statusCode: res.statusCode, latency: res.latency };
    }
    if (!res.data?.lounge) {
      return {
        success: false,
        error: 'Missing lounge in create response',
        statusCode: res.statusCode,
        latency: res.latency,
      };
    }
    return { success: true, data: res.data.lounge, statusCode: res.statusCode, latency: res.latency };
  }

  async createSublounge(
    parentLoungeId: string,
    name: string,
    description: string = ''
  ): Promise<VelumApiResponse<VelumLounge>> {
    const res = await this.request<{ lounge?: VelumLounge; sublounge?: VelumLounge }>(
      `/lounges/${parentLoungeId}/sublounges`,
      {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      }
    );
    if (!res.success) {
      return { success: false, error: res.error, statusCode: res.statusCode, latency: res.latency };
    }
    const created = res.data?.sublounge || res.data?.lounge;
    if (!created) {
      return {
        success: false,
        error: 'Missing sublounge in create response',
        statusCode: res.statusCode,
        latency: res.latency,
      };
    }
    return { success: true, data: created, statusCode: res.statusCode, latency: res.latency };
  }

  async joinLounge(loungeId: string): Promise<VelumApiResponse> {
    return this.request('/lounges/join', {
      method: 'POST',
      body: JSON.stringify({ lounge_id: loungeId }),
    });
  }

  async getMessages(
    loungeId: string,
    limit: number = 50
  ): Promise<VelumApiResponse<VelumMessage[]>> {
    const res = await this.request<{ messages: VelumMessage[] }>(
      `/lounges/${loungeId}/messages?limit=${limit}`
    );
    if (!res.success) {
      return { success: false, error: res.error, statusCode: res.statusCode, latency: res.latency };
    }
    const list = Array.isArray(res.data?.messages) ? res.data!.messages : [];
    return { success: true, data: list, statusCode: res.statusCode, latency: res.latency };
  }

  async sendMessage(
    loungeId: string,
    message: string
  ): Promise<VelumApiResponse<VelumMessage>> {
    const res = await this.request<{ message: VelumMessage }>(`/lounges/${loungeId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: message }),
    });
    if (!res.success) {
      return { success: false, error: res.error, statusCode: res.statusCode, latency: res.latency };
    }
    if (!res.data?.message) {
      return {
        success: false,
        error: 'Missing message in post response',
        statusCode: res.statusCode,
        latency: res.latency,
      };
    }
    return { success: true, data: res.data.message, statusCode: res.statusCode, latency: res.latency };
  }

  async sendFriendRequest(opts: {
    targetUserId?: number;
    username?: string;
  }): Promise<VelumApiResponse<{ success?: boolean; message?: string }>> {
    const body: Record<string, string | number> = {};
    if (opts.targetUserId != null) body.targetUserId = opts.targetUserId;
    if (opts.username) body.receiverUsername = opts.username;
    return this.request<{ success?: boolean; message?: string }>('/friends/request', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getFriendRequests(): Promise<
    VelumApiResponse<{
      requests: Array<{
        request_id: string;
        sender_id: number;
        sender_name?: string;
        status?: string;
      }>;
    }>
  > {
    return this.request('/friends/requests');
  }

  async acceptFriendRequest(
    requestId: string | number
  ): Promise<VelumApiResponse<{ success?: boolean; message?: string }>> {
    return this.request(`/friends/accept/${requestId}`, { method: 'POST', body: '{}' });
  }

  async getFriendRelationships(): Promise<
    VelumApiResponse<{
      relationships: Array<{
        friendId?: number;
        friend_id?: number;
        peerId?: number;
        peer_id?: number;
        username?: string;
        status?: string;
      }>;
    }>
  > {
    return this.request('/friends/relationships');
  }

  async sendDm(
    peerId: number,
    body: string
  ): Promise<VelumApiResponse<{ message?: unknown }>> {
    return this.request(`/dm/${peerId}`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

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

  async updateProfile(data: {
    displayName?: string;
    bio?: string;
    avatar?: string;
    avatarUrl?: string;
  }): Promise<VelumApiResponse> {
    return this.request('/user/profile', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async uploadMedia(
    mediaData: Buffer,
    contentType: string
  ): Promise<VelumApiResponse<{ url: string }>> {
    const url = `${this.baseUrl}/user/upload-media`;
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders({
          'Content-Type': contentType,
        }),
        body: new Uint8Array(mediaData),
      });

      const latency = Date.now() - startTime;
      const responseData: any = response.ok
        ? await response.json().catch(() => ({}))
        : await response.json().catch(() => ({ error: response.statusText }));

      const uploadedUrl =
        typeof responseData?.url === 'string' ? responseData.url : undefined;

      return {
        success: response.ok && !!uploadedUrl,
        data: response.ok && uploadedUrl ? { url: uploadedUrl } : undefined,
        error: response.ok
          ? uploadedUrl
            ? undefined
            : 'Missing url in upload response'
          : responseData.error || response.statusText,
        statusCode: response.status,
        latency,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        latency: Date.now() - startTime,
      };
    }
  }

  async uploadAvatar(
    avatarData: Buffer,
    contentType: string = 'image/jpeg'
  ): Promise<VelumApiResponse<{ url: string }>> {
    const url = `${this.baseUrl}/user/upload-avatar`;
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders({
          'Content-Type': contentType,
        }),
        body: new Uint8Array(avatarData),
      });

      const latency = Date.now() - startTime;
      const responseData: any = response.ok
        ? await response.json().catch(() => ({}))
        : await response.json().catch(() => ({ error: response.statusText }));

      const uploadedUrl =
        typeof responseData?.url === 'string'
          ? responseData.url
          : typeof responseData?.avatarUrl === 'string'
            ? responseData.avatarUrl
            : undefined;

      const result: VelumApiResponse<{ url: string }> = {
        success: response.ok && !!uploadedUrl,
        data: response.ok && uploadedUrl ? { url: uploadedUrl } : undefined,
        error: response.ok
          ? uploadedUrl
            ? undefined
            : 'Missing url in upload response'
          : responseData.error || response.statusText,
        statusCode: response.status,
        latency,
      };

      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        error: (error as Error).message,
        latency,
      };
    }
  }

  async markAsRead(loungeId: string, messageId: string): Promise<VelumApiResponse> {
    return this.request(`/lounges/${loungeId}/read`, {
      method: 'POST',
      body: JSON.stringify({ last_read_msg_id: messageId, last_read_seq: null })
    });
  }

  async createTicket(reason: string, description: string): Promise<VelumApiResponse<{ ticket_id?: string; id?: string }>> {
    return this.request('/tickets', {
      method: 'POST',
      body: JSON.stringify({ reason, issueType: description })
    });
  }

  async deleteAccount(): Promise<VelumApiResponse> {
    return this.request('/user/me', {
      method: 'DELETE'
    });
  }

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
