/** Per-peer disappearing message modes (includes short timer for QA). */
export const DISAPPEAR_MODES = ['Off', '30 seconds', '24 hours', '7 days'] as const;
export type DisappearMode = (typeof DISAPPEAR_MODES)[number];

const MODE_SECONDS: Record<DisappearMode, number | null> = {
  Off: null,
  '30 seconds': 30,
  '24 hours': 24 * 60 * 60,
  '7 days': 7 * 24 * 60 * 60,
};

export function disappearModeToSeconds(mode: DisappearMode): number | null {
  return MODE_SECONDS[mode] ?? null;
}

export function secondsToDisappearMode(seconds: number | null | undefined): DisappearMode {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return 'Off';
  if (seconds <= 30) return '30 seconds';
  if (seconds <= 24 * 60 * 60) return '24 hours';
  return '7 days';
}

export function computeExpiresAtIso(
  expiresInSeconds: number | null | undefined,
  fromMs: number = Date.now()
): string | null {
  if (expiresInSeconds == null || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    return null;
  }
  return new Date(fromMs + expiresInSeconds * 1000).toISOString();
}

export function isMessageExpired(msg: {
  expires_at?: string | null;
  expiresAt?: string | null;
  expires_in?: string | number | null;
  timestamp?: string | number | null;
  created_at?: string | number | null;
  createdAt?: string | number | null;
}, nowMs: number = Date.now()): boolean {
  const direct = msg.expires_at || msg.expiresAt;
  if (direct) {
    const t = Date.parse(String(direct));
    return Number.isFinite(t) && t <= nowMs;
  }
  const raw = msg.expires_in;
  const sec = typeof raw === 'number' ? raw : raw != null ? parseInt(String(raw), 10) : NaN;
  if (!Number.isFinite(sec) || sec <= 0) return false;
  const createdRaw = msg.timestamp || msg.created_at || msg.createdAt;
  const created = createdRaw != null ? Date.parse(String(createdRaw)) : NaN;
  if (!Number.isFinite(created)) return false;
  return created + sec * 1000 <= nowMs;
}
