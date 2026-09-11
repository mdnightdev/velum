/** Role rank for roster ordering: administrators first, then members. */
const ROLE_RANK: Record<string, number> = {
  owner: 0,
  admin: 1,
  administrator: 1,
  moderator: 2,
  mod: 2,
  member: 3,
};

export function loungeRoleRank(role: string | null | undefined): number {
  if (!role) return ROLE_RANK.member;
  const key = String(role).toLowerCase().trim();
  return ROLE_RANK[key] ?? ROLE_RANK.member;
}

export function sortMembersAdminsFirst<T extends { role?: string | null; username?: string | null; user_id?: number | string }>(
  members: T[]
): T[] {
  return [...members].sort((a, b) => {
    const rankDiff = loungeRoleRank(a.role) - loungeRoleRank(b.role);
    if (rankDiff !== 0) return rankDiff;
    const nameA = (a.username || '').toLowerCase();
    const nameB = (b.username || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

export function parseLoungeMembersPayload(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as { members?: unknown; users?: unknown };
    if (Array.isArray(obj.members)) return obj.members;
    if (Array.isArray(obj.users)) return obj.users;
  }
  return [];
}

export function filterRealLoungeMembers(members: any[]): any[] {
  return members.filter(
    (u) =>
      u &&
      u.user_id !== 999 &&
      !(u.username?.toLowerCase() === 'velum' || u.username?.toLowerCase() === 'velum-msg')
  );
}

export function normalizeLoungeMembersPayload(data: unknown): any[] {
  return sortMembersAdminsFirst(filterRealLoungeMembers(parseLoungeMembersPayload(data)));
}
