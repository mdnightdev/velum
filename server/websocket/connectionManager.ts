import type { WebSocket } from 'ws';
import type { ClientConnection } from './types.js';

export const connectedClients = new Map<WebSocket, ClientConnection>();
export const roomMembers = new Map<string, Set<WebSocket>>();

let lastServerEventTimestamp = Date.now();
let totalReconnectEvents = 0;

export function recordServerEventTimestamp() {
  lastServerEventTimestamp = Date.now();
}

export function incrementReconnectCount() {
  totalReconnectEvents++;
}

export function getWebSocketDiagnostics() {
  const activeSessions = new Set<string>();
  for (const client of connectedClients.values()) {
    if (client && client.sessionId) {
      activeSessions.add(client.sessionId);
    }
  }
  return {
    activeConnections: connectedClients.size,
    activeSessionsCount: activeSessions.size,
    activeRoomsCount: roomMembers.size,
    reconnectCount: totalReconnectEvents,
    lastServerEventTimestamp
  };
}

export function broadcastToRoom(roomId: string, message: any, excludeWs?: WebSocket) {
  const members = roomMembers.get(roomId);
  if (!members) return;

  const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
  members.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === ws.OPEN) {
      ws.send(msgStr);
    }
  });
}

export function broadcastToUserDevices(userId: number, payload: any, excludeWs?: WebSocket) {
  const msgStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const [ws, clientData] of connectedClients.entries()) {
    if (clientData && clientData.userId === userId && ws !== excludeWs && ws.readyState === ws.OPEN) {
      ws.send(msgStr);
    }
  }
}
