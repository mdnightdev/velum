import WebSocket from 'ws';
import { Telemetry } from '../telemetry/Telemetry.js';

export class WsClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private telemetry = Telemetry.getInstance();

  constructor(
    private userId: number,
    private sessionId: string,
    private baseUrl: string = 'ws://localhost:3000/ws'
  ) {}

  public connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnected && this.ws) {
        return resolve(true);
      }

      const url = `${this.baseUrl}?userId=${this.userId}&sessionId=${this.sessionId}`;
      try {
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          this.isConnected = true;
          this.telemetry.wsConnected();
          this.startHeartbeat();
          resolve(true);
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.telemetry.wsMessageReceived();
        });

        this.ws.on('error', (err) => {
          this.telemetry.wsError();
          if (!this.isConnected) {
            resolve(false);
          }
        });

        this.ws.on('close', () => {
          this.isConnected = false;
          this.telemetry.wsDisconnected();
          this.stopHeartbeat();
        });
      } catch (err) {
        this.telemetry.wsError();
        resolve(false);
      }
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', sentAt: Date.now() });
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public joinRoom(roomId: string): void {
    this.send({ type: 'join_room', room_id: roomId });
  }

  public startTyping(roomId: string): void {
    this.send({ type: 'typing_start', room_id: roomId });
  }

  public stopTyping(roomId: string): void {
    this.send({ type: 'typing_stop', room_id: roomId });
  }

  public sendWsMessage(roomId: string, content: string, senderName: string): void {
    this.send({
      type: 'send_message',
      room_id: roomId,
      content,
      sender: senderName,
      senderId: this.userId
    });
  }

  public send(data: object): boolean {
    if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      this.telemetry.wsMessageSent();
      return true;
    }
    return false;
  }

  public disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
  }

  public getConnected(): boolean {
    return this.isConnected;
  }
}
