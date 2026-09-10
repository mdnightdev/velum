const ROLE_LABELS: Record<string, string> = {
  CLI_ADMIN: 'Cli',
  LOGIN_ADMIN: 'Login',
  SUPPORT_ADMIN: 'Support',
  SUPPORT_OPERATOR: 'Support',
  ADMIN: 'Admin',
  BANK_ADMIN: 'Bank',
  USER: 'User',
  MEMBER: 'User',
  BLOCKED: 'Blocked',
  SYSTEM: 'System',
};

/** Wire role → short UI label. Auth still uses the wire string. */
export function formatRoleLabel(role: string | null | undefined): string {
  if (!role || !role.trim()) return 'User';
  const key = role.trim().toUpperCase();
  if (ROLE_LABELS[key]) return ROLE_LABELS[key];
  const head = key.split(/[_-]+/)[0] || key;
  return head.charAt(0) + head.slice(1).toLowerCase();
}
