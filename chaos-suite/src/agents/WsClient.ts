import WebSocket from 'ws';

export type WsHandler = (msg: Record<string, unknown>) => void;

/**
 * Thin Velum /ws client for chaos peer proofs.
 * Connect: ws://host/ws?userId=&sessionId= (raw session token).
 */
export class WsClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private handlers: WsHandler[] = [];
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private userId: number,
    private sessionId: string,
    private baseUrl: string = 'ws://localhost:3000/ws'
  ) {}

  connect(timeoutMs = 10000): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
        resolve(true);
        return;
      }

      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(ok);
      };

      const timer = setTimeout(() => {
        try {
          this.ws?.close();
        } catch {
          /* ignore */
        }
        done(false);
      }, timeoutMs);

      const url = `${this.baseUrl}?userId=${this.userId}&sessionId=${encodeURIComponent(this.sessionId)}`;
      try {
        this.ws = new WebSocket(url);
      } catch {
        done(false);
        return;
      }

      this.ws.on('open', () => {
        this.connected = true;
        this.startHeartbeat();
        done(true);
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;
          for (const h of this.handlers) h(msg);
        } catch {
          /* ignore parse errors */
        }
      });

      this.ws.on('error', () => {
        if (!this.connected) done(false);
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.stopHeartbeat();
        if (!settled) done(false);
      });
    });
  }

  onMessage(handler: WsHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  /**
   * Wait until a message matches predicate, or timeout.
   */
  waitFor(
    pred: (msg: Record<string, unknown>) => boolean,
    timeoutMs = 15000
  ): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (msg: Record<string, unknown> | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        off();
        resolve(msg);
      };

      const timer = setTimeout(() => finish(null), timeoutMs);
      const off = this.onMessage((msg) => {
        if (pred(msg)) finish(msg);
      });
    });
  }

  joinRoom(roomId: string): boolean {
    return this.send({ type: 'join_room', room_id: roomId });
  }

  /** Direct message via WS — peer receives type: 'dm'. */
  sendDm(toUserId: number, body: string): boolean {
    return this.send({ type: 'dm', to: toUserId, body });
  }

  sendLoungeMessage(roomId: string, content: string): boolean {
    return this.send({
      type: 'send_message',
      room_id: roomId,
      content,
    });
  }

  send(data: object): boolean {
    if (this.ws && this.connected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.connected = false;
    this.handlers = [];
  }

  isOpen(): boolean {
    return this.connected && !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping', sentAt: Date.now() });
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

export function httpBaseToWsUrl(apiBase: string): string {
  try {
    const cleaned = apiBase.replace(/\/v2\/?$/, '').replace(/\/api\/v2\/?$/, '');
    const u = new URL(cleaned);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.pathname = '/ws';
    u.search = '';
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return 'ws://localhost:3000/ws';
  }
}
