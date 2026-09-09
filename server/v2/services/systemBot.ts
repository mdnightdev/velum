import { broadcastToRoom, connectedClients, broadcastToUserDevices } from '../../websocket.js';
import { dmService } from './dmService.js';
import { BotTemplates } from './botTemplates.js';
import { incrementUnread } from '../../websocket/unreadManager.js';

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
    this.sendToUser(userId, BotTemplates.emergencyPanicExecuted());
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
    let created: Awaited<ReturnType<typeof dmService.sendMessage>> | null = null;

    try {
      created = await dmService.sendMessage(999, userId, message, false);
    } catch (err) {
      console.error('[SystemBot] Failed to persist bot message:', err);
    }

    try {
      await incrementUnread(userId, roomId);
    } catch (err) {
      console.error('[SystemBot] Failed to increment unread:', err);
    }

    const createdAt = created?.created
      ? (created.created instanceof Date ? created.created.toISOString() : String(created.created))
      : new Date().toISOString();

    const outFrame = {
      type: 'dm',
      id: created?.id,
      message_id: created?.id != null ? String(created.id) : undefined,
      db_message_id: created?.id,
      from: 999,
      to: userId,
      body: created?.body || message,
      enc: false,
      created: createdAt,
      sender_username: 'Velum',
      room_id: roomId
    };

    broadcastToUserDevices(userId, outFrame);
  }
}

export const systemBot = SystemBot.getInstance();