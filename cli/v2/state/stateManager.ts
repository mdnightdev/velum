import { getRedisClient } from '../../../server/v2/db/redis.js';

export class StateManager {
  private static instance: StateManager;

  private maintenanceMode = false;
  private txFeePercent = '1.5';
  private taxPercent = '0.5';
  private escrowFeePercent = '1.0';
  private mutedUsers = new Set<string>();
  private jailedUsers = new Set<string>();
  private frozenWallets = new Set<string>();

  private initialized = false;

  private constructor() {}

  public static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const redis = await getRedisClient();
      if (redis) {
        const maint = await redis.get('cli:maintenance_mode');
        if (maint !== null) this.maintenanceMode = maint === 'true';

        const txFee = await redis.get('cli:tx_fee_percent');
        if (txFee !== null) this.txFeePercent = txFee;

        const tax = await redis.get('cli:tax_percent');
        if (tax !== null) this.taxPercent = tax;

        const escrow = await redis.get('cli:escrow_fee_percent');
        if (escrow !== null) this.escrowFeePercent = escrow;

        const muted = await redis.sMembers('cli:muted_users');
        for (const u of muted) this.mutedUsers.add(u);

        const jailed = await redis.sMembers('cli:jailed_users');
        for (const u of jailed) this.jailedUsers.add(u);

        const frozen = await redis.sMembers('cli:frozen_wallets');
        for (const w of frozen) this.frozenWallets.add(w);
      }
    } catch {
      // Graceful fallback to default in-memory state
    }
    this.initialized = true;
  }

  public async clearRuntimeCaches(): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (redis) {
        const keys = await redis.keys('cache:*');
        if (keys.length > 0) {
          await redis.del(keys);
        }
      }
    } catch {
      // Graceful fallback
    }
  }

  private maintenanceGraceEndsAt = 0;
  private maintenanceTimer: NodeJS.Timeout | null = null;

  // Maintenance Mode
  public isMaintenanceMode(): boolean {
    return this.maintenanceMode;
  }

  public getMaintenanceGraceRemainingMs(): number {
    if (!this.maintenanceMode || !this.maintenanceGraceEndsAt) return 0;
    return Math.max(0, this.maintenanceGraceEndsAt - Date.now());
  }

  public getMaintenanceGraceEndsAt(): number {
    return this.maintenanceGraceEndsAt;
  }

  public async terminateStandardUserSessions(): Promise<number> {
    try {
      const { db } = await import('../../../server/v2/db/client.js');
      const { sessions } = await import('../../../server/v2/db/schema/sessions.js');
      const { users } = await import('../../../server/v2/db/schema/users.js');
      const { sql, notInArray } = await import('drizzle-orm');

      // System staff and immune IDs (1, 2, 999) are never logged out
      const staffUsers = await db.select({ id: users.id }).from(users).where(
        sql`${users.id} IN (1, 2, 999) OR ${users.role} IN ('ADMIN', 'CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN', 'BANK_ADMIN')`
      );
      const staffUserIds = staffUsers.map(u => u.id);

      let deletedCount = 0;
      if (staffUserIds.length > 0) {
        const deleted = await db.delete(sessions).where(notInArray(sessions.userId, staffUserIds)).returning();
        deletedCount = deleted.length;
      } else {
        const deleted = await db.delete(sessions).returning();
        deletedCount = deleted.length;
      }

      console.log(`[Maintenance] Terminated ${deletedCount} non-staff user sessions (5-minute grace window elapsed).`);
      return deletedCount;
    } catch (err) {
      console.error('[Maintenance] Failed to terminate standard user sessions:', err);
      return 0;
    }
  }

  public async setMaintenanceMode(enabled: boolean): Promise<void> {
    this.maintenanceMode = enabled;
    if (this.maintenanceTimer) {
      clearTimeout(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }

    if (enabled) {
      // 5-minute countdown grace period (300,000 ms)
      this.maintenanceGraceEndsAt = Date.now() + 5 * 60 * 1000;
      this.maintenanceTimer = setTimeout(() => {
        this.terminateStandardUserSessions().catch(() => {});
      }, 5 * 60 * 1000);
    } else {
      this.maintenanceGraceEndsAt = 0;
    }

    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.set('cli:maintenance_mode', String(enabled));
        await redis.set('cli:maintenance_grace_ends_at', String(this.maintenanceGraceEndsAt));
        await redis.publish('admin:events', JSON.stringify({
          type: 'maintenance_update',
          maintenanceMode: enabled,
          gracePeriodEndsAt: this.maintenanceGraceEndsAt,
          graceRemainingMs: enabled ? 300000 : 0
        }));
      }

      const { SystemConfigService } = await import('../../../server/v2/services/systemConfigService.js');
      await SystemConfigService.setMaintenanceMode(enabled);
      await SystemConfigService.set('maintenance_grace_ends_at', String(this.maintenanceGraceEndsAt));
    } catch {}
  }

  // Fees & Taxes
  public getTxFeePercent(): string {
    return this.txFeePercent;
  }

  public async setTxFeePercent(pct: string): Promise<void> {
    this.txFeePercent = pct;
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.set('cli:tx_fee_percent', pct);
      }
    } catch {}
  }

  public getTaxPercent(): string {
    return this.taxPercent;
  }

  public async setTaxPercent(pct: string): Promise<void> {
    this.taxPercent = pct;
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.set('cli:tax_percent', pct);
      }
    } catch {}
  }

  public getEscrowFeePercent(): string {
    return this.escrowFeePercent;
  }

  public async setEscrowFeePercent(pct: string): Promise<void> {
    this.escrowFeePercent = pct;
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.set('cli:escrow_fee_percent', pct);
      }
    } catch {}
  }

  // Moderation: Mute
  public isMuted(username: string): boolean {
    return this.mutedUsers.has(username);
  }

  public async addMuted(username: string): Promise<void> {
    this.mutedUsers.add(username);
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.sAdd('cli:muted_users', username);
      }
    } catch {}
  }

  public async removeMuted(username: string): Promise<void> {
    this.mutedUsers.delete(username);
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.sRem('cli:muted_users', username);
      }
    } catch {}
  }

  // Moderation: Jail
  public isJailed(username: string): boolean {
    return this.jailedUsers.has(username);
  }

  public async addJailed(username: string): Promise<void> {
    this.jailedUsers.add(username);
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.sAdd('cli:jailed_users', username);
      }
    } catch {}
  }

  public async removeJailed(username: string): Promise<void> {
    this.jailedUsers.delete(username);
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.sRem('cli:jailed_users', username);
      }
    } catch {}
  }

  // Wallets: Freeze
  public isWalletFrozen(walletId: string): boolean {
    return this.frozenWallets.has(walletId);
  }

  public async addFrozenWallet(walletId: string): Promise<void> {
    this.frozenWallets.add(walletId);
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.sAdd('cli:frozen_wallets', walletId);
      }
    } catch {}
  }

  public async removeFrozenWallet(walletId: string): Promise<void> {
    this.frozenWallets.delete(walletId);
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.sRem('cli:frozen_wallets', walletId);
      }
    } catch {}
  }
}

export const stateManager = StateManager.getInstance();
