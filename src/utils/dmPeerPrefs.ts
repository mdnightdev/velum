import type { MuteDurationId } from '../constants/notificationSounds';

const MUTE_KEY = 'velum-dm-mutes';
const MEDIA_KEY = 'velum-dm-media-prefs';

export type DmMediaPrefs = {
  autoDownload: boolean;
  saveToDevice: boolean;
};

const DEFAULT_MEDIA: DmMediaPrefs = {
  autoDownload: true,
  saveToDevice: true,
};

type MuteMap = Record<string, number>; // peerId -> mutedUntil epoch ms (0 = unmuted)

function readMuteMap(): MuteMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MUTE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as MuteMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMuteMap(map: MuteMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MUTE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function setPeerMutedLocal(
  peerId: number,
  muted: boolean,
  mutedUntilIso?: string | null,
  duration?: MuteDurationId | string | null
): void {
  if (!Number.isFinite(peerId) || peerId <= 0) return;
  const map = readMuteMap();
  const key = String(peerId);
  if (!muted) {
    delete map[key];
    writeMuteMap(map);
    return;
  }
  let until = mutedUntilIso ? Date.parse(mutedUntilIso) : NaN;
  if (!Number.isFinite(until)) {
    const seconds: Record<string, number> = {
      '24h': 24 * 60 * 60,
      '72h': 72 * 60 * 60,
      '30d': 30 * 24 * 60 * 60,
    };
    const sec = (duration && seconds[duration]) || seconds['24h'];
    until = Date.now() + sec * 1000;
  }
  map[key] = until;
  writeMuteMap(map);
}

/** Merge server mute list into local cache (session hydrate). */
export function hydrateMutesFromServer(
  mutes: Array<{ peerId: number; mutedUntil?: string | null; duration?: string | null }>
): void {
  const map = readMuteMap();
  const now = Date.now();
  for (const key of Object.keys(map)) {
    if (!map[key] || map[key] <= now) delete map[key];
  }
  for (const m of mutes) {
    const peerId = Number(m.peerId);
    if (!Number.isFinite(peerId) || peerId <= 0) continue;
    let until = m.mutedUntil ? Date.parse(m.mutedUntil) : NaN;
    if (!Number.isFinite(until)) {
      const seconds: Record<string, number> = {
        '24h': 24 * 60 * 60,
        '72h': 72 * 60 * 60,
        '30d': 30 * 24 * 60 * 60,
      };
      const sec = (m.duration && seconds[m.duration]) || 0;
      if (sec > 0) until = now + sec * 1000;
    }
    if (Number.isFinite(until) && until > now) {
      map[String(peerId)] = until;
    }
  }
  writeMuteMap(map);
}

export function isPeerMuted(peerId: number): boolean {
  if (!Number.isFinite(peerId) || peerId <= 0) return false;
  const map = readMuteMap();
  const until = map[String(peerId)];
  if (!until) return false;
  if (Date.now() >= until) {
    delete map[String(peerId)];
    writeMuteMap(map);
    return false;
  }
  return true;
}

export function getPeerMuteUntil(peerId: number): number | null {
  if (!isPeerMuted(peerId)) return null;
  return readMuteMap()[String(peerId)] || null;
}

type MediaMap = Record<string, DmMediaPrefs>;

function readMediaMap(): MediaMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MEDIA_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as MediaMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMediaMap(map: MediaMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MEDIA_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getDmMediaPrefs(peerId: number): DmMediaPrefs {
  if (!Number.isFinite(peerId) || peerId <= 0) return { ...DEFAULT_MEDIA };
  const stored = readMediaMap()[String(peerId)];
  return stored ? { ...DEFAULT_MEDIA, ...stored } : { ...DEFAULT_MEDIA };
}

export function setDmMediaPrefs(peerId: number, prefs: Partial<DmMediaPrefs>): DmMediaPrefs {
  const next = { ...getDmMediaPrefs(peerId), ...prefs };
  const map = readMediaMap();
  map[String(peerId)] = next;
  writeMediaMap(map);
  return next;
}

export function shouldAutoDownloadMedia(peerId: number | null | undefined): boolean {
  if (peerId == null || !Number.isFinite(peerId)) return true;
  return getDmMediaPrefs(peerId).autoDownload;
}

export function shouldSaveMediaToDevice(peerId: number | null | undefined): boolean {
  if (peerId == null || !Number.isFinite(peerId)) return true;
  return getDmMediaPrefs(peerId).saveToDevice;
}
