export type LoungeStaffRole = 'owner' | 'admin' | 'moderator' | 'member';

export type LoungeSettingsPageId =
  | 'members'
  | 'applications_invites'
  | 'lounge_info'
  | 'permissions'
  | 'moderation'
  | 'notifications'
  | 'danger_transfer'
  | 'danger_delete';

export type LoungeSettingsNavGroup = 'overview' | 'settings' | 'danger';

export interface LoungeSettingsNavItem {
  id: LoungeSettingsPageId;
  label: string;
  group: LoungeSettingsNavGroup;
}

export const LOUNGE_SETTINGS_NAV: LoungeSettingsNavItem[] = [
  { id: 'lounge_info', label: 'Lounge info', group: 'settings' },
  { id: 'permissions', label: 'Permissions', group: 'settings' },
  { id: 'moderation', label: 'Moderation', group: 'settings' },
  { id: 'notifications', label: 'Notifications', group: 'settings' },
  { id: 'members', label: 'Members', group: 'overview' },
  { id: 'applications_invites', label: 'Applications & Invites', group: 'overview' },
  { id: 'danger_transfer', label: 'Transfer ownership', group: 'danger' },
  { id: 'danger_delete', label: 'Delete lounge', group: 'danger' },
];

/** Nav group display order: Settings → Overview → Danger zone */
export const LOUNGE_SETTINGS_GROUP_ORDER: LoungeSettingsNavGroup[] = [
  'settings',
  'overview',
  'danger',
];

export function normalizeLoungeStaffRole(role: string | null | undefined): LoungeStaffRole {
  const r = String(role || 'member').toLowerCase().trim();
  if (r === 'owner') return 'owner';
  if (r === 'admin' || r === 'administrator') return 'admin';
  if (r === 'moderator' || r === 'mod') return 'moderator';
  return 'member';
}

const VELUM_OWNER_SYSTEM_ROLES = new Set(['CLI_ADMIN', 'LOGIN_ADMIN']);
const VELUM_ADMIN_SYSTEM_ROLES = new Set(['SUPPORT_ADMIN']);

export function isVelumOfficialLounge(opts: {
  loungeId?: string | null;
  slug?: string | null;
  isOfficial?: boolean | null;
  isSystem?: boolean | null;
}): boolean {
  const id = String(opts.loungeId || opts.slug || '');
  if (id === 'velum_master_lounge' || id === 'velum_lounge') return true;
  if (opts.isOfficial || opts.isSystem) return true;
  return false;
}

/**
 * Resolve lounge settings role.
 * OwnerId match wins. On Velum official lounge, system roles map:
 * CLI_ADMIN / LOGIN_ADMIN → owner · SUPPORT_ADMIN → admin.
 */
export function resolveLoungeSettingsRole(opts: {
  currentUserId: number | string;
  ownerId?: number | string | null;
  membershipRole?: string | null;
  /** Platform role e.g. CLI_ADMIN, LOGIN_ADMIN, SUPPORT_ADMIN */
  systemUserRole?: string | null;
  isVelumLounge?: boolean;
}): LoungeStaffRole {
  if (
    opts.ownerId != null &&
    String(opts.ownerId) !== '' &&
    String(opts.ownerId) === String(opts.currentUserId)
  ) {
    return 'owner';
  }

  if (opts.isVelumLounge && opts.systemUserRole) {
    const sys = String(opts.systemUserRole).toUpperCase();
    if (VELUM_OWNER_SYSTEM_ROLES.has(sys)) return 'owner';
    if (VELUM_ADMIN_SYSTEM_ROLES.has(sys)) return 'admin';
  }

  return normalizeLoungeStaffRole(opts.membershipRole);
}

export function canSeeLoungeSettingsPage(
  role: LoungeStaffRole,
  pageId: LoungeSettingsPageId
): boolean {
  if (pageId === 'members') return true;
  if (role === 'member') return false;
  if (pageId === 'danger_transfer' || pageId === 'danger_delete') {
    return role === 'owner';
  }
  // mod+ sees overview (except members already) + settings group
  return role === 'moderator' || role === 'admin' || role === 'owner';
}

export function visibleLoungeSettingsNav(role: LoungeStaffRole): LoungeSettingsNavItem[] {
  return LOUNGE_SETTINGS_NAV.filter((item) => canSeeLoungeSettingsPage(role, item.id));
}

export function defaultLoungeSettingsPage(role: LoungeStaffRole): LoungeSettingsPageId {
  if (role === 'member') return 'members';
  return 'lounge_info';
}
