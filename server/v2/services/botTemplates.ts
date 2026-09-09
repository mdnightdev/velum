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

  welcomeUser(username: string, recoveryKey: string): string {
    return [
      `Welcome to Velum, ${username}`,
      `Your recovery key is: \`${recoveryKey}\``,
      `Store this securely. It will not be shown again.`
    ].join('\n');
  },

  supportNominationPending(): string {
    return [
      `You have been approved for the Support Admin role.`,
      `To proceed, accept or decline this role.`
    ].join('\n');
  },

  supportNominationRejected(reason?: string): string {
    return [
      `Your Support Admin nomination was declined.`,
      `Reason: ${reason || 'Standard operational review.'}`
    ].join('\n');
  },

  supportNominationRevoked(reason?: string): string {
    return [
      `Your Support Admin privileges have been revoked.`,
      `Reason: ${reason || 'Administrative action.'}`
    ].join('\n');
  },

  supportCredentialsDelivered(creds: { username: string; password?: string; passcode?: string; recoveryKey: string; panicPhrase?: string }): string {
    const lines = [
      `Username: ${creds.username}`
    ];
    if (creds.password) lines.push(`Password: ${creds.password}`);
    if (creds.passcode) lines.push(`Passcode: ${creds.passcode}`);
    lines.push(`Recovery Key: \`${creds.recoveryKey}\``);
    if (creds.panicPhrase) lines.push(`Panic Phrase: \`${creds.panicPhrase}\``);
    return lines.join('\n');
  },

  supportNominationDeclinedUser(): string {
    return `You have declined the Support Administrator role. Credentials have been purged.`;
  },

  supportNominationStatusToAdmin(username: string, userId: number, status: 'ACCEPTED' | 'DECLINED'): string {
    return `Support role ${status}: @${username} (ID: ${userId})`;
  },

  emergencyPanicExecuted(): string {
    return `Panic executed.`;
  }
};
