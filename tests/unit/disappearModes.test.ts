import { describe, expect, it } from 'vitest';
import {
  computeExpiresAtIso,
  disappearModeToSeconds,
  isMessageExpired,
  secondsToDisappearMode,
} from '../../src/utils/disappearModes';
import {
  getPeerDisappearMode,
  getPeerDisappearSeconds,
  setPeerDisappearMode,
} from '../../src/utils/dmPeerPrefs';

describe('disappearModes', () => {
  it('maps 30 seconds for testing', () => {
    expect(disappearModeToSeconds('30 seconds')).toBe(30);
    expect(secondsToDisappearMode(30)).toBe('30 seconds');
  });

  it('maps Off / 24h / 7d', () => {
    expect(disappearModeToSeconds('Off')).toBeNull();
    expect(disappearModeToSeconds('24 hours')).toBe(86400);
    expect(disappearModeToSeconds('7 days')).toBe(604800);
  });

  it('detects expiry from expires_at', () => {
    expect(
      isMessageExpired({ expires_at: '2020-01-01T00:00:00.000Z' }, Date.parse('2020-01-01T00:00:01.000Z'))
    ).toBe(true);
    expect(
      isMessageExpired({ expires_at: '2099-01-01T00:00:00.000Z' }, Date.parse('2020-01-01T00:00:01.000Z'))
    ).toBe(false);
  });

  it('computes expires_at iso', () => {
    expect(computeExpiresAtIso(30, Date.parse('2026-01-01T00:00:00.000Z'))).toBe(
      '2026-01-01T00:00:30.000Z'
    );
  });
});

describe('dmPeerPrefs disappear', () => {
  it('persists 30-second mode per peer', () => {
    localStorage.clear();
    setPeerDisappearMode(42, '30 seconds');
    expect(getPeerDisappearMode(42)).toBe('30 seconds');
    expect(getPeerDisappearSeconds(42)).toBe(30);
    setPeerDisappearMode(42, 'Off');
    expect(getPeerDisappearSeconds(42)).toBeNull();
  });
});
