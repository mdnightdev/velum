/** Forbidden system account IDs — never discover, friend, or DM from chaos. */
export const PROTECTED_USER_IDS = new Set<number>([1, 2, 999]);

export const PROTECTED_USERNAMES = new Set<string>([
  'midnight',
  'lexie',
  'velum',
  'system_bot',
]);

export function isProtectedUser(id: number, username?: string): boolean {
  if (PROTECTED_USER_IDS.has(id)) return true;
  if (username && PROTECTED_USERNAMES.has(username.toLowerCase())) return true;
  return false;
}
