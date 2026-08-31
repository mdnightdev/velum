/**
 * Centralized Velum Bot Message Templates
 * Clean, professional formatting without ASCII borders.
 */

export interface StrikeNoticeContext {
  username: string;
  reason: string;
  strikeNumber: number;
  maxStrikes?: number;
  reportId?: string | number;
  actionTaken?: string;
}

export const BotTemplates = {
  strike1Warning(ctx: StrikeNoticeContext): string {
    return [
      `### Account Notice: Strike 1 Warning`,
      `Hello ${ctx.username}, your account has received an official warning.`,
      ``,
      `**Details:**`,
      `- **Reason:** ${ctx.reason}`,
      `- **Status:** Strike 1 of ${ctx.maxStrikes || 3}`,
      `- **Action Taken:** Official Warning Issued`,
      ``,
      `Please adhere to platform community guidelines. Continued violations will result in temporary restrictions or permanent suspension.`
    ].join('\n');
  },

  strike2Restriction(ctx: StrikeNoticeContext): string {
    return [
      `### Account Notice: Strike 2 Temporary Restriction`,
      `Hello ${ctx.username}, your account has received a second strike for repeated policy violations.`,
      ``,
      `**Details:**`,
      `- **Reason:** ${ctx.reason}`,
      `- **Status:** Strike 2 of ${ctx.maxStrikes || 3}`,
      `- **Action Taken:** 48-Hour Messaging & Interaction Restriction`,
      ``,
      `This is your final warning. A third strike will result in an immediate and permanent ecosystem blacklist.`
    ].join('\n');
  },

  strike3Blacklist(ctx: StrikeNoticeContext): string {
    return [
      `### Account Notice: Permanent Blacklist (Strike 3)`,
      `Hello ${ctx.username}, your account has accumulated 3 strikes and has been permanently blacklisted.`,
      ``,
      `**Details:**`,
      `- **Reason:** ${ctx.reason}`,
      `- **Status:** Strike 3 (Final)`,
      `- **Action Taken:** Permanent Account & Device Blacklist`,
      ``,
      `All active sessions have been terminated. Access to the Velum platform is permanently revoked.`
    ].join('\n');
  },

  instantZeroToleranceBlacklist(username: string, violation: string, reason: string): string {
    return [
      `### Security Alert: Immediate Permanent Blacklist`,
      `Hello ${username}, your account has been immediately blacklisted for a critical platform violation.`,
      ``,
      `**Details:**`,
      `- **Violation Category:** ${violation}`,
      `- **Reason:** ${reason}`,
      `- **Action Taken:** Immediate Ecosystem Blacklist & Session Termination`,
      ``,
      `Zero-tolerance violations (such as financial fraud, credential phishing, malicious scripts, or exploitation) result in immediate, non-appealable suspension.`
    ].join('\n');
  },

  marketplaceMaliciousListingDropped(sellerUsername: string, listingTitle: string, reason: string): string {
    return [
      `### Marketplace Notice: Listing Removed & Sanitized`,
      `Hello ${sellerUsername}, your marketplace listing has been permanently removed.`,
      ``,
      `**Details:**`,
      `- **Listing:** ${listingTitle}`,
      `- **Violation:** Malicious Content / Prohibited Script Detected`,
      `- **Reason:** ${reason}`,
      `- **Action Taken:** Listing Dropped and Sanitized`,
      ``,
      `Publishing malicious code, exploits, or deceptive payloads violates Velum terms and may lead to immediate account blacklisting.`
    ].join('\n');
  },

  whitelistPardon(username: string, reason: string): string {
    return [
      `### Account Update: Blacklist Exemption Granted`,
      `Hello ${username}, your account access has been reviewed and restored.`,
      ``,
      `**Details:**`,
      `- **Reason:** ${reason}`,
      `- **Action Taken:** Ecosystem Blacklist Purged & Role Restored`,
      ``,
      `You may now log in and use your Velum account normally.`
    ].join('\n');
  },

  supportNominationApproved(username: string): string {
    return [
      `### Administrator Notice: Support Role Nomination Approved`,
      `Hello ${username}, you have been approved for the Support Administrator role.`,
      ``,
      `**Next Steps:**`,
      `1. Your credentials and recovery phrase have been generated.`,
      `2. Please review and accept this role in your settings to activate access.`,
      `3. If you decline, the credentials will be purged automatically.`
    ].join('\n');
  },

  supportNominationRevoked(username: string, reason: string): string {
    return [
      `### Administrator Notice: Support Role Revoked`,
      `Hello ${username}, your Support Administrator privileges have been revoked.`,
      ``,
      `**Details:**`,
      `- **Reason:** ${reason}`,
      `- **Status:** Returned to Standard User`,
      ``,
      `Your standard user account remains active.`
    ].join('\n');
  }
};
