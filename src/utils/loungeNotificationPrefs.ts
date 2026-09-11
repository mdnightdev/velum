/**
 * Per-lounge notification preferences (client device).
 * Scoped by lounge id — never applied to other lounges.
 */

export type LoungeNotifLevel = 'all' | 'mentions' | 'nothing';
export type LoungeNotifStyle = 'default' | 'quiet' | 'heads_up';

export interface LoungeNotificationPrefs {
  /** Maps to server mute_rule: all→off, mentions→mentions_only, nothing→forever */
  level: LoungeNotifLevel;
  showPreview: boolean;
  sound: boolean;
  vibrate: boolean;
  style: LoungeNotifStyle;
  notificationLight: boolean;
  /** When true, do not force alerts through system Do Not Disturb */
  respectDnd: boolean;
}

export const DEFAULT_LOUNGE_NOTIF_PREFS: LoungeNotificationPrefs = {
  level: 'all',
  showPreview: true,
  sound: true,
  vibrate: true,
  style: 'default',
  notificationLight: true,
  respectDnd: true,
};

const STORAGE_PREFIX = 'velum-lounge-notif:';

export function muteRuleToLevel(rule: string): LoungeNotifLevel {
  if (rule === 'mentions_only') return 'mentions';
  if (rule === 'forever') return 'nothing';
  return 'all';
}

export function levelToMuteRule(level: LoungeNotifLevel): 'off' | 'mentions_only' | 'forever' {
  if (level === 'mentions') return 'mentions_only';
  if (level === 'nothing') return 'forever';
  return 'off';
}

export function getLoungeNotificationPrefs(loungeId: string): LoungeNotificationPrefs {
  if (typeof window === 'undefined' || !loungeId) return { ...DEFAULT_LOUNGE_NOTIF_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + loungeId);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_LOUNGE_NOTIF_PREFS, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_LOUNGE_NOTIF_PREFS };
}

export function saveLoungeNotificationPrefs(
  loungeId: string,
  patch: Partial<LoungeNotificationPrefs>
): LoungeNotificationPrefs {
  if (typeof window === 'undefined' || !loungeId) return { ...DEFAULT_LOUNGE_NOTIF_PREFS };
  const next = { ...getLoungeNotificationPrefs(loungeId), ...patch };
  try {
    localStorage.setItem(STORAGE_PREFIX + loungeId, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

/** True if this message should alert for the lounge given level + mention check. */
export function shouldAlertForLoungeMessage(
  loungeId: string | undefined,
  content: string | undefined,
  myUsername: string | undefined
): boolean {
  if (!loungeId) return true;
  const prefs = getLoungeNotificationPrefs(loungeId);
  if (prefs.level === 'nothing') return false;
  if (prefs.level === 'all') return true;
  // mentions
  if (!myUsername || !content) return false;
  const mention = `@${String(myUsername).replace(/^@/, '')}`.toLowerCase();
  return content.toLowerCase().includes(mention);
}
