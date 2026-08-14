import { broadcastToRoom, connectedClients, getOrCreateDMLounge } from '../../websocket.js';
import { db } from '../db/client.js';
import { messages as dbMessages } from '../db/schema/lounges.js';

export class SystemBot {
  private static instance: SystemBot;
  
  private constructor() {}
  
  static getInstance(): SystemBot {
    if (!SystemBot.instance) {
      SystemBot.instance = new SystemBot();
    }
    return SystemBot.instance;
  }
  
  sendBroadcast(roomId: string, message: string, sender: string = 'System') {
    const broadcastMessage = {
      type: 'broadcast',
      sender,
      message,
      room_id: roomId,
      timestamp: new Date().toISOString()
    };
    
    broadcastToRoom(roomId, broadcastMessage);
  }
  
  sendSystemAlert(roomId: string, message: string) {
    const alertMessage = {
      type: 'system_alert',
      message,
      room_id: roomId,
      timestamp: new Date().toISOString()
    };
    
    broadcastToRoom(roomId, alertMessage);
  }
  
  sendToAll(message: string) {
    const broadcastMessage = {
      type: 'broadcast',
      sender: 'System',
      message,
      timestamp: new Date().toISOString()
    };
    
    // Send to all connected clients
    connectedClients.forEach((client) => {
      if (client.ws.readyState === 1) { // WebSocket.OPEN
        client.ws.send(JSON.stringify(broadcastMessage));
      }
    });
  }

  dispatchHealthAlert(level: 'INFO' | 'WARNING' | 'CRITICAL', message: string, details?: any) {
    const alertMessage = {
      type: 'system_health_alert',
      level,
      message,
      details,
      timestamp: new Date().toISOString()
    };
    this.sendSystemAlert('admin_control_desk', `[HEALTH_${level}] ${message}`);
  }

  dispatchPanicAlert(userId: number, ticketId: string, reason: string) {
    const panicEvent = {
      type: 'duress_panic_alert',
      userId,
      ticketId,
      reason,
      timestamp: new Date().toISOString()
    };
    this.sendSystemAlert('admin_control_desk', `[DURESS_ALERT] User ${userId} triggered panic protocol. Ticket: ${ticketId}`);
    this.sendToUser(userId, `[SECURITY_SYSTEM] Emergency panic protocol executed. Reference ticket: ${ticketId}`);
  }

  dispatchAdminEscalation(ticketId: string, priority: string, details: string) {
    const escalationEvent = {
      type: 'admin_escalation',
      ticketId,
      priority,
      details,
      timestamp: new Date().toISOString()
    };
    this.sendSystemAlert('admin_control_desk', `[ESCALATION_${priority}] Ticket ${ticketId}: ${details}`);
  }
  
  async sendToUser(userId: number, message: string) {
    const roomId = `dm_velum_${userId}`;
    const messageData = {
      room_id: roomId,
      content: message,
      user_id: 999,
      username: 'Velum',
      timestamp: new Date().toISOString()
    };
    
    connectedClients.forEach((client) => {
      if (client.userId === userId && client.ws.readyState === 1) {
        client.ws.send(JSON.stringify(messageData));
      }
    });

    try {
      const loungeId = await getOrCreateDMLounge(roomId);
      if (loungeId) {
        await db.insert(dbMessages).values({
          loungeId,
          senderId: 999,
          content: message,
          encrypted: false
        });
      }
    } catch (err) {
      console.error('[SystemBot] Failed to persist bot message:', err);
    }
  }
}

export const systemBot = SystemBot.getInstance();