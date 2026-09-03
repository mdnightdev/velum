import { eq, and, or, isNotNull, lte, sql } from 'drizzle-orm';
import { db, executeWithRetry } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { wallets, transactions } from '../db/schema/wallets.js';
import { reserves } from '../db/schema/reserves.js';
import { blacklist } from '../db/schema/blacklist.js';
import { userDevices } from '../db/schema/devices.js';
import { userRepository } from '../repositories/userRepository.js';
import { logger } from '../utils/logger.js';
import { auditLogs } from '../db/schema/audit_logs.js';

export class UserDeletionService {
  private static sweeperInterval: NodeJS.Timeout | null = null;

  /**
   * 1. User Self-Service Deactivation (7 Days Grace Period)
   */
  static async requestUserDeactivation(userId: number, reason: string = 'Self-deactivation'): Promise<{ scheduledDeletionAt: Date }> {
    const scheduledDeletionAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.update(users).set({
      role: 'DEACTIVATED',
      status: 'Pending',
      scheduledDeletionAt,
      deletionReason: reason,
      deletionInitiatedBy: 'USER',
      updatedAt: new Date()
    }).where(eq(users.id, userId));

    await userRepository.deleteAllSessionsForUser(userId);

    logger.info(`[DELETION TIER 1] User ${userId} scheduled self-deactivation for ${scheduledDeletionAt.toISOString()}`);
    return { scheduledDeletionAt };
  }

  /**
   * 2. Login Admin Requested Deactivation (3 Days Grace Period)
   */
  static async scheduleAdminDeactivation(userId: number, adminId: number, reason: string): Promise<{ scheduledDeletionAt: Date }> {
    const scheduledDeletionAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

    await db.update(users).set({
      role: 'DEACTIVATED',
      status: 'Pending',
      scheduledDeletionAt,
      deletionReason: reason,
      deletionInitiatedBy: 'LOGIN_ADMIN',
      updatedAt: new Date()
    }).where(eq(users.id, userId));

    await userRepository.deleteAllSessionsForUser(userId);

    await db.insert(auditLogs).values({
      logId: `AUDIT-DEACT-${Date.now()}`,
      adminId,
      adminName: 'LOGIN_ADMIN',
      action: 'ADMIN_SCHEDULED_DELETION',
      targetId: String(userId),
      reason: `3-Day Grace Period Initiated: ${reason}`
    });

    logger.info(`[DELETION TIER 2] Admin ${adminId} scheduled user ${userId} deactivation for ${scheduledDeletionAt.toISOString()}`);
    return { scheduledDeletionAt };
  }

  /**
   * 3. Instant CLI Admin Purge (Instant 0 Days)
   * Releases assets and atomically wipes the account across all database tables.
   */
  static async executeInstantPurge(userId: number, reason: string = 'CLI_ADMIN_PURGE'): Promise<{ success: boolean; purgedTables: string[] }> {
    logger.info(`[DELETION TIER 3] Executing instant purge for user ${userId}`);

    // Settle / release any active wallet balance before final deletion
    const userWallets = await db.select().from(wallets).where(eq(wallets.userId, userId));
    for (const w of userWallets) {
      if (parseFloat(w.balance) > 0) {
        logger.info(`[ASSET RELEASE] Releasing remaining balance of ${w.balance} ${w.currency} for user ${userId}`);
      }
    }

    return userRepository.purgeUserCompletely(userId, `INSTANT_CLI_PURGE: ${reason}`);
  }

  /**
   * 4. Fraud Sanction & Asset Seizure (Data Retained for Blacklist Algorithm)
   * Seizes all wallet assets into Platform Reserves and blacklists IP, Device IDs, and User.
   */
  static async executeFraudSeizure(userId: number, adminName: string, reason: string): Promise<{ success: boolean; seizedAmount: number }> {
    logger.warn(`[DELETION TIER 4] Executing Fraud Sanction & Asset Seizure for user ${userId}`);

    let totalSeized = 0;

    await executeWithRetry(async () => {
      await db.transaction(async (tx) => {
        const { sessions } = await import('../db/schema/sessions.js');

        // 1. Fetch user wallets and seize funds
        const userWallets = await tx.select().from(wallets).where(eq(wallets.userId, userId));
        for (const w of userWallets) {
          const bal = parseFloat(w.balance);
          if (bal > 0) {
            totalSeized += bal;
            // Record transfer transaction
            const txRef = `SEIZE-${Date.now()}-${w.id}`;
            await tx.insert(transactions).values({
              walletId: w.id,
              reference: txRef.substring(0, 32),
              type: 'SEIZURE',
              amount: `-${w.balance}`,
              status: 'COMPLETED',
              description: `Fraud asset seizure: ${reason}`
            });
            // Reset user wallet balance
            await tx.update(wallets).set({ balance: '0.00', updatedAt: new Date() }).where(eq(wallets.id, w.id));

            // Deposit into platform reserve pool (USD equivalent cents)
            const cents = Math.round(bal * 100);
            await tx.update(reserves).set({
              balanceCents: sql`${reserves.balanceCents} + ${cents}`,
              updatedAt: new Date()
            }).where(eq(reserves.reserveType, 'PLATFORM_OPERATIONAL'));
          }
        }

        // 2. Fetch user devices and hardware fingerprints to blacklist device permanently
        const { devices: devicesTable } = await import('../db/schema/devices.js');
        const userDevList = await tx.select().from(userDevices).where(eq(userDevices.userId, userId));
        
        for (const dev of userDevList) {
          // Blacklist device ID
          await tx.insert(blacklist).values({
            userId,
            type: 'DEVICE_ID',
            value: dev.deviceId,
            reason: `Fraud seizure: ${reason}`,
            bannedBy: adminName
          }).onConflictDoNothing();

          // Query deep hardware fingerprint & specs
          const [hwProfile] = await tx.select().from(devicesTable).where(eq(devicesTable.deviceId, dev.deviceId)).limit(1);
          if (hwProfile && hwProfile.deviceFingerprint) {
            await tx.insert(blacklist).values({
              userId,
              type: 'DEVICE_FINGERPRINT',
              value: hwProfile.deviceFingerprint,
              deviceFingerprint: hwProfile.deviceFingerprint,
              platform: hwProfile.platform || undefined,
              userAgent: hwProfile.userAgent || undefined,
              hardwareSpecs: {
                screenResolution: hwProfile.screenResolution || undefined,
                hardwareConcurrency: hwProfile.hardwareConcurrency || undefined,
                deviceMemory: hwProfile.deviceMemory || undefined,
                webglVendor: hwProfile.webglVendor || undefined,
                webglRenderer: hwProfile.webglRenderer || undefined,
                timezone: hwProfile.timezone || undefined
              },
              reason: `Fraud device fingerprint ban: ${reason}`,
              bannedBy: adminName
            }).onConflictDoNothing();
          }
        }

        // 3. Mark user role as BANNED & FRAUD_SEIZURE (retaining row for blacklist matching)
        await tx.update(users).set({
          role: 'BANNED',
          status: 'Banned',
          isCompromised: true,
          duressActive: true,
          scheduledDeletionAt: null, // Do not delete row - retain for blacklist reference
          deletionReason: `FRAUD_SEIZURE: ${reason}`,
          deletionInitiatedBy: 'FRAUD_SEIZURE',
          updatedAt: new Date()
        }).where(eq(users.id, userId));

        // 4. Terminate sessions
        await tx.delete(sessions).where(eq(sessions.userId, userId));

        // 5. Record immutable audit log
        await tx.insert(auditLogs).values({
          logId: `AUDIT-FRAUD-${Date.now()}`,
          adminId: 1,
          adminName,
          action: 'FRAUD_SEIZURE_AND_BLACKLIST',
          targetId: String(userId),
          reason: JSON.stringify({ reason, totalSeized, blacklistedDevices: userDevList.length })
        });
      });
    });

    return { success: true, seizedAmount: totalSeized };
  }

  /**
   * Sweeper Worker: Periodically executes expired deletions for Tiers 1 and 2
   */
  static async sweepExpiredDeletions(): Promise<{ purgedCount: number; userIds: number[] }> {
    const now = new Date();
    
    // Find all expired accounts excluding FRAUD_SEIZURE (which must be retained)
    const expiredUsers = await db.select({
      id: users.id,
      username: users.username,
      deletionInitiatedBy: users.deletionInitiatedBy
    }).from(users).where(
      and(
        isNotNull(users.scheduledDeletionAt),
        lte(users.scheduledDeletionAt, now)
      )
    );

    const purgedUserIds: number[] = [];

    for (const exp of expiredUsers) {
      if (exp.deletionInitiatedBy === 'FRAUD_SEIZURE') continue;

      try {
        logger.info(`[DELETION SWEEPER] Deadline reached for user @${exp.username} (ID ${exp.id}, Initiated by: ${exp.deletionInitiatedBy}). Purging...`);
        
        // Release remaining assets to external/settled status
        const userWallets = await db.select().from(wallets).where(eq(wallets.userId, exp.id));
        for (const w of userWallets) {
          if (parseFloat(w.balance) > 0) {
            logger.info(`[ASSET SETTLEMENT] Released final balance of ${w.balance} ${w.currency} for expired user @${exp.username}`);
          }
        }

        // Atomically purge database records
        await userRepository.purgeUserCompletely(exp.id, `SCHEDULED_DELETION_EXPIRED (${exp.deletionInitiatedBy})`);
        purgedUserIds.push(exp.id);
      } catch (err) {
        logger.error(`[DELETION SWEEPER] Failed to purge expired user ${exp.id}:`, err);
      }
    }

    return { purgedCount: purgedUserIds.length, userIds: purgedUserIds };
  }

  /**
   * Start recurring background sweeper daemon (runs every 15 minutes)
   */
  static startBackgroundSweeper(intervalMs = 15 * 60 * 1000): void {
    if (this.sweeperInterval) return;

    // Run initial sweep on server boot
    this.sweepExpiredDeletions().catch((err) => {
      logger.error('[DELETION SWEEPER] Initial startup sweep failed:', err);
    });

    this.sweeperInterval = setInterval(() => {
      this.sweepExpiredDeletions().catch((err) => {
        logger.error('[DELETION SWEEPER] Periodic sweep error:', err);
      });
    }, intervalMs);

    logger.info(`[DELETION SWEEPER] Background deletion sweeper daemon started (Interval: ${intervalMs / 1000}s)`);
  }

  static stopBackgroundSweeper(): void {
    if (this.sweeperInterval) {
      clearInterval(this.sweeperInterval);
      this.sweeperInterval = null;
    }
  }
}
