import { eq, sql } from 'drizzle-orm';
import { db, executeWithRetry } from '../db/client.js';
import { users, sessions, type User, type NewUser, type Session, type NewSession } from '../db/schema/index.js';
import { logger } from '../utils/logger.js';
import {
  isForbiddenPublicUserId,
  isReservedSystemUserId,
  isTestUserId,
  MIN_PUBLIC_USER_ID,
  MAX_PUBLIC_USER_ID,
  TEST_USER_ID_MIN,
  TEST_USER_ID_MAX,
} from '../constants/systemIds.js';

export type CreateUserOptions = {
  /** Only admin/bot seeders may set reserved IDs 1, 2, 999. */
  allowSystemId?: boolean;
  /** Integration/chaos helpers may set disposable IDs 9000–9999. */
  allowTestId?: boolean;
};

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

  /** Next free ID in the disposable test band (9000–9999). */
  async allocateTestUserId(): Promise<number> {
    return executeWithRetry(async () => {
      const [row] = await db
        .select({
          maxId: sql<number>`COALESCE(MAX(${users.id}), ${TEST_USER_ID_MIN - 1})`.mapWith(Number),
        })
        .from(users)
        .where(sql`${users.id} BETWEEN ${TEST_USER_ID_MIN} AND ${TEST_USER_ID_MAX}`);
      const next = Number(row?.maxId ?? TEST_USER_ID_MIN - 1) + 1;
      if (next > TEST_USER_ID_MAX) {
        throw new Error(
          `[UserRepository] Test user ID band exhausted (${TEST_USER_ID_MIN}-${TEST_USER_ID_MAX}). Run scripts/purge-test-accounts.ts`
        );
      }
      return next;
    });
  }

  async create(data: NewUser, options: CreateUserOptions = {}): Promise<User> {
    return executeWithRetry(async () => {
      if (data.id != null) {
        const id = Number(data.id);
        if (options.allowSystemId) {
          if (!isReservedSystemUserId(id)) {
            throw new Error(
              `[UserRepository] allowSystemId only permits reserved IDs (1, 2, 999); got ${id}`
            );
          }
        } else if (options.allowTestId) {
          if (!isTestUserId(id)) {
            throw new Error(
              `[UserRepository] allowTestId only permits IDs ${TEST_USER_ID_MIN}-${TEST_USER_ID_MAX}; got ${id}`
            );
          }
        } else if (isForbiddenPublicUserId(id)) {
          throw new Error(
            `[UserRepository] Refusing user ID ${id}: use 1/2/999 (system), ${MIN_PUBLIC_USER_ID}-${MAX_PUBLIC_USER_ID} (public), or ${TEST_USER_ID_MIN}-${TEST_USER_ID_MAX} (test)`
          );
        }
      } else {
        // Real registrations stay below the test band so 9000–9999 stay disposable.
        await db.execute(sql`
          SELECT setval(
            pg_get_serial_sequence('users', 'id'),
            GREATEST(
              (SELECT COALESCE(MAX(id), 1) FROM users WHERE id < ${TEST_USER_ID_MIN}),
              ${MIN_PUBLIC_USER_ID}
            ),
            true
          );
        `);
      }

      const inserted = await db.insert(users).values(data).returning();
      const created = inserted[0];
      if (!options.allowSystemId && !options.allowTestId && created && isForbiddenPublicUserId(created.id)) {
        await db.delete(users).where(eq(users.id, created.id));
        throw new Error(
          `[UserRepository] Serial issued locked/test ID ${created.id}; insert rolled back.`
        );
      }
      return created;
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
      // Invalidate existing older sessions for this user on new login & clean expired sessions
      if (data.userId) {
        await db.delete(sessions).where(eq(sessions.userId, data.userId));
      }
      await db.delete(sessions).where(sql`${sessions.expiresAt} < NOW()`);

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
        const { relationships } = await import('../db/schema/relationships.js');
        const { webauthnCredentials } = await import('../db/schema/webauthn.js');
        const { reports } = await import('../db/schema/tickets.js');

        // 1. Devices & Sessions & Keys & Passkeys
        await tx.delete(sessions).where(eq(sessions.userId, userId));
        purgedTables.push('sessions');

        await tx.delete(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));
        purgedTables.push('webauthn_credentials');

        await tx.delete(userDevices).where(eq(userDevices.userId, userId));
        purgedTables.push('user_devices');

        await tx.delete(userPrekeys).where(eq(userPrekeys.userId, userId));
        purgedTables.push('user_prekeys');

        await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
        purgedTables.push('push_subscriptions');

        await tx.delete(relationships).where(or(eq(relationships.userId, userId), eq(relationships.friendId, userId)));
        purgedTables.push('relationships');

        await tx.delete(reports).where(or(eq(reports.reporterId, userId), eq(reports.targetUserId, userId)));
        purgedTables.push('reports');

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

        // Delete user media assets and avatar partition
        const { mediaAssets } = await import('../db/schema/media.js');
        await tx.delete(mediaAssets).where(eq(mediaAssets.uploaderId, userId));
        purgedTables.push('media_assets');

        try {
          const fs = await import('fs');
          const path = await import('path');
          const userAvatarDir = path.join(process.cwd(), 'public', 'uploads', 'avatars', String(userId));
          if (fs.existsSync(userAvatarDir)) {
            await fs.promises.rm(userAvatarDir, { recursive: true, force: true }).catch(() => {});
          }
        } catch (e) {
          logger.warn(`[User Purge] Failed to clean avatar directory for user ${userId}: ${(e as Error).message}`);
        }

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
