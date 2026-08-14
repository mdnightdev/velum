import { db, executeWithRetry } from '../../db/client.js';
import { users } from '../../db/schema/users.js';
import { messages } from '../../db/schema/lounges.js';
import { userPrekeys } from '../../db/schema/keys.js';
import { pushSubscriptions } from '../../db/schema/push.js';
import { userReadCursors } from '../../db/schema/read_cursors.js';
import { loungeMuteSettings } from '../../db/schema/lounge_mutes.js';
import { sessions } from '../../db/schema/sessions.js';
import { tickets } from '../../db/schema/tickets.js';
import { auditLogs } from '../../db/schema/audit_logs.js';
import { eq } from 'drizzle-orm';
import { generateRandomToken } from '../../utils/crypto.js';
import { systemBot } from '../systemBot.js';
import crypto from 'node:crypto';

export interface PanicExecutionResult {
  success: boolean;
  ticketId: string;
  purgedTables: string[];
}

/**
 * Executes WAL Cascade Deletion and duress flag activation for a user.
 * Instantly purges sensitive user tables and registers a critical security ticket & audit event.
 */
export async function executePanicCascade(
  userId: number,
  reason: string = 'PANIC_PROTOCOL_DURESS',
  cvpScore: number = 95
): Promise<PanicExecutionResult> {
  const trackingUuid = `TK-${generateRandomToken(12).toUpperCase()}`;
  const purgedTables: string[] = [];

  await executeWithRetry(async () => {
    await db.transaction(async (tx) => {
      // 1. Purge messages
      await tx.delete(messages).where(eq(messages.senderId, userId));
      purgedTables.push('messages');

      // 2. Purge prekeys
      await tx.delete(userPrekeys).where(eq(userPrekeys.userId, userId));
      purgedTables.push('user_prekeys');

      // 3. Purge push subscriptions
      await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      purgedTables.push('push_subscriptions');

      // 4. Purge read cursors
      await tx.delete(userReadCursors).where(eq(userReadCursors.userId, userId));
      purgedTables.push('read_cursors');

      // 5. Purge lounge mute settings
      await tx.delete(loungeMuteSettings).where(eq(loungeMuteSettings.userId, userId));
      purgedTables.push('lounge_mute_settings');

      // 6. Terminate active sessions
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      purgedTables.push('sessions');

      // 7. Flag user as compromised & duress active
      await tx.update(users)
        .set({
          duressActive: true,
          isCompromised: true,
          compromiseTicketId: trackingUuid
        })
        .where(eq(users.id, userId));

      // 8. Create critical security support ticket with initial guidance messages
      const initialMessages = [
        {
          sender_id: 0,
          sender_name: 'SYSTEM',
          content: `MANUAL PANIC PROTOCOL ACTIVATED (${reason}). Immediate WAL cascade deletion executed across sensitive tables.`,
          timestamp: new Date().toISOString()
        },
        {
          sender_id: 0,
          sender_name: 'SYSTEM',
          content: 'To coordinate with central control administrators and obtain your restore code, please formulate details in the chat below.',
          timestamp: new Date().toISOString()
        }
      ];

      await tx.insert(tickets).values({
        userId,
        subject: 'CRITICAL: WAL CASCADE DURESS PANIC PROTOCOL ACTIVATED',
        description: `User ID ${userId} triggered panic protocol (${reason}). Immediate WAL cascade deletion executed across sensitive tables.`,
        issueType: 'recovery_request',
        status: 'open',
        credibilityScore: cvpScore,
        trackingId: trackingUuid,
        messages: initialMessages
      });

      // 9. Record audit log entry
      await tx.insert(auditLogs).values({
        logId: `LOG-PANIC-${generateRandomToken(8).toUpperCase()}`,
        adminId: userId,
        adminName: `USER-${userId}`,
        action: 'PANIC_PROTOCOL_WAL_CASCADE',
        targetId: userId.toString(),
        reason: JSON.stringify({ reason, ticketId: trackingUuid, purgedTables })
      });
    });
  });

  try {
    systemBot.dispatchPanicAlert(userId, trackingUuid, reason);
  } catch (botErr) {
    console.error('[PanicService] System bot alert dispatch failed:', botErr);
  }

  return {
    success: true,
    ticketId: trackingUuid,
    purgedTables
  };
}
