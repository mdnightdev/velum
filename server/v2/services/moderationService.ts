import { eq, desc, sql, inArray } from 'drizzle-orm';
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
import { isReservedSystemUserId } from '../constants/systemIds.js';

/** High-signal payloads that can harm Velum infra — not product-category policing. */
const PLATFORM_HARM_PATTERNS: RegExp[] = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /<\?php\b/gi,
  /\bpowershell(?:\.exe)?\s+-[eE][a-zA-Z]*\s+[A-Za-z0-9+/=]+/gi,
  /\b(wget|curl)\s+https?:\/\/[^\s]+\s*\|\s*(?:ba)?sh\b/gi,
  /\/bin\/(?:ba)?sh\s+-i/gi,
  /\b(?:nc|ncat|netcat)\s+-[eE]\s+/gi,
  /\brat\s+payload\b/gi,
];

/**
 * Finance / escrow fraud phrases for market hold-to-review.
 * Word-boundary / multi-token only — no bare "drain", "exploit", "ddos".
 */
const COMMERCE_FRAUD_PATTERNS: RegExp[] = [
  /\bstolen\s+cards?\b/gi,
  /\bchargebacks?\b/gi,
  /\bescrow\s+fraud\b/gi,
  /\bfake\s+proof\b/gi,
  /\binfostealers?\b/gi,
  /\bkeyloggers?\b/gi,
  /\bphishing\s+kits?\b/gi,
  /\brecovery\s+key\s+share\b/gi,
  /\badmin\s+impersonation\b/gi,
  /\btoken\s+stuffing\b/gi,
  /\bcounterfeit\s+(?:cards?|docs?|documents?)\b/gi,
];

const E2EE_BODY_PREFIXES = ['e2ee:', 'ratchet:', 'VEL_E2EE['];

export type ModerationLane = 'platform' | 'commerce';

export interface ContentScanHit {
  lane: ModerationLane;
  match: string;
}

export interface ModerationResult {
  action:
    | 'INSTANT_BLACKLIST'
    | 'STRIKE_1_WARNING'
    | 'STRIKE_2_RESTRICTION'
    | 'STRIKE_3_BLACKLIST'
    | 'LISTING_HELD'
    | 'LISTING_DROPPED'
    | 'PARDONED'
    | 'CLEARED';
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

  /** True when body is E2E ciphertext the server should not content-scan. */
  public isEncryptedMessageBody(text: string | null | undefined): boolean {
    if (!text) return false;
    const t = String(text).trim();
    return E2EE_BODY_PREFIXES.some((p) => t.startsWith(p));
  }

  /**
   * Platform-harm payloads (scripts/shells). Used for listings + visible chat bodies.
   */
  public detectPlatformHarm(content: string | null | undefined): string | null {
    if (!content) return null;
    for (const pattern of PLATFORM_HARM_PATTERNS) {
      pattern.lastIndex = 0;
      const m = pattern.exec(content);
      if (m) return m[0].slice(0, 80);
    }
    return null;
  }

  /**
   * Commerce / escrow fraud signals for marketplace hold-to-review only.
   */
  public detectCommerceFraudSignal(content: string | null | undefined): string | null {
    if (!content) return null;
    for (const pattern of COMMERCE_FRAUD_PATTERNS) {
      pattern.lastIndex = 0;
      const m = pattern.exec(content);
      if (m) return m[0].toLowerCase();
    }
    return null;
  }

  /** Combined listing scan: platform first, then commerce. */
  public scanListingContent(content: string): ContentScanHit | null {
    const platform = this.detectPlatformHarm(content);
    if (platform) return { lane: 'platform', match: platform };
    const commerce = this.detectCommerceFraudSignal(content);
    if (commerce) return { lane: 'commerce', match: commerce };
    return null;
  }

  /** @deprecated Use detectCommerceFraudSignal — kept for call-site compatibility. */
  public detectZeroToleranceViolation(text: string): string | null {
    return this.detectCommerceFraudSignal(text);
  }

  /** @deprecated Use detectPlatformHarm — kept for call-site compatibility. */
  public detectMaliciousPayload(content: string): string | null {
    return this.detectPlatformHarm(content);
  }

  /**
   * Hold a listing for admin review (no delete, no auto-ban).
   */
  public async holdListingForReview(
    listingId: number,
    hit: ContentScanHit
  ): Promise<boolean> {
    try {
      const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
      if (!listing) return false;

      await db
        .update(listings)
        .set({
          status: 'PENDING_REVIEW',
          moderationReason: hit.match,
          moderationLane: hit.lane,
          heldAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(listings.id, listingId));

      const [seller] = await db.select().from(users).where(eq(users.id, listing.sellerId)).limit(1);
      if (seller) {
        const notice = BotTemplates.marketplaceListingHeldForReview(
          seller.username,
          listing.title,
          hit.lane,
          hit.match
        );
        await SystemBot.getInstance().sendToUser(seller.id, notice);
      }

      await db.insert(auditLogs).values({
        logId: `mod_${Date.now()}_audit`,
        adminId: 999,
        adminName: 'SYSTEM_MODERATION',
        action: 'MARKETPLACE_LISTING_HELD',
        targetId: String(listing.sellerId),
        reason: `Listing #${listingId} held (${hit.lane}): ${hit.match}`,
      });

      return true;
    } catch (err) {
      console.error('[ModerationService] Error holding listing:', err);
      return false;
    }
  }

  /**
   * Scan an existing listing and hold it if needed (no ban, no delete).
   */
  public async scanAndDropMaliciousListing(listingId: number): Promise<boolean> {
    try {
      const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
      if (!listing) return false;

      const combinedText = `${listing.title} ${listing.description || ''} ${listing.category || ''} ${listing.digitalPayload || ''}`;
      const hit = this.scanListingContent(combinedText);
      if (!hit) return false;
      return this.holdListingForReview(listingId, hit);
    } catch (err) {
      console.error('[ModerationService] Error scanning listing:', err);
      return false;
    }
  }

  public async processReport(
    reporterId: number,
    targetUserId: number,
    type: string,
    reason: string,
    priority: string = 'medium'
  ): Promise<ModerationResult> {
    return this.processReportAndEscalate(reporterId, targetUserId, type, reason, priority);
  }

  /**
   * Report-driven strikes only. Reason text never triggers instant blacklist
   * (avoids reporter writing "phishing" and banning the target).
   */
  public async processReportAndEscalate(
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

    await db.insert(reports).values({
      reporterId,
      targetUserId,
      type,
      priority,
      reason,
      status: 'active',
    });

    const activeReports = await db.select().from(reports).where(
      sql`${reports.targetUserId} = ${targetUserId} AND ${reports.status} IN ('active', 'pending')`
    );

    const strikeCount = activeReports.length;

    if (strikeCount === 1) {
      const notice = BotTemplates.strike1Warning({
        username: targetUser.username,
        reason,
        strikeNumber: 1,
        maxStrikes: 3,
      });
      await SystemBot.getInstance().sendToUser(targetUser.id, notice);

      await db.insert(auditLogs).values({
        logId: `mod_${Date.now()}_audit`,
        adminId: 999,
        adminName: 'SYSTEM_MODERATION',
        action: 'STRIKE_1_WARNING',
        targetId: String(targetUser.id),
        reason,
      });

      return { action: 'STRIKE_1_WARNING', strikeCount: 1, reason };
    }

    if (strikeCount === 2) {
      const notice = BotTemplates.strike2Restriction({
        username: targetUser.username,
        reason,
        strikeNumber: 2,
        maxStrikes: 3,
      });
      await SystemBot.getInstance().sendToUser(targetUser.id, notice);

      await db.insert(auditLogs).values({
        logId: `mod_${Date.now()}_audit`,
        adminId: 999,
        adminName: 'SYSTEM_MODERATION',
        action: 'STRIKE_2_RESTRICTION',
        targetId: String(targetUser.id),
        reason,
      });

      return { action: 'STRIKE_2_RESTRICTION', strikeCount: 2, reason };
    }

    const harvest = await this.executeInstantEcosystemBlacklist(
      targetUser.id,
      'STRIKE_3_MAX_REACHED',
      `Accumulated 3 policy strikes. Latest: ${reason}`
    );

    const finalNotice = BotTemplates.strike3Blacklist({
      username: targetUser.username,
      reason,
      strikeNumber: 3,
      maxStrikes: 3,
    });
    await SystemBot.getInstance().sendToUser(targetUser.id, finalNotice);

    await db
      .update(reports)
      .set({ status: 'resolved_blacklisted', updatedAt: new Date() })
      .where(eq(reports.targetUserId, targetUserId));

    return {
      action: 'STRIKE_3_BLACKLIST',
      strikeCount: 3,
      reason: `Accumulated ${strikeCount} strikes: ${reason}`,
      ecosystemHarvested: harvest,
    };
  }

  public async executeInstantEcosystemBlacklist(
    userId: number,
    violationType: string,
    reason: string
  ): Promise<{ ips: number; devices: number; fingerprints: number }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return { ips: 0, devices: 0, fingerprints: 0 };

    if (isReservedSystemUserId(user.id)) {
      console.warn(`[ModerationService] Cannot blacklist protected system account ${user.id}`);
      return { ips: 0, devices: 0, fingerprints: 0 };
    }

    const harvestedIps = new Set<string>();
    const harvestedDevices = new Set<string>();
    const harvestedFingerprints = new Set<string>();

    const sessList = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    sessList.forEach((s) => {
      if (s.ipAddress) harvestedIps.add(s.ipAddress);
    });

    const ipList = await db.select().from(ipAddresses).where(eq(ipAddresses.userId, user.id));
    ipList.forEach((ip) => {
      if (ip.ipAddress) harvestedIps.add(ip.ipAddress);
    });

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

    const entriesToInsert = [
      { userId: user.id, type: 'USERNAME', value: user.username, reason, bannedBy: 'SYSTEM_MODERATION' },
    ];

    for (const ip of harvestedIps) {
      entriesToInsert.push({
        userId: user.id,
        type: 'IP',
        value: ip,
        reason: `Ecosystem IP: ${reason}`,
        bannedBy: 'SYSTEM_MODERATION',
      });
    }
    for (const devId of harvestedDevices) {
      entriesToInsert.push({
        userId: user.id,
        type: 'DEVICE_ID',
        value: devId,
        reason: `Ecosystem Device: ${reason}`,
        bannedBy: 'SYSTEM_MODERATION',
      });
    }
    for (const fp of harvestedFingerprints) {
      entriesToInsert.push({
        userId: user.id,
        type: 'DEVICE_FINGERPRINT',
        value: fp,
        reason: `Ecosystem Fingerprint: ${reason}`,
        bannedBy: 'SYSTEM_MODERATION',
      });
    }

    for (const entry of entriesToInsert) {
      await db.insert(blacklist).values(entry).onConflictDoNothing();
    }

    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await userRepository.update(user.id, { role: 'BLOCKED' });

    const notice = BotTemplates.instantZeroToleranceBlacklist(user.username, violationType, reason);
    await SystemBot.getInstance().sendToUser(user.id, notice);

    await db.insert(auditLogs).values({
      logId: `mod_${Date.now()}_audit`,
      adminId: 999,
      adminName: 'SYSTEM_MODERATION',
      action: 'ECOSYSTEM_BLACKLIST',
      targetId: String(user.id),
      reason: `[${violationType}] ${reason} (Harvested: ${harvestedIps.size} IPs, ${harvestedDevices.size} Devs, ${harvestedFingerprints.size} FPs)`,
    });

    return {
      ips: harvestedIps.size,
      devices: harvestedDevices.size,
      fingerprints: harvestedFingerprints.size,
    };
  }

  public async pardonAndWhitelist(userIdOrUsername: string | number, reason: string = 'Admin Pardon'): Promise<boolean> {
    let user;
    if (typeof userIdOrUsername === 'number') {
      user = await userRepository.findById(userIdOrUsername);
    } else {
      const num = parseInt(userIdOrUsername, 10);
      user = !isNaN(num) ? await userRepository.findById(num) : await userRepository.findByUsername(userIdOrUsername);
    }

    if (!user) return false;

    await db.delete(blacklist).where(
      sql`${blacklist.userId} = ${user.id} OR ${blacklist.value} = ${user.username}`
    );

    if (user.role === 'BLOCKED' || user.role === 'BANNED') {
      await userRepository.update(user.id, { role: 'USER' });
    }

    await db.update(reports).set({ status: 'pardoned', updatedAt: new Date() }).where(eq(reports.targetUserId, user.id));

    const notice = BotTemplates.whitelistPardon(user.username, reason);
    await SystemBot.getInstance().sendToUser(user.id, notice);

    await db.insert(auditLogs).values({
      logId: `mod_${Date.now()}_audit`,
      adminId: 999,
      adminName: 'SYSTEM_MODERATION',
      action: 'WHITELIST_PARDON',
      targetId: String(user.id),
      reason,
    });

    return true;
  }

  public async listHeldListings(statusFilter: 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'ALL' = 'PENDING_REVIEW') {
    if (statusFilter === 'ALL') {
      return db
        .select()
        .from(listings)
        .where(inArray(listings.status, ['PENDING_REVIEW', 'REJECTED']))
        .orderBy(desc(listings.updatedAt))
        .limit(200);
    }
    return db
      .select()
      .from(listings)
      .where(eq(listings.status, statusFilter))
      .orderBy(desc(listings.heldAt), desc(listings.updatedAt))
      .limit(200);
  }

  public async reviewHeldListing(
    listingId: number,
    decision: 'PASS' | 'FAIL',
    adminId: number,
    notes?: string
  ): Promise<{ ok: boolean; listing?: typeof listings.$inferSelect; error?: string }> {
    const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
    if (!listing) return { ok: false, error: 'Listing not found' };

    const nextStatus = decision === 'PASS' ? 'ACTIVE' : 'REJECTED';
    const [updated] = await db
      .update(listings)
      .set({
        status: nextStatus,
        updatedAt: new Date(),
        ...(decision === 'PASS'
          ? { moderationReason: null, moderationLane: null, heldAt: null }
          : {}),
      })
      .where(eq(listings.id, listingId))
      .returning();

    await db.insert(auditLogs).values({
      logId: `mod_${Date.now()}_audit`,
      adminId,
      adminName: 'ADMIN_VERIFICATION',
      action: decision === 'PASS' ? 'LISTING_REVIEW_PASS' : 'LISTING_REVIEW_FAIL',
      targetId: String(listing.sellerId),
      reason: `Listing #${listingId} → ${nextStatus}${notes ? `: ${notes}` : ''}`,
    });

    const [seller] = await db.select().from(users).where(eq(users.id, listing.sellerId)).limit(1);
    if (seller) {
      const notice =
        decision === 'PASS'
          ? BotTemplates.marketplaceListingApproved(seller.username, listing.title)
          : BotTemplates.marketplaceListingRejected(seller.username, listing.title, notes || listing.moderationReason || 'Policy review');
      await SystemBot.getInstance().sendToUser(seller.id, notice);
    }

    return { ok: true, listing: updated };
  }
}

export const moderationService = ModerationService.getInstance();
