import type { WebSocket } from 'ws';

export interface ClientConnection {
  ws: WebSocket;
  userId: number;
  username: string;
  avatarUrl: string;
  sessionId: string;
  rooms: Set<string>;
}

export interface LeakyBucketState {
  tokens: number;
  lastRefill: number;
}
