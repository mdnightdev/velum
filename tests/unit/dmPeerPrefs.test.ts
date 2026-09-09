import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getDmMediaPrefs,
  hydrateMutesFromServer,
  isPeerMuted,
  setDmMediaPrefs,
  setPeerMutedLocal,
  shouldAutoDownloadMedia,
  shouldSaveMediaToDevice,
} from '../../src/utils/dmPeerPrefs';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    clear: () => { store = {}; },
    removeItem: (key: string) => { delete store[key]; }
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

Object.defineProperty(globalThis, 'window', {
  value: globalThis,
  writable: true,
});



describe('dmPeerPrefs', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('tracks timed mute until expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    setPeerMutedLocal(42, true, '2026-01-01T01:00:00.000Z', '24h');
    expect(isPeerMuted(42)).toBe(true);
    vi.setSystemTime(new Date('2026-01-01T01:00:01.000Z'));
    expect(isPeerMuted(42)).toBe(false);
  });

  it('clears mute on unmute', () => {
    setPeerMutedLocal(7, true, null, '24h');
    expect(isPeerMuted(7)).toBe(true);
    setPeerMutedLocal(7, false);
    expect(isPeerMuted(7)).toBe(false);
  });

  it('hydrates mutes from server without wiping fresher local entries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    setPeerMutedLocal(3, true, '2026-01-01T12:00:00.000Z', '24h');
    hydrateMutesFromServer([
      { peerId: 9, mutedUntil: '2026-01-01T02:00:00.000Z', duration: '24h' },
    ]);
    expect(isPeerMuted(3)).toBe(true);
    expect(isPeerMuted(9)).toBe(true);
  });

  it('persists media prefs and defaults to auto', () => {
    expect(shouldAutoDownloadMedia(9)).toBe(true);
    expect(shouldSaveMediaToDevice(9)).toBe(true);
    setDmMediaPrefs(9, { autoDownload: false, saveToDevice: false });
    expect(getDmMediaPrefs(9)).toEqual({ autoDownload: false, saveToDevice: false });
    expect(shouldAutoDownloadMedia(9)).toBe(false);
    expect(shouldSaveMediaToDevice(9)).toBe(false);
  });
});
