import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, supportAdminNominations } from '../db/schema/users.js';
import { hashArgon2id } from '../utils/crypto.js';
import { SystemBot } from './systemBot.js';
import { BotTemplates } from './botTemplates.js';
import { userRepository } from '../repositories/userRepository.js';

export class SupportAdminNominationService {
  static async approveNomination(nominationId: number): Promise<{ success: boolean; username?: string; error?: string }> {
    const [nomination] = await db.select().from(supportAdminNominations).where(eq(supportAdminNominations.id, nominationId)).limit(1);
    if (!nomination) {
      return { success: false, error: 'Nomination not found' };
    }
    if (nomination.status !== 'pending') {
      return { success: false, error: `Nomination is not in pending status (current: ${nomination.status})` };
    }

    const [targetUser] = await db.select().from(users).where(eq(users.id, nomination.nominatedUserId)).limit(1);
    if (!targetUser) {
      return { success: false, error: 'Nominated user not found' };
    }

    const adminUsername = `Sa-${targetUser.username}`;
    const adminPassword = `Sa-Vel-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const adminSalt = crypto.randomBytes(16).toString('hex');
    const adminPasswordHash = await hashArgon2id(adminPassword, Buffer.from(adminSalt, 'hex'));
    const adminRecoveryKey = `Sa-Vel-Sup-${crypto.randomInt(10000, 99999)}`;
    const adminRecoveryKeyHash = await hashArgon2id(adminRecoveryKey, Buffer.from(adminSalt, 'hex'));
    const adminPanicPhrase = `Sa-P-${crypto.randomInt(100000, 999990)}`;
    const adminPanicPhraseHash = await hashArgon2id(adminPanicPhrase, Buffer.from(adminSalt, 'hex'));

    const newAdmin = await userRepository.create({
      username: adminUsername,
      passwordHash: adminPasswordHash,
      salt: adminSalt,
      role: 'SUPPORT_ADMIN',
      displayName: `${targetUser.displayName || targetUser.username} (Support)`,
      recoveryKeyHash: adminRecoveryKeyHash,
      panicPhraseHash: adminPanicPhraseHash,
      duressActive: true
    });

    const credentialsData = JSON.stringify({
      username: adminUsername,
      password: adminPassword,
      recoveryKey: adminRecoveryKey,
      panicPhrase: adminPanicPhrase
    });

    await db.update(supportAdminNominations)
      .set({
        status: 'approved',
        adminAccountId: newAdmin.id,
        credentials: credentialsData,
        updatedAt: new Date()
      })
      .where(eq(supportAdminNominations.id, nominationId));

    await SystemBot.getInstance().sendToUser(nomination.nominatedUserId, BotTemplates.supportNominationPending());
    return { success: true, username: targetUser.username };
  }

  static async rejectNomination(nominationId: number, reason?: string): Promise<{ success: boolean; error?: string }> {
    const [nomination] = await db.select().from(supportAdminNominations).where(eq(supportAdminNominations.id, nominationId)).limit(1);
    if (!nomination) {
      return { success: false, error: 'Nomination not found' };
    }
    if (nomination.status !== 'pending') {
      return { success: false, error: `Nomination is not in pending status (current: ${nomination.status})` };
    }

    await db.update(supportAdminNominations)
      .set({
        status: 'rejected',
        updatedAt: new Date()
      })
      .where(eq(supportAdminNominations.id, nominationId));

    await SystemBot.getInstance().sendToUser(nomination.nominatedUserId, BotTemplates.supportNominationRejected(reason));
    return { success: true };
  }

  static async demoteSupportAdmin(targetUserId: number, reason?: string): Promise<{ success: boolean; error?: string }> {
    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    const adminUsername = `support_${targetUser.username}`;
    const altAdminUsername = `Sa-${targetUser.username}`;

    let deleted = await db.delete(users).where(
      and(
        eq(users.role, 'SUPPORT_ADMIN'),
        eq(users.username, adminUsername)
      )
    ).returning();

    if (deleted.length === 0) {
      deleted = await db.delete(users).where(
        and(
          eq(users.role, 'SUPPORT_ADMIN'),
          eq(users.username, altAdminUsername)
        )
      ).returning();
    }

    if (deleted.length === 0) {
      return { success: false, error: 'Support admin account not found' };
    }

    await db.update(supportAdminNominations)
      .set({
        status: 'revoked',
        updatedAt: new Date()
      })
      .where(eq(supportAdminNominations.nominatedUserId, targetUserId));

    await SystemBot.getInstance().sendToUser(targetUserId, BotTemplates.supportNominationRevoked(reason));
    return { success: true };
  }
}
