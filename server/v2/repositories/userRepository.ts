import { eq, sql } from 'drizzle-orm';
import { db, executeWithRetry } from '../db/client.js';
import { users, sessions, type User, type NewUser, type Session, type NewSession } from '../db/schema/index.js';

export class UserRepository {
  async findById(id: number): Promise<User | null> {
    return executeWithRetry(async () => {
      const results = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return results[0] || null;
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return executeWithRetry(async () => {
      const results = await db
        .select()
        .from(users)
        .where(sql`LOWER(${users.username}) = LOWER(${username})`)
        .limit(1);
      return results[0] || null;
    });
  }

  async create(data: NewUser): Promise<User> {
    return executeWithRetry(async () => {
      const inserted = await db.insert(users).values(data).returning();
      return inserted[0];
    });
  }

  async update(id: number, data: Partial<NewUser>): Promise<User | null> {
    return executeWithRetry(async () => {
      const updated = await db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return updated[0] || null;
    });
  }

  async delete(id: number): Promise<boolean> {
    return executeWithRetry(async () => {
      const deleted = await db.delete(users).where(eq(users.id, id)).returning();
      return deleted.length > 0;
    });
  }

  async createSession(data: NewSession): Promise<Session> {
    return executeWithRetry(async () => {
      const inserted = await db.insert(sessions).values(data).returning();
      return inserted[0];
    });
  }

  async findSessionByTokenHash(tokenHash: string): Promise<{ session: Session; user: User } | null> {
    return executeWithRetry(async () => {
      const results = await db
        .select({
          session: sessions,
          user: users
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.tokenHash, tokenHash))
        .limit(1);

      if (results.length === 0) return null;
      return results[0];
    });
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<boolean> {
    return executeWithRetry(async () => {
      const deleted = await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash)).returning();
      return deleted.length > 0;
    });
  }

  async deleteAllSessionsForUser(userId: number, tx: any = db): Promise<number> {
    return executeWithRetry(async () => {
      const deleted = await tx.delete(sessions).where(eq(sessions.userId, userId));
      return deleted.rowCount || 0;
    });
  }

  /**
   * Resilient User Purge: Executes database cascade deletion across all user data
   * in a single atomic transaction in strict foreign-key dependency order.
   */
  async purgeUserCompletely(userId: number, reason: string = 'ADMIN_PURGE'): Promise<{ success: boolean; userId: number; purgedTables: string[] }> {
    const { userDevices } = await import('../db/schema/devices.js');
    const { userPrekeys } = await import('../db/schema/keys.js');
    const { pushSubscriptions } = await import('../db/schema/push.js');
    const { userReadCursors } = await import('../db/schema/read_cursors.js');
    const { loungeMuteSettings } = await import('../db/schema/lounge_mutes.js');
    const { loungeMembers, messageReactions, messages } = await import('../db/schema/lounges.js');
    const { cards } = await import('../db/schema/cards.js');
    const { listings, escrows } = await import('../db/schema/marketplace.js');
    const { wallets, transactions } = await import('../db/schema/wallets.js');
    const { tickets } = await import('../db/schema/tickets.js');
    const { auditLogs } = await import('../db/schema/audit_logs.js');
    const { supportAdminNominations } = await import('../db/schema/users.js');
    const { or } = await import('drizzle-orm');

    const purgedTables: string[] = [];

    await executeWithRetry(async () => {
      await db.transaction(async (tx) => {
        // 1. Devices & Sessions & Keys
        await tx.delete(sessions).where(eq(sessions.userId, userId));
        purgedTables.push('sessions');

        await tx.delete(userDevices).where(eq(userDevices.userId, userId));
        purgedTables.push('user_devices');

        await tx.delete(userPrekeys).where(eq(userPrekeys.userId, userId));
        purgedTables.push('user_prekeys');

        await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
        purgedTables.push('push_subscriptions');

        // 2. Chat & Lounge References
        await tx.delete(messageReactions).where(eq(messageReactions.userId, userId));
        purgedTables.push('message_reactions');

        await tx.delete(userReadCursors).where(eq(userReadCursors.userId, userId));
        purgedTables.push('user_read_cursors');

        await tx.delete(loungeMuteSettings).where(eq(loungeMuteSettings.userId, userId));
        purgedTables.push('lounge_mute_settings');

        await tx.delete(loungeMembers).where(eq(loungeMembers.userId, userId));
        purgedTables.push('lounge_members');

        await tx.delete(messages).where(eq(messages.senderId, userId));
        purgedTables.push('messages');

        // 3. Marketplace, Escrows, Cards
        await tx.delete(escrows).where(or(eq(escrows.buyerId, userId), eq(escrows.sellerId, userId)));
        purgedTables.push('escrows');

        await tx.delete(listings).where(eq(listings.sellerId, userId));
        purgedTables.push('listings');

        await tx.delete(cards).where(eq(cards.userId, userId));
        purgedTables.push('cards');

        // 4. Financial Wallets & Transactions
        const userWallets = await tx.select({ id: wallets.id }).from(wallets).where(eq(wallets.userId, userId));
        const walletIds = userWallets.map(w => w.id);
        if (walletIds.length > 0) {
          const { inArray } = await import('drizzle-orm');
          await tx.delete(transactions).where(inArray(transactions.walletId, walletIds));
          purgedTables.push('transactions');
        }

        await tx.delete(wallets).where(eq(wallets.userId, userId));
        purgedTables.push('wallets');

        // 5. Nominations & Support Tickets
        await tx.delete(supportAdminNominations).where(or(eq(supportAdminNominations.nominatedUserId, userId), eq(supportAdminNominations.nominatedBy, userId)));
        purgedTables.push('support_admin_nominations');

        await tx.delete(tickets).where(eq(tickets.userId, userId));
        purgedTables.push('tickets');

        // 6. Final User Record Purge
        await tx.delete(users).where(eq(users.id, userId));
        purgedTables.push('users');

        // 7. Audit Log Record
        await tx.insert(auditLogs).values({
          logId: `LOG-PURGE-${Date.now()}`,
          adminId: 1,
          adminName: 'SYSTEM',
          action: 'RESILIENT_USER_PURGE',
          targetId: String(userId),
          reason: JSON.stringify({ reason, purgedTables })
        });
      });
    });

    return {
      success: true,
      userId,
      purgedTables
    };
  }
}

export const userRepository = new UserRepository();
