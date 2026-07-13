import { Request, Response } from 'express';
import crypto from 'crypto';
import { db, loadDb, saveDb, ensureVelumSystemDM, executeCliCommand, hashArgon2id } from '../db.js';
import { broadcastToRoom, connectedClients } from '../websocket.js';
import { generatePrefixedId } from '../utils/ulid.js';
import { User, Ticket, Session, AdminSanction, Invite } from '../../src/types.js';


export const broadcastMessage = async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const admin = (req as any).adminUser;

    if (!content) {
      return res.status(400).json({ error: 'Missing broadcast content' });
    }

    loadDb();

    // Find standard registered users to receive the transmission
    const registeredUsers = db.users.filter(u => {
      const isSensitive = u.role === 'CLI_ADMIN' || 
                          u.role === 'LOGIN_ADMIN' || 
                          u.role === 'SUPPORT_ADMIN' || 
                          (u.role as string) === 'SYSTEM' ||
                          u.username.toLowerCase() === 'velum' ||
                          u.username.toLowerCase() === '@velum' ||
                          u.username.toLowerCase() === 'cli' ||
                          u.username.toLowerCase().startsWith('sa-');
      return !isSensitive;
    });

    registeredUsers.forEach(u => {
      const roomId = `dm_velum_${u.user_id}`;
      ensureVelumSystemDM(u.user_id, u.username);

      // Broadcast is sent from VELUM (User 999) without disclosing who actually triggered it (admin details hidden)
      const broadcastMsg = {
        message_id: generatePrefixedId('msg_broadcast'),
        lounge_id: 'dm',
        room_id: roomId,
        user_id: 999, // VELUM System Bot
        content: content,
        is_encrypted: false,
        reply_to: null,
        timestamp: new Date().toISOString(),
        expires_in: null,
        status: 'sent' as const
      };

      db.messages.push(broadcastMsg);

      const responsePayload = {
        ...broadcastMsg,
        username: 'VELUM',
        avatar: 'emerald'
      };

      // Live transmit to room
      broadcastToRoom(roomId, responsePayload);

      // Direct real-time propagation to socket client
      connectedClients.forEach(c => {
        if (c.user_id === u.user_id && !c.rooms.has(roomId) && c.ws && c.ws.readyState === 1) {
          c.ws.send(JSON.stringify(responsePayload));
        }
      });
    });

    // Log who actually issued it (admin audit logging - visible behind the scenes to admins)
    db.audit_logs.push({
      log_id: `${generatePrefixedId('al')}_bdc_trigger`,
      admin_id: admin.user_id,
      admin_name: admin.username,
      action: 'restore',
      target_type: 'system',
      target_id: '999',
      reason: `Velum broadcast dispatched by admin "${admin.username}". Body: "${content}"`,
      timestamp: new Date().toISOString()
    });

    saveDb();
    broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'announcements' });
    res.json({ success: true, message: 'Broadcast transmission completed.' });
  } catch (err: any) {
    console.error('Error dispatching broadcast:', err);
    res.status(500).json({ error: 'Failed to dispatch broadcast.' });
  }
};

export const getTickets = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    
    loadDb();
    
    if (admin.role !== 'SUPPORT_ADMIN' && admin.role !== 'LOGIN_ADMIN' && admin.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    res.json(db.tickets);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to query tickets registry.' });
  }
};

export const replyTicket = async (req: Request, res: Response) => {
  try {
    const { ticket_id } = req.params;
    const admin = (req as any).adminUser;
    const { content, closeTicket, escalate } = req.body;

    loadDb();

    if (admin.role !== 'SUPPORT_ADMIN' && admin.role !== 'LOGIN_ADMIN' && admin.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const ticket = db.tickets.find(t => t.ticket_id === ticket_id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    ticket.assigned_admin = admin.user_id;
    if (!ticket.messages) ticket.messages = [];
    ticket.messages.push({
      sender_id: admin.user_id,
      sender_name: admin.role === 'SUPPORT_ADMIN' ? 'SUPPORT (ID: 0)' : `${admin.username}`,
      content,
      timestamp: new Date().toISOString()
    });

    if (closeTicket) {
      ticket.status = 'resolved';
      ticket.resolved_at = new Date().toISOString();
    } else if (escalate && admin.role === 'SUPPORT_ADMIN') {
      ticket.status = 'escalated';
    } else {
      ticket.status = 'pending';
    }

    saveDb();
    broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'tickets' });
    res.json(ticket);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process ticket reply.' });
  }
};

export const deleteTicket = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    if (admin.role !== 'CLI_ADMIN' && admin.role !== 'LOGIN_ADMIN') {
      return res.status(403).json({ error: 'FAIL: Only CLI_ADMIN and LOGIN_ADMIN possess delete authorization.' });
    }

    const { ticket_id } = req.params;
    loadDb();

    const ticket = db.tickets.find(t => t.ticket_id === ticket_id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    db.tickets = db.tickets.filter(t => t.ticket_id !== ticket_id);

    db.audit_logs.push({
      log_id: `${generatePrefixedId('al')}_del_tkt`,
      admin_id: admin.user_id,
      admin_name: admin.username,
      action: 'role_change',
      target_type: 'ticket',
      target_id: ticket_id,
      reason: `Ticket Case #${ticket_id} permanently deleted from state by admin "${admin.username}".`,
      timestamp: new Date().toISOString()
    });

    saveDb();
    broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'tickets' });
    res.json({ success: true, message: `Ticket Case #${ticket_id} purged successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete ticket.' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    if (admin.role !== 'CLI_ADMIN' && admin.role !== 'LOGIN_ADMIN') {
      return res.status(403).json({ error: 'FAIL: Only CLI_ADMIN and LOGIN_ADMIN possess delete authorization.' });
    }

    const { user_id } = req.params;
    const uId = parseInt(user_id, 10);
    loadDb();

    const targetUser = db.users.find(u => u.user_id === uId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetUser.role === 'CLI_ADMIN' || targetUser.role === 'LOGIN_ADMIN') {
      return res.status(403).json({ error: 'CRITICAL BLOCK: System-level initial accounts cannot be deleted.' });
    }

    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'FAIL: A reason is required to complete this action.' });
    }

    // Terminate WebSocket connection instantly
    const activeConn = connectedClients.find(c => c.user_id === uId);
    if (activeConn) {
      try {
        activeConn.ws.send(JSON.stringify({ type: 'system_alert', message: 'ACCOUNT RESIGNED AND PURGED BY EXECUTIVE OVERRIDE.' }));
        activeConn.ws.close(3003, 'ACCOUNT_DELETED');
      } catch {}
    }

    if (admin.role === 'LOGIN_ADMIN') {
      // Soft-Purge: Change user status to 'purged' and terminate sessions, but keep records in SQLite
      targetUser.status = 'purged';
      targetUser.updated_at = new Date().toISOString();
      db.sessions = db.sessions.filter(s => s.user_id !== uId);

      db.audit_logs.push({
        log_id: `${generatePrefixedId('al')}_del_usr_soft`,
        admin_id: admin.user_id,
        admin_name: admin.username,
        action: 'user_purged_soft',
        target_type: 'user',
        target_id: String(uId),
        reason: `User @${targetUser.username} soft-purged by admin "${admin.username}". Reason: ${reason}`,
        timestamp: new Date().toISOString()
      });

      saveDb();
      broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'users' });
      return res.json({ success: true, message: `User @${targetUser.username} successfully soft-purged.` });
    }

    // CLI_ADMIN: Hard-Purge
    db.users = db.users.filter(u => u.user_id !== uId);
    db.profiles = db.profiles.filter(p => p.user_id !== uId);
    db.user_blocks = db.user_blocks.filter(b => b.blocker_id !== uId && b.blocked_id !== uId);
    db.sessions = db.sessions.filter(s => s.user_id !== uId);
    db.tickets = db.tickets.filter(t => t.user_id !== uId);
    db.friend_requests = (db.friend_requests || []).filter(fr => fr.sender_id !== uId && fr.receiver_id !== uId);
    
    db.messages = (db.messages || []).filter(m => {
      if (m.user_id === uId) return false;
      if (m.room_id && m.room_id.startsWith('dm_')) {
        const parts = m.room_id.split('_');
        if (parts.length >= 3 && (parts[1] === String(uId) || parts[2] === String(uId))) {
          return false;
        }
        if (m.room_id.startsWith('dm_velum_') && m.room_id.replace('dm_velum_', '') === String(uId)) {
          return false;
        }
      }
      return true;
    });
    db.peer_relationships = (db.peer_relationships || []).filter(pr => pr.sender_uid !== String(uId) && pr.receiver_uid !== String(uId));
    db.join_requests = (db.join_requests || []).filter(jr => jr.user_id !== uId);

    db.audit_logs.push({
      log_id: `${generatePrefixedId('al')}_del_usr_hard`,
      admin_id: admin.user_id,
      admin_name: admin.username,
      action: 'user_purged_hard',
      target_type: 'user',
      target_id: String(uId),
      reason: `User @${targetUser.username} permanently deleted from state by admin "${admin.username}". Reason: ${reason}`,
      timestamp: new Date().toISOString()
    });

    saveDb();
    broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'users' });
    res.json({ success: true, message: `User @${targetUser.username} successfully deleted and hard-purged.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
};

export const approveRecovery = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    const { targetUserId, action } = req.body; // action: 'approve' or 'deny'

    if (admin.role !== 'LOGIN_ADMIN' && admin.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'High security risk approvals require LOGIN_ADMIN or CLI_ADMIN role.' });
    }

    const user = db.users.find(u => u.user_id === targetUserId);
    if (!user) {
      return res.status(404).json({ error: 'User target not found.' });
    }

    const ticket = db.tickets.find(t => t.user_id === user.user_id && t.status !== 'resolved');

    if (action === 'approve') {
      if (ticket && ticket.credibility_score !== undefined && ticket.credibility_score < 85) {
        return res.status(400).json({ error: 'CREDIBILITY INSUFFICIENT: Level below 85% threshold.' });
      }

      user.status = 'active';
      db.admin_sanctions = db.admin_sanctions.filter(s => s.user_id !== user.user_id);

      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const tempCode = `LGN-REC-${code}`;
      (user as any).temp_restore_code = tempCode;
      user.updated_at = new Date().toISOString();

      if (ticket) {
        ticket.status = 'approved' as any;
        ticket.resolved_at = new Date().toISOString();
        ticket.provided_recovery_key = tempCode;
        if (!ticket.messages) ticket.messages = [];
        ticket.messages.push({
          sender_id: admin.user_id,
          sender_name: admin.username,
          content: `Ticket approved.\n\nUse the temporary restoration credential below to unlock your account and set a new password:\n\n\`${tempCode}\``,
          timestamp: new Date().toISOString()
        });
      }

      db.recovery_events.push({
        event_id: generatePrefixedId('rec'),
        user_id: user.user_id,
        method: 'compromised_recovery',
        approved_by: admin.user_id,
        timestamp: new Date().toISOString(),
        notes: `Restored by Executive Administrator. Temporary credentials issued.`
      });

      db.audit_logs.push({
        log_id: generatePrefixedId('al'),
        admin_id: admin.user_id,
        admin_name: admin.username,
        action: 'restore',
        target_type: 'user',
        target_id: user.user_id.toString(),
        reason: 'Approved ownership restoration request ticket verification.',
        timestamp: new Date().toISOString()
      });

      saveDb();
      broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'users' });
      res.json({ success: true, tempCode, message: 'Quarantine cleared. Restoration credentials issued.' });
    } else {
      if (ticket) {
        ticket.status = 'resolved';
        ticket.resolved_at = new Date().toISOString();
        if (!ticket.messages) ticket.messages = [];
        ticket.messages.push({
          sender_id: admin.user_id,
          sender_name: admin.username,
          content: `Ticket denied by executive administrator.`,
          timestamp: new Date().toISOString()
        });
      }
      saveDb();
      broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'tickets' });
      res.json({ success: true, message: 'Ticket denied and logged.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process recovery approval.' });
  }
};

export const sanctionUser = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    const { targetUsername, type, room_id, minutes, reason } = req.body;

    if (admin.role !== 'SUPPORT_ADMIN' && admin.role !== 'LOGIN_ADMIN') {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const target = db.users.find(u => u.username === targetUsername);
    if (!target) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    const isTargetSensitive = target.role === 'CLI_ADMIN' || 
                              target.role === 'LOGIN_ADMIN' || 
                              target.role === 'SUPPORT_ADMIN' || 
                              (target.role as string) === 'SYSTEM' ||
                              target.username.toLowerCase() === 'velum' ||
                              target.username.toLowerCase() === '@velum' ||
                              target.username.toLowerCase() === 'cli' ||
                              target.username.toLowerCase().startsWith('sa-');

    if (isTargetSensitive && admin.role === 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Restricted: SUPPORT_ADMIN role is strictly forbidden from targeting administrative or system accounts.' });
    }

    if (type === 'ban' && admin.role !== 'LOGIN_ADMIN') {
      return res.status(403).json({ error: 'Forbidden: SUPPORT_ADMIN role is restricted from applying central bans. Escalating required.' });
    }

    const expiresAt = new Date(Date.now() + (minutes || 60) * 60000).toISOString();

    const newSanction: AdminSanction = {
      sanction_id: generatePrefixedId('sanc'),
      user_id: target.user_id,
      admin_id: admin.user_id,
      room_id: room_id || null,
      type,
      expires_at: expiresAt,
      reason: reason || 'Violation of Secure Protocol'
    };

    db.admin_sanctions.push(newSanction);

    if (type === 'ban') {
      if (room_id) {
        db.lounge_rooms = (db.lounge_rooms || []).filter(r => !(r.lounge_id === room_id && String(r.created_by) === String(target.user_id)));
      } else {
        db.lounge_rooms = (db.lounge_rooms || []).filter(r => String(r.created_by) !== String(target.user_id));
        
        target.status = 'suspended';
        db.sessions = db.sessions.map(s => {
          if (s.user_id === target.user_id) {
            return { ...s, status: 'revoked', end_time: new Date().toISOString() };
          }
          return s;
        });
      }

      saveDb();
      broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'users' });

      const activeConn = connectedClients.find(c => c.user_id === target.user_id);
      if (activeConn) {
        activeConn.ws.send(JSON.stringify({ type: 'banned_alert', reason }));
        activeConn.ws.close(3001, 'Account suspended by central matrix');
      }
    }

    db.audit_logs.push({
      log_id: generatePrefixedId('al'),
      admin_id: admin.user_id,
      admin_name: admin.username,
      action: type === 'ban' ? 'ban' : 'mute',
      target_type: 'user',
      target_id: target.user_id.toString(),
      reason: `${reason} (${minutes} mins)`,
      timestamp: new Date().toISOString()
    });

    saveDb();
    broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'users' });
    res.json({ success: true, sanction: newSanction });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process user sanction.' });
  }
};

export const revokeSanction = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    const { targetUsername, targetUserId, type } = req.body;

    if (admin.role !== 'SUPPORT_ADMIN' && admin.role !== 'LOGIN_ADMIN' && admin.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'Unprivileged restriction.' });
    }

    let target;
    if (targetUserId) {
      const tId = parseInt(targetUserId as any, 10);
      target = db.users.find(u => u.user_id === tId);
    } else if (targetUsername) {
      target = db.users.find(u => u.username.toLowerCase() === targetUsername.toLowerCase());
    }

    if (!target) {
      return res.status(404).json({ error: 'Target user peer not found.' });
    }

    const isTargetSensitive = target.role === 'CLI_ADMIN' || 
                              target.role === 'LOGIN_ADMIN' || 
                              target.role === 'SUPPORT_ADMIN' || 
                              (target.role as string) === 'SYSTEM' ||
                              target.username.toLowerCase() === 'velum' ||
                              target.username.toLowerCase() === '@velum' ||
                              target.username.toLowerCase() === 'cli' ||
                              target.username.toLowerCase().startsWith('sa-');

    if (isTargetSensitive && admin.role === 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Restricted: SUPPORT_ADMIN role is strictly forbidden from targeting administrative or system accounts.' });
    }

    if (type === 'unban' && admin.role !== 'LOGIN_ADMIN') {
      return res.status(403).json({ error: 'Restricted: SUPPORT_ADMIN role cannot lift global bans.' });
    }

    if (type === 'unban') {
      target.status = 'active';
      db.admin_sanctions = db.admin_sanctions.filter(s => !(s.user_id === target.user_id && s.type === 'ban'));
    } else if (type === 'unmute') {
      db.admin_sanctions = db.admin_sanctions.filter(s => !(s.user_id === target.user_id && s.type === 'mute'));
    } else {
      return res.status(400).json({ error: 'Invalid revoke type parameters.' });
    }

    db.audit_logs.push({
      log_id: generatePrefixedId('al'),
      admin_id: admin.user_id,
      admin_name: admin.username,
      action: 'restore',
      target_type: 'user',
      target_id: target.user_id.toString(),
      reason: `Sanction revoked administrative action.`,
      timestamp: new Date().toISOString()
    });

    saveDb();
    broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'users' });
    res.json({ success: true, username: target.username });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to revoke sanction.' });
  }
};

export const lockUser = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    const { targetUsername, lock } = req.body;

    if (admin.role !== 'SUPPORT_ADMIN' && admin.role !== 'LOGIN_ADMIN') {
      return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
    }

    const target = db.users.find(u => u.username.toLowerCase() === targetUsername.toLowerCase());
    if (!target) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    const isTargetSensitive = target.role === 'CLI_ADMIN' || 
                              target.role === 'LOGIN_ADMIN' || 
                              target.role === 'SUPPORT_ADMIN' || 
                              (target.role as string) === 'SYSTEM' ||
                              target.username.toLowerCase() === 'velum' ||
                              target.username.toLowerCase() === '@velum' ||
                              target.username.toLowerCase() === 'cli' ||
                              target.username.toLowerCase().startsWith('sa-');

    if (isTargetSensitive && admin.role === 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Restricted: SUPPORT_ADMIN role is strictly forbidden from targeting administrative or system accounts.' });
    }

    if (target.role === 'LOGIN_ADMIN' && admin.role !== 'LOGIN_ADMIN') {
      return res.status(403).json({ error: 'Restricted: ONLY a Login Admin can modify another Login Admin.' });
    }

    if (lock) {
      target.status = 'compromised';
      db.sessions = db.sessions.map(s => {
        if (s.user_id === target.user_id) {
          return { ...s, status: 'revoked', end_time: new Date().toISOString() };
        }
        return s;
      });

      const activeConn = connectedClients.find(c => c.user_id === target.user_id);
      if (activeConn) {
        activeConn.ws.send(JSON.stringify({ type: 'compromised_alert' }));
        activeConn.ws.close(4000, 'Security locked by administration');
      }

      db.audit_logs.push({
        log_id: generatePrefixedId('al'),
        admin_id: admin.user_id,
        admin_name: admin.username,
        action: 'panic_lock',
        target_type: 'user',
        target_id: target.user_id.toString(),
        reason: 'Administrative lockout triggered.',
        timestamp: new Date().toISOString()
      });
    } else {
      target.status = 'active';

      db.audit_logs.push({
        log_id: generatePrefixedId('al'),
        admin_id: admin.user_id,
        admin_name: admin.username,
        action: 'restore',
        target_type: 'user',
        target_id: target.user_id.toString(),
        reason: 'Administrative unlock requested.',
        timestamp: new Date().toISOString()
      });
    }

    saveDb();
    broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'users' });
    res.json({ success: true, status: target.status });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to modify lock state.' });
  }
};

export const getDiagnostics = async (req: Request, res: Response) => {
  try {
    const user = (req as any).adminUser;

    loadDb();

    if (user.role !== 'LOGIN_ADMIN' && user.role !== 'SUPPORT_ADMIN' && user.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'Unprivileged diagnostic access.' });
    }

    const filteredUsers = db.users.filter(u => {
      if (user.role === 'SUPPORT_ADMIN') {
        const isSensitive = u.role === 'CLI_ADMIN' || 
                            u.role === 'LOGIN_ADMIN' || 
                            u.role === 'SUPPORT_ADMIN' || 
                            (u.role as string) === 'SYSTEM' ||
                            u.username.toLowerCase() === 'velum' ||
                            u.username.toLowerCase() === '@velum' ||
                            u.username.toLowerCase() === 'cli' ||
                            u.username.toLowerCase().startsWith('sa-');
        return !isSensitive;
      }
      return true;
    });

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messages24hCount = (db.messages || []).filter(m => {
      if (!m || !m.timestamp) return false;
      try {
        return new Date(m.timestamp) >= oneDayAgo;
      } catch {
        return false;
      }
    }).length;

    res.json({
      users: filteredUsers.map(u => ({ 
        user_id: u.user_id, 
        username: u.username, 
        role: u.role, 
        status: u.status,
        created_at: u.created_at,
        last_seen_at: u.last_seen_at
      })),
      suspicious: db.suspicious_events,
      logs: db.audit_logs,
      sessions: db.sessions,
      devices: db.devices,
      sanctions: db.admin_sanctions,
      metrics: {
        totalUsers: db.users.length,
        totalRooms: 0,
        activeSessionsCount: db.sessions.filter(s => s.status === 'active').length,
        totalTickets: db.tickets.length,
        openTicketsCount: db.tickets.filter(t => t.status !== 'resolved').length,
        totalMessages: db.messages.length,
        messages24hCount,
        recentTicketsList: (db.tickets || []).slice(-5).reverse().map(t => ({
          id: t.ticket_id,
          name: t.username || `User #${t.user_id}`,
          type: t.issue_type,
          status: t.status,
          created_at: t.created_at
        }))
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to access diagnostics.' });
  }
};

export const createInvite = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    const { expiresDays } = req.body;

    if (admin.role !== 'LOGIN_ADMIN') {
      return res.status(403).json({ error: 'Only EXECUTIVE Login Admins can emit system validation invites.' });
    }

    const code = `VELUM-KEY-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9050)}`;
    const expiresAt = new Date(Date.now() + (expiresDays || 7) * 86400000).toISOString();

    const invite: Invite = {
      invite_id: generatePrefixedId('inv'),
      code,
      creator_id: admin.user_id,
      created_by: admin.user_id,
      used_by: null,
      status: 'active',
      created_at: new Date().toISOString(),
      used_at: null,
      expires_at: expiresAt,
      approved_by: admin.user_id
    };

    db.invites.push(invite);
    saveDb();
    broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'system' });

    res.json(invite);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create invite.' });
  }
};

export const getInvites = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    if (admin.role !== 'LOGIN_ADMIN' && admin.role !== 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Unprivileged invites access.' });
    }
    res.json(db.invites);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch invites.' });
  }
};

export const nominateSupport = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    const targetUsername = req.body.targetUsername || req.body.username;

    if (admin.role !== 'LOGIN_ADMIN' && admin.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'FAIL: Only system executive administrators can nominate Support Operators.' });
    }

    if (!targetUsername) {
      return res.status(400).json({ error: 'FAIL: targetUsername or username is required.' });
    }

    const targetUser = db.users.find(u => u.username.toLowerCase() === targetUsername.trim().toLowerCase());
    if (!targetUser) {
      return res.status(404).json({ error: `FAIL: Registered user "${targetUsername}" not found.` });
    }

    const currentRole = (targetUser.role || '').toUpperCase();
    if (currentRole !== 'USER' && currentRole !== 'MEMBER') {
      return res.status(400).json({ error: `FAIL: User "${targetUser.username}" is already an administrator or holds role "${targetUser.role}".` });
    }

    targetUser.support_nomination = 'nominated';
    targetUser.promotion_status = 'PENDING_SUPPORT';
    targetUser.updated_at = new Date().toISOString();

    db.audit_logs.push({
      log_id: generatePrefixedId('al'),
      admin_id: admin.user_id,
      admin_name: admin.username,
      action: 'role_change',
      target_type: 'user',
      target_id: String(targetUser.user_id),
      reason: `Executive Login Admin nominated user "${targetUser.username}" to SUPPORT_ADMIN role. Status: PENDING ROOT CLI APPROVAL.`,
      timestamp: new Date().toISOString()
    });

    saveDb();
    broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'users' });
    res.json({ success: true, targetUser: { user_id: targetUser.user_id, username: targetUser.username, support_nomination: targetUser.support_nomination } });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process nomination.' });
  }
};

export const renameExecutive = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    const { newUsername, newPassword } = req.body;

    if (admin.role !== 'LOGIN_ADMIN') {
      return res.status(403).json({ error: 'FAIL: Authorization rejected. Only LOGIN_ADMIN can rename executive profile.' });
    }

    if (!newUsername || newUsername.trim().length < 3) {
      return res.status(400).json({ error: 'FAIL: New handle must be at least 3 characters.' });
    }

    const trimmedNew = newUsername.trim();
    const exists = db.users.find(u => u.username.toLowerCase() === trimmedNew.toLowerCase() && u.user_id !== admin.user_id);
    if (exists) {
      return res.status(400).json({ error: `FAIL: Username "${trimmedNew}" is already registered. Choose another distinct handle.` });
    }

    const oldName = admin.username;
    admin.username = trimmedNew;
    if (newPassword && newPassword.trim().length >= 5) {
      const newSalt = crypto.randomBytes(32).toString('hex');
      const clientHash = crypto.createHash('sha256').update(newSalt + newPassword.trim()).digest('hex');
      const hashHex = await hashArgon2id(clientHash, Buffer.from(newSalt, 'hex'));
      admin.salt = newSalt;
      admin.password_hash = `argon2id:${hashHex}`;
    }
    admin.updated_at = new Date().toISOString();

    db.audit_logs.push({
      log_id: generatePrefixedId('al'),
      admin_id: admin.user_id,
      admin_name: trimmedNew,
      action: 'role_change',
      target_type: 'user',
      target_id: String(admin.user_id),
      reason: `Executive handle renamed from "${oldName}" to "${trimmedNew}" for security rotation protection.`,
      timestamp: new Date().toISOString()
    });

    db.suspicious_events.push({
      event_id: generatePrefixedId('se'),
      entity_type: 'user',
      entity_id: String(admin.user_id),
      risk_level: 'intermediate',
      description: `Executive administrator credentials successfully rotated: "${oldName}" -> "${trimmedNew}"`,
      created_at: new Date().toISOString()
    });

    saveDb();
    broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'settings' });
    res.json({ success: true, username: admin.username });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to rename profile.' });
  }
};

export const executeCli = async (req: Request, res: Response) => {
  try {
    const user = (req as any).adminUser;
    const { command } = req.body;

    if (user.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'FAIL: CLI channel access requires complete cryptographic administrative parameters.' });
    }

    const output = await executeCliCommand(command);
    res.json({ output });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to execute CLI command.' });
  }
};

export const getVerifications = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).user;
    if (admin && admin.role === 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Access denied. Support Operators are restricted from verification controls.' });
    }
    loadDb();
    const listings = db.market_listings || [];
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
};

export const reviewVerification = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).user;
    if (admin && admin.role === 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Access denied. Support Operators are restricted from verification controls.' });
    }
    const { listingId } = req.params;
    const { result, notes } = req.body;
    
    loadDb();
    const listing = (db.market_listings || []).find(l => l.listing_id === listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    
    listing.verification_status = result === 'PASS' ? 'APPROVED' : 'REJECTED';
    
    db.listing_verification_checks = db.listing_verification_checks || [];
    db.listing_verification_checks.push({
      check_id: generatePrefixedId('chk'),
      listing_id: listingId,
      check_type: 'MANUAL_REVIEW',
      result: result,
      notes: notes,
      reviewed_by_admin_id: admin.admin_id || admin.username,
      created_at: new Date().toISOString()
    });
    
    res.json({ success: true, listing });
  } catch (err) {
    res.status(500).json({ error: 'Failed to review verification' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    const { safeWord, panicPhrase } = req.body;

    loadDb();

    const targetUser = db.users.find(u => u.user_id === admin.user_id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Admin user not found.' });
    }

    const saltBuf = Buffer.from(targetUser.salt || 'dev_salt_seed_value_hex_32_bytes', 'hex');

    if (safeWord) {
      const swHashHex = await hashArgon2id(safeWord.trim(), saltBuf);
      targetUser.safe_word_hash = `argon2id:${swHashHex}`;
    }

    if (panicPhrase) {
      const ppHashHex = await hashArgon2id(panicPhrase.trim(), saltBuf);
      targetUser.panic_phrase_hash = `argon2id:${ppHashHex}`;
    }

    targetUser.updated_at = new Date().toISOString();
    saveDb();
    broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'settings' });

    res.json({ success: true, message: 'Settings successfully updated in database.' });
  } catch (err: any) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update administrative settings.' });
  }
};

export const getReports = async (req: Request, res: Response) => {
  try {
    loadDb();
    res.json(db.reports || []);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch reports database registry.' });
  }
};

export const updateReportStatus = async (req: Request, res: Response) => {
  try {
    const { report_id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status parameter is required.' });
    }

    loadDb();
    db.reports = db.reports || [];

    const report = db.reports.find(r => r.report_id === report_id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    report.status = status;
    saveDb();
    broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'reports' });

    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update report status.' });
  }
};

export const deleteReport = async (req: Request, res: Response) => {
  try {
    const { report_id } = req.params;
    loadDb();
    db.reports = (db.reports || []).filter(r => r.report_id !== report_id);
    saveDb();
    broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'reports' });
    res.json({ success: true, message: 'Report permanently deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete report.' });
  }
};

export const restoreUser = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    if (admin.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'FAIL: Only CLI_ADMIN holds restore authorization.' });
    }

    const { user_id } = req.params;
    const uId = parseInt(user_id, 10);
    loadDb();

    const targetUser = db.users.find(u => u.user_id === uId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetUser.status !== 'purged') {
      return res.status(400).json({ error: 'User is not purged.' });
    }

    targetUser.status = 'active';
    targetUser.updated_at = new Date().toISOString();

    db.audit_logs.push({
      log_id: `${generatePrefixedId('al')}_rst_usr`,
      admin_id: admin.user_id,
      admin_name: admin.username,
      action: 'user_restored',
      target_type: 'user',
      target_id: String(uId),
      reason: `Purged account @${targetUser.username} restored back to active state by CLI_ADMIN "${admin.username}".`,
      timestamp: new Date().toISOString()
    });

    saveDb();
    broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'users' });
    res.json({ success: true, message: `User @${targetUser.username} successfully restored.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to restore user.' });
  }
};
