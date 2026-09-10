/** Reserved Velum system user IDs — never assign to ordinary or test accounts. */
export const RESERVED_SYSTEM_USER_IDS = new Set<number>([1, 2, 999]);

export const RESERVED_SYSTEM_USERNAMES = new Set<string>([
  'midnight',
  'lexie',
  'velum',
  'system_bot',
]);

/** First ID allowed for real public / SA registrations. */
export const MIN_PUBLIC_USER_ID = 1000;

/** Last ID for real public accounts. Above this is the disposable test band. */
export const MAX_PUBLIC_USER_ID = 8999;

/**
 * Disposable test / chaos / integration accounts.
 * Drop with: DELETE cascade via scripts/purge-test-accounts.ts
 * or SQL: users WHERE id BETWEEN 9000 AND 9999
 */
export const TEST_USER_ID_MIN = 9000;
export const TEST_USER_ID_MAX = 9999;

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

export function isTestUserId(id: number | null | undefined): boolean {
  if (id == null || !Number.isFinite(id)) return false;
  const n = Number(id);
  return n >= TEST_USER_ID_MIN && n <= TEST_USER_ID_MAX;
}

/** True when an ID must not be issued to a normal (non-system, non-test) insert. */
export function isForbiddenPublicUserId(id: number | null | undefined): boolean {
  if (id == null || !Number.isFinite(id)) return false;
  const n = Number(id);
  if (n < MIN_PUBLIC_USER_ID || isReservedSystemUserId(n)) return true;
  if (isTestUserId(n)) return true;
  if (n > MAX_PUBLIC_USER_ID && !isTestUserId(n)) return true;
  return false;
}

export function isReservedSystemLoungeId(id: number | null | undefined): boolean {
  if (id == null || !Number.isFinite(id)) return false;
  return RESERVED_SYSTEM_LOUNGE_IDS.has(Number(id));
}
