import { stripAt } from '../types';

export type ContactNameFields = {
  nickname?: string | null;
  displayName?: string | null;
  username?: string | null;
  fallback?: string;
};

/** Prefer owner-set nickname, then display name, then username. */
export function resolveContactName(fields: ContactNameFields): string {
  const nickname = stripAt(String(fields.nickname || '').trim());
  if (nickname) return nickname;

  const displayName = stripAt(String(fields.displayName || '').trim());
  if (displayName) return displayName;

  const username = stripAt(String(fields.username || '').trim());
  if (username) return username;

  return fields.fallback || 'Contact';
}

export function contactNameStorageKey(ownerId: number, targetId: number): string {
  return `velum_nickname_${ownerId}_${targetId}`;
}

export function readStoredNickname(ownerId: number, targetId: number): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(contactNameStorageKey(ownerId, targetId)) || '';
  } catch {
    return '';
  }
}

export function writeStoredNickname(ownerId: number, targetId: number, nickname: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const key = contactNameStorageKey(ownerId, targetId);
    if (nickname) localStorage.setItem(key, nickname);
    else localStorage.removeItem(key);
  } catch {
    // ignore quota / private mode
  }
}
