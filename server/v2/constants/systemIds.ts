/** Reserved Velum system user IDs — never assign to ordinary or test accounts. */
export const RESERVED_SYSTEM_USER_IDS = new Set<number>([1, 2, 999]);

export const RESERVED_SYSTEM_USERNAMES = new Set<string>([
  'midnight',
  'lexie',
  'velum',
  'system_bot',
]);

/** First ID allowed for public / test / SA registrations. */
export const MIN_PUBLIC_USER_ID = 1000;

/** Official Velum lounge IDs (master + sublounges). User lounges start at 1000+. */
export const RESERVED_SYSTEM_LOUNGE_IDS = new Set<number>([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
]);

export const MIN_PUBLIC_LOUNGE_ID = 1000;

export function isReservedSystemUserId(id: number | null | undefined): boolean {
  if (id == null || !Number.isFinite(id)) return false;
  return RESERVED_SYSTEM_USER_IDS.has(Number(id));
}

export function isReservedSystemUsername(username: string | null | undefined): boolean {
  if (!username) return false;
  return RESERVED_SYSTEM_USERNAMES.has(username.toLowerCase());
}

/** True when an ID must not be issued to a non-system insert. */
export function isForbiddenPublicUserId(id: number | null | undefined): boolean {
  if (id == null || !Number.isFinite(id)) return false;
  const n = Number(id);
  return n < MIN_PUBLIC_USER_ID || isReservedSystemUserId(n);
}

export function isReservedSystemLoungeId(id: number | null | undefined): boolean {
  if (id == null || !Number.isFinite(id)) return false;
  return RESERVED_SYSTEM_LOUNGE_IDS.has(Number(id));
}
