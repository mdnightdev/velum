/** System / staff identities never appear in the user Contacts directory. */
const HIDDEN_CONTACT_IDS = new Set([1, 2, 999]);

const HIDDEN_CONTACT_ROLES = new Set([
  'CLI_ADMIN',
  'LOGIN_ADMIN',
  'SUPPORT_ADMIN',
  'SUPPORT_OPERATOR',
  'ADMIN',
  'BANK_ADMIN',
]);

export function isHiddenFromUserContacts(raw: {
  userId?: number | string | null;
  friendId?: number | string | null;
  id?: number | string | null;
  sender_id?: number | string | null;
  username?: string | null;
  sender_name?: string | null;
  role?: string | null;
}): boolean {
  const id = Number(raw.userId ?? raw.friendId ?? raw.id ?? raw.sender_id ?? NaN);
  if (Number.isFinite(id) && HIDDEN_CONTACT_IDS.has(id)) return true;

  const uname = String(raw.username ?? raw.sender_name ?? '')
    .replace(/^@/, '')
    .trim()
    .toLowerCase();
  if (uname === 'velum') return true;

  const role = String(raw.role ?? '')
    .trim()
    .toUpperCase();
  if (role && HIDDEN_CONTACT_ROLES.has(role)) return true;

  return false;
}

/** Clear peer from soft-deleted DM map so Chats list shows the conversation again. */
export function unDeleteContact(currentUserId: number, peerId: number) {
  try {
    const key = `velum_deleted_dms_${currentUserId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const next = parsed.filter((id: number) => Number(id) !== peerId);
      localStorage.setItem(key, JSON.stringify(next));
      return;
    }
    if (parsed && typeof parsed === 'object' && parsed[peerId] != null) {
      const next = { ...parsed };
      delete next[peerId];
      localStorage.setItem(key, JSON.stringify(next));
    }
  } catch {
    /* ignore */
  }
}
