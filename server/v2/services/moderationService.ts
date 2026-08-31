import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { blacklist } from '../db/schema/blacklist.js';
import { reports } from '../db/schema/tickets.js';
import { auditLogs } from '../db/schema/audit_logs.js';
import { sessions } from '../db/schema/sessions.js';
import { userDevices, devices, ipAddresses } from '../db/schema/devices.js';
import { listings } from '../db/schema/marketplace.js';
import { userRepository } from '../repositories/userRepository.js';
import { SystemBot } from './systemBot.js';
import { BotTemplates } from './botTemplates.js';

// Zero-tolerance keyword patterns for immediate 1-strike blacklist
const ZERO_TOLERANCE_KEYWORDS = [
  'chargeback', 'counterfeit', 'drain', 'drainer', 'exploit', 'stolen card',
  'fake proof', 'escrow fraud', 'phishing', 'keylogger', 'stealer', 'infostealer',
  'recovery key share', 'admin impersonation', 'ddos', 'botnet', 'api flood',
  'token stuffing', 'rat payload', 'trojan'
];

// Malicious script/payload patterns in marketplace listings or user inputs
const MALICIOUS_PAYLOAD_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /\b(eval|exec|Function|setTimeout|setInterval)\s*\(/gi,
  /\bpowershell(?:\.exe)?\s+-[eE][a-zA-Z0-9+/=]+/gi,
  /\bbase64_decode\s*\(/gi,
  /\/bin\/(?:ba)?sh\s+-i/gi,
  /\bdocument\.(?:cookie|location|write)\b/gi,
  /\bwindow\.(?:localStorage|sessionStorage)\b/gi,
  /\b(wget|curl)\s+https?:\/\/[^\s]+\s*\|\s*(?:ba)?sh\b/gi,
  /\b(?:nc|ncat|netcat)\s+-[eE]\s+/gi
];

export interface ModerationResult {
  action: 'INSTANT_BLACKLIST' | 'STRIKE_1_WARNING' | 'STRIKE_2_RESTRICTION' | 'STRIKE_3_BLACKLIST' | 'LISTING_DROPPED' | 'PARDONED' | 'CLEARED';
  strikeCount: number;
  reason: string;
  ecosystemHarvested?: {
    ips: number;
    devices: number;
    fingerprints: number;
  };
}

export class ModerationService {
  private static instance: ModerationService;

  private constructor() {}

  public static getInstance(): ModerationService {
    if (!ModerationService.instance) {
      ModerationService.instance = new ModerationService();
    }
    return ModerationService.instance;
  }

  /**
   * Scans text content for zero-tolerance security keywords
   */
  public detectZeroToleranceViolation(text: string): string | null {
    if (!text) return null;
    const lower = text.toLowerCase();
    for (const kw of ZERO_TOLERANCE_KEYWORDS) {
      if (lower.includes(kw)) {
        return kw;
      }
    }
    return null;
  }

  /**
   * Scans text or listings for malicious executable payloads and scripts
   */
  public detectMaliciousPayload(content: string): string | null {
    if (!content) return null;
    for (const pattern of MALICIOUS_PAYLOAD_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        return pattern.source;
      }
    }
    return null;
  }

  /**
   * Automatically sanitizes and drops a malicious marketplace listing, blacklisting repeat offenders
   */
  public async scanAndDropMaliciousListing(listingId: number): Promise<boolean> {
    try {
      const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
      if (!listing) return false;

      const combinedText = `${listing.title} ${listing.description || ''} ${listing.category || ''}`;
      const payloadMatch = this.detectMaliciousPayload(combinedText) || this.detectZeroToleranceViolation(combinedText);

      if (payloadMatch) {
        // Drop and purge listing permanently
        await db.delete(listings).where(eq(listings.id, listingId));

        // Notify seller via SystemBot
        const [seller] = await db.select().from(users).where(eq(users.id, listing.sellerId)).limit(1);
        if (seller) {
          const notice = BotTemplates.marketplaceMaliciousListingDropped(
            seller.username,
            listing.title,
            `Prohibited malicious payload pattern detected: ${payloadMatch}`
          );
          await SystemBot.getInstance().sendToUser(seller.id, notice);

          // Record audit log
          await db.insert(auditLogs).values({
            logId: `mod_${Date.now()}_audit`,
            adminId: 999,
            adminName: 'SYSTEM_MODERATION',
            action: 'MARKETPLACE_LISTING_DROPPED',
            targetId: String(seller.id),
            reason: `Malicious payload in listing #${listingId}: ${payloadMatch}`
          });

          // Check if seller should be instantly blacklisted
          await this.executeInstantEcosystemBlacklist(seller.id, 'MALICIOUS_MARKET_PAYLOAD', `Published malicious code in listing #${listingId}`);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('[ModerationService] Error scanning listing:', err);
      return false;
    }
  }

  /**
   * Processes an abuse or misconduct report with automated strike calculation
   */
  public async processReport(
    reporterId: number,
    targetUserId: number,
    type: string,
    reason: string,
    priority: string = 'medium'
  ): Promise<ModerationResult> {
    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser) {
      return { action: 'CLEARED', strikeCount: 0, reason: 'Target user not found' };
    }

    // 1. Check for Zero-Tolerance trigger
    const combinedReason = `${type} ${reason}`;
    const zeroToleranceMatch = this.detectZeroToleranceViolation(combinedReason);

    if (zeroToleranceMatch) {
      const harvest = await this.executeInstantEcosystemBlacklist(
        targetUser.id,
        'ZERO_TOLERANCE_VIOLATION',
        `Zero-tolerance keyword matched: ${zeroToleranceMatch} (${reason})`
      );

      // Record report in database
      await db.insert(reports).values({
        reporterId,
        targetUserId,
        type,
        priority: 'critical',
        reason,
        status: 'resolved_instant_blacklist'
      });

      return {
        action: 'INSTANT_BLACKLIST',
        strikeCount: 3,
        reason: `Zero-tolerance violation: ${zeroToleranceMatch}`,
        ecosystemHarvested: harvest
      };
    }

    // 2. Insert report and calculate existing strike/report count
    await db.insert(reports).values({
      reporterId,
      targetUserId,
      type,
      priority,
      reason,
      status: 'active'
    });

    const activeReports = await db.select().from(reports).where(
      sql`${reports.targetUserId} = ${targetUserId} AND ${reports.status} IN ('active', 'pending')`
    );

    const strikeCount = activeReports.length;

    if (strikeCount === 1) {
      // Strike 1: Official warning DM
      const notice = BotTemplates.strike1Warning({
        username: targetUser.username,
        reason,
        strikeNumber: 1,
        maxStrikes: 3
      });
      await SystemBot.getInstance().sendToUser(targetUser.id, notice);

      await db.insert(auditLogs).values({
        logId: `mod_${Date.now()}_audit`,
        adminId: 999,
        adminName: 'SYSTEM_MODERATION',
        action: 'STRIKE_1_WARNING',
        targetId: String(targetUser.id),
        reason
      });

      return { action: 'STRIKE_1_WARNING', strikeCount: 1, reason };
    }

    if (strikeCount === 2) {
      // Strike 2: 48-Hour Restriction Notice
      const notice = BotTemplates.strike2Restriction({
        username: targetUser.username,
        reason,
        strikeNumber: 2,
        maxStrikes: 3
      });
      await SystemBot.getInstance().sendToUser(targetUser.id, notice);

      await db.insert(auditLogs).values({
        logId: `mod_${Date.now()}_audit`,
        adminId: 999,
        adminName: 'SYSTEM_MODERATION',
        action: 'STRIKE_2_RESTRICTION',
        targetId: String(targetUser.id),
        reason
      });

      return { action: 'STRIKE_2_RESTRICTION', strikeCount: 2, reason };
    }

    // Strike 3+: Automated Ecosystem Blacklist
    const harvest = await this.executeInstantEcosystemBlacklist(
      targetUser.id,
      'STRIKE_3_MAX_REACHED',
      `Accumulated 3 policy strikes. Latest: ${reason}`
    );

    const finalNotice = BotTemplates.strike3Blacklist({
      username: targetUser.username,
      reason,
      strikeNumber: 3,
      maxStrikes: 3
    });
    await SystemBot.getInstance().sendToUser(targetUser.id, finalNotice);

    // Update reports to resolved
    await db.update(reports).set({ status: 'resolved_blacklisted', updatedAt: new Date() }).where(eq(reports.targetUserId, targetUserId));

    return {
      action: 'STRIKE_3_BLACKLIST',
      strikeCount: 3,
      reason: `Accumulated ${strikeCount} strikes: ${reason}`,
      ecosystemHarvested: harvest
    };
  }

  /**
   * Executes atomic cascading ecosystem harvest into blacklist table
   */
  public async executeInstantEcosystemBlacklist(
    userId: number,
    violationType: string,
    reason: string
  ): Promise<{ ips: number; devices: number; fingerprints: number }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return { ips: 0, devices: 0, fingerprints: 0 };

    // System protected accounts firewall
    if (user.id === 1 || user.id === 2 || user.id === 999) {
      console.warn(`[ModerationService] Cannot blacklist protected system account ${user.id}`);
      return { ips: 0, devices: 0, fingerprints: 0 };
    }

    const harvestedIps = new Set<string>();
    const harvestedDevices = new Set<string>();
    const harvestedFingerprints = new Set<string>();

    // 1. Harvest session & IP history
    const sessList = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    sessList.forEach(s => { if (s.ipAddress) harvestedIps.add(s.ipAddress); });

    const ipList = await db.select().from(ipAddresses).where(eq(ipAddresses.userId, user.id));
    ipList.forEach(ip => { if (ip.ipAddress) harvestedIps.add(ip.ipAddress); });

    // 2. Harvest user devices & fingerprints
    const devList = await db.select().from(userDevices).where(eq(userDevices.userId, user.id));
    for (const ud of devList) {
      if (ud.deviceId) {
        harvestedDevices.add(ud.deviceId);
        const devRecords = await db.select().from(devices).where(eq(devices.deviceId, ud.deviceId)).limit(1);
        if (devRecords[0]?.deviceFingerprint) {
          harvestedFingerprints.add(devRecords[0].deviceFingerprint);
        }
      }
    }

    // 3. Ingest into blacklist library
    const entriesToInsert = [
      { userId: user.id, type: 'USERNAME', value: user.username, reason, bannedBy: 'SYSTEM_MODERATION' }
    ];

    for (const ip of harvestedIps) {
      entriesToInsert.push({ userId: user.id, type: 'IP', value: ip, reason: `Ecosystem IP: ${reason}`, bannedBy: 'SYSTEM_MODERATION' });
    }
    for (const devId of harvestedDevices) {
      entriesToInsert.push({ userId: user.id, type: 'DEVICE_ID', value: devId, reason: `Ecosystem Device: ${reason}`, bannedBy: 'SYSTEM_MODERATION' });
    }
    for (const fp of harvestedFingerprints) {
      entriesToInsert.push({ userId: user.id, type: 'DEVICE_FINGERPRINT', value: fp, reason: `Ecosystem Fingerprint: ${reason}`, bannedBy: 'SYSTEM_MODERATION' });
    }

    for (const entry of entriesToInsert) {
      await db.insert(blacklist).values(entry).onConflictDoNothing();
    }

    // 4. Terminate active sessions and mark user as BLOCKED
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await userRepository.update(user.id, { role: 'BLOCKED' });

    // 5. Send instant blacklist notice and record audit
    const notice = BotTemplates.instantZeroToleranceBlacklist(user.username, violationType, reason);
    await SystemBot.getInstance().sendToUser(user.id, notice);

    await db.insert(auditLogs).values({
      logId: `mod_${Date.now()}_audit`,
      adminId: 999,
      adminName: 'SYSTEM_MODERATION',
      action: 'ECOSYSTEM_BLACKLIST',
      targetId: String(user.id),
      reason: `[${violationType}] ${reason} (Harvested: ${harvestedIps.size} IPs, ${harvestedDevices.size} Devs, ${harvestedFingerprints.size} FPs)`
    });

    return {
      ips: harvestedIps.size,
      devices: harvestedDevices.size,
      fingerprints: harvestedFingerprints.size
    };
  }

  /**
   * Pardons a user, removes their full ecosystem from blacklist, and restores active role
   */
  public async pardonAndWhitelist(userIdOrUsername: string | number, reason: string = 'Admin Pardon'): Promise<boolean> {
    let user;
    if (typeof userIdOrUsername === 'number') {
      user = await userRepository.findById(userIdOrUsername);
    } else {
      const num = parseInt(userIdOrUsername, 10);
      user = !isNaN(num) ? await userRepository.findById(num) : await userRepository.findByUsername(userIdOrUsername);
    }

    if (!user) return false;

    // Purge user and linked ecosystem from blacklist table
    await db.delete(blacklist).where(
      sql`${blacklist.userId} = ${user.id} OR ${blacklist.value} = ${user.username}`
    );

    // Restore role
    if (user.role === 'BLOCKED' || user.role === 'BANNED') {
      await userRepository.update(user.id, { role: 'USER' });
    }

    // Dismiss active reports
    await db.update(reports).set({ status: 'pardoned', updatedAt: new Date() }).where(eq(reports.targetUserId, user.id));

    // Send pardon notification via SystemBot
    const notice = BotTemplates.whitelistPardon(user.username, reason);
    await SystemBot.getInstance().sendToUser(user.id, notice);

    // Audit log
    await db.insert(auditLogs).values({
      logId: `mod_${Date.now()}_audit`,
      adminId: 999,
      adminName: 'SYSTEM_MODERATION',
      action: 'WHITELIST_PARDON',
      targetId: String(user.id),
      reason
    });

    return true;
  }
}

export const moderationService = ModerationService.getInstance();
