import { theme } from './theme.js';

export const PROTECTED_SYSTEM_USER_IDS = new Set<number>([1, 2, 999]);
export const PROTECTED_SYSTEM_USERNAMES = new Set<string>(['midnight', 'lexie', 'velum', 'system_bot']);

export const PROTECTED_SYSTEM_LOUNGE_IDS = new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
export const PROTECTED_SYSTEM_LOUNGE_SLUGS = new Set<string>([
  'velum_lounge',
  'velum_general',
  'velum_market',
  'velum_escrow',
  'velum_offtopic',
  'velum_bugs',
  'velum_support',
  'velum_suggestions',
  'velum_events',
  'velum_announcements',
  'velum_executives'
]);

export function isProtectedUser(idOrUsername: number | string | null | undefined): boolean {
  if (idOrUsername === null || idOrUsername === undefined) return false;
  if (typeof idOrUsername === 'number') {
    return PROTECTED_SYSTEM_USER_IDS.has(idOrUsername);
  }
  const num = parseInt(idOrUsername, 10);
  if (!isNaN(num) && PROTECTED_SYSTEM_USER_IDS.has(num)) {
    return true;
  }
  return PROTECTED_SYSTEM_USERNAMES.has(idOrUsername.toLowerCase());
}

export function guardProtectedUser(idOrUsername: number | string | null | undefined, action: string = 'modify'): boolean {
  if (isProtectedUser(idOrUsername)) {
    console.log(`${theme.red}Operation not permitted.${theme.reset}`);
    return false;
  }
  return true;
}

export function isProtectedLounge(idOrSlug: number | string | null | undefined): boolean {
  if (idOrSlug === null || idOrSlug === undefined) return false;
  if (typeof idOrSlug === 'number') {
    return PROTECTED_SYSTEM_LOUNGE_IDS.has(idOrSlug);
  }
  const num = parseInt(idOrSlug, 10);
  if (!isNaN(num) && PROTECTED_SYSTEM_LOUNGE_IDS.has(num)) {
    return true;
  }
  return PROTECTED_SYSTEM_LOUNGE_SLUGS.has(idOrSlug.toLowerCase());
}

export function guardProtectedLounge(idOrSlug: number | string | null | undefined, action: string = 'modify'): boolean {
  if (isProtectedLounge(idOrSlug)) {
    console.log(`${theme.red}Operation not permitted.${theme.reset}`);
    return false;
  }
  return true;
}
