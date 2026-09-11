import { theme } from './theme.js';
import {
  RESERVED_SYSTEM_USER_IDS,
  RESERVED_SYSTEM_USERNAMES,
  RESERVED_SYSTEM_LOUNGE_IDS,
  isReservedSystemUserId,
  isReservedSystemUsername,
  isReservedSystemLoungeId,
} from '../../server/v2/constants/systemIds.js';

export const PROTECTED_SYSTEM_USER_IDS = RESERVED_SYSTEM_USER_IDS;
export const PROTECTED_SYSTEM_USERNAMES = RESERVED_SYSTEM_USERNAMES;
export const PROTECTED_SYSTEM_LOUNGE_IDS = RESERVED_SYSTEM_LOUNGE_IDS;
export const PROTECTED_SYSTEM_LOUNGE_SLUGS = new Set<string>([
  'velum_lounge',
  'velum_master_lounge',
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
    return isReservedSystemUserId(idOrUsername);
  }
  const num = parseInt(idOrUsername, 10);
  if (!isNaN(num) && isReservedSystemUserId(num)) {
    return true;
  }
  return isReservedSystemUsername(idOrUsername);
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
    return isReservedSystemLoungeId(idOrSlug);
  }
  const num = parseInt(idOrSlug, 10);
  if (!isNaN(num) && isReservedSystemLoungeId(num)) {
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
