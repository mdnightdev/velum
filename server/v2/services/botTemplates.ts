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
      `Strike 1`,
      `${ctx.username}, this is a warning.`,
      `Reason: ${ctx.reason}`,
      `Status: 1 of ${ctx.maxStrikes || 3}`,
      `More issues can mean limits or a permanent ban.`,
    ].join('\n');
  },

  strike2Restriction(ctx: StrikeNoticeContext): string {
    return [
      `Strike 2`,
      `${ctx.username}, messaging is limited for 48 hours.`,
      `Reason: ${ctx.reason}`,
      `Status: 2 of ${ctx.maxStrikes || 3}`,
      `One more strike means a permanent ban.`,
    ].join('\n');
  },

  strike3Blacklist(ctx: StrikeNoticeContext): string {
    return [
      `Banned`,
      `${ctx.username}, your account is permanently banned.`,
      `Reason: ${ctx.reason}`,
      `Sessions ended.`,
    ].join('\n');
  },

  instantZeroToleranceBlacklist(username: string, violation: string, reason: string): string {
    return [
      `Banned`,
      `${username}, your account is permanently banned.`,
      `Category: ${violation}`,
      `Reason: ${reason}`,
      `Sessions ended.`,
    ].join('\n');
  },

  marketplaceMaliciousListingDropped(sellerUsername: string, listingTitle: string, reason: string): string {
    return [
      `Listing held`,
      `${sellerUsername}, "${listingTitle}" is held for review.`,
      `Reason: ${reason}`,
      `Your account was not banned. You will get an update.`,
    ].join('\n');
  },

  marketplaceListingHeldForReview(
    sellerUsername: string,
    listingTitle: string,
    lane: string,
    match: string
  ): string {
    return [
      `Listing held`,
      `${sellerUsername}, "${listingTitle}" is not public yet.`,
      `Lane: ${lane}`,
      `Match: ${match}`,
      `Held for review — account not banned.`,
    ].join('\n');
  },

  marketplaceListingApproved(sellerUsername: string, listingTitle: string): string {
    return [
      `Listing live`,
      `${sellerUsername}, "${listingTitle}" is now public.`,
    ].join('\n');
  },

  marketplaceListingRejected(sellerUsername: string, listingTitle: string, reason: string): string {
    return [
      `Listing rejected`,
      `${sellerUsername}, "${listingTitle}" was not approved.`,
      `Reason: ${reason}`,
      `You can edit and resubmit.`,
    ].join('\n');
  },

  whitelistPardon(username: string, reason: string): string {
    return [
      `Access restored`,
      `${username}, your account access is restored.`,
      `Reason: ${reason}`,
      `You can sign in again.`,
    ].join('\n');
  },

  welcomeUser(username: string, recoveryKey: string): string {
    return [
      `Welcome to Velum, ${username}`,
      `Recovery key: ${recoveryKey}`,
      `Store it safely. It will not be shown again.`,
    ].join('\n');
  },

  supportNominationPending(): string {
    return [
      `You are approved for the Support role.`,
      `Accept or decline to continue.`,
    ].join('\n');
  },

  supportNominationRejected(reason?: string): string {
    return [
      `Support nomination declined.`,
      `Reason: ${reason || 'Review decision.'}`,
    ].join('\n');
  },

  supportNominationRevoked(reason?: string): string {
    return [
      `Support role removed.`,
      `Reason: ${reason || 'Admin action.'}`,
    ].join('\n');
  },

  supportCredentialsDelivered(creds: {
    username: string;
    password?: string;
    passcode?: string;
    recoveryKey: string;
    panicPhrase?: string;
  }): string {
    const lines = [`Username: ${creds.username}`];
    if (creds.password) lines.push(`Password: ${creds.password}`);
    if (creds.passcode) lines.push(`Passcode: ${creds.passcode}`);
    lines.push(`Recovery key: ${creds.recoveryKey}`);
    if (creds.panicPhrase) lines.push(`Panic phrase: ${creds.panicPhrase}`);
    return lines.join('\n');
  },

  supportNominationDeclinedUser(): string {
    return `You declined the Support role. Credentials were removed.`;
  },

  supportNominationStatusToAdmin(username: string, userId: number, status: 'ACCEPTED' | 'DECLINED'): string {
    return `Support ${status.toLowerCase()}: @${username} (${userId})`;
  },

  emergencyPanicExecuted(): string {
    return `Panic executed.`;
  },
};
