export type UserProfileData = {
  userId: number;
  username: string;
  displayName?: string;
  nickname?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  joinedDate?: string;
  status?: string;
  role?: 'USER' | 'LOGIN_ADMIN' | 'SUPPORT_OPERATOR';
  isMuted?: boolean;
  mutedUntil?: string | null;
  muteDuration?: '24h' | '72h' | '30d' | 'off' | string | null;
  isBlocked?: boolean;
  stats?: {
    loungesCount: number;
    connectionsCount: number;
  };
};

export type ProfileCardProps = {
  type?: 'user' | 'admin';
  user?: UserProfileData;
  variant: 'mobile' | 'expanded' | 'popover';
  onClose: () => void;
  onMessage?: () => void;
  onMute?: (duration?: '24h' | '72h' | '30d' | 'off') => void;
  onBlock?: () => void;
  onDeleteChat?: () => void;
  onReport?: (reason?: string, attachments?: string[]) => void;
  onViewProfile?: () => void;
  onForceRekey?: () => void;
  /** Used to resolve DM room aliases when loading chat media. */
  currentUserId?: number;
};

/** Normalize heterogeneous API / list shapes into UserProfileData. */
export function toUserProfileData(raw: Record<string, unknown>): UserProfileData {
  const userId = Number(raw.userId ?? raw.user_id ?? raw.id ?? 0);
  const username = String(raw.username ?? '');
  const displayName =
    (raw.displayName as string | undefined) ||
    username.replace('@', '') ||
    undefined;
  const createdAt = raw.created_at ?? raw.createdAt ?? raw.joinedDate;
  let joinedDate: string | undefined =
    typeof raw.joinedDate === 'string' ? raw.joinedDate : undefined;
  if (!joinedDate && createdAt) {
    const d = new Date(createdAt as string | number);
    if (!Number.isNaN(d.getTime())) {
      joinedDate = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  }

  const role = raw.role as UserProfileData['role'] | undefined;
  const nestedStats = raw.stats as UserProfileData['stats'] | undefined;
  const stats: UserProfileData['stats'] = nestedStats || {
    loungesCount: Number(raw.loungesCount ?? 0),
    connectionsCount: Number(raw.connectionsCount ?? 0),
  };

  return {
    userId,
    username,
    displayName,
    nickname: (raw.nickname as string | undefined) || '',
    avatarUrl: (raw.avatarUrl as string | undefined) || (raw.avatar as string | undefined) || '',
    bio: (raw.bio as string | undefined) || '',
    location: (raw.location as string | undefined) || '',
    joinedDate: joinedDate || '',
    status: (raw.status as string | undefined) || '',
    role,
    isMuted: !!raw.isMuted,
    mutedUntil: (raw.mutedUntil as string | null | undefined) || null,
    muteDuration: (raw.muteDuration as string | null | undefined) || null,
    isBlocked: !!raw.isBlocked,
    stats,
  };
}
