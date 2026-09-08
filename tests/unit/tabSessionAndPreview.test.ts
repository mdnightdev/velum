import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  selectLatestDmMessage,
  messageTimestamp,
  getDmRoomAliases,
  getPrimaryDmRoomId,
  isActiveDmRoom,
  mergeLastMessagesMap,
  reconcileUnreadCounts,
  expandDmUnreadAliases,
  shouldHideDeletedDm
} from '../../src/utils/roomUtils';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    key: (i: number) => Array.from(map.keys())[i] ?? null
  };
}

describe('selectLatestDmMessage', () => {
  it('picks the newest among sent/received alias copies', () => {
    const olderOwn = {
      content: 'my older send',
      user_id: 7,
      createdAt: '2026-01-01T10:00:00.000Z'
    };
    const newerReceived = {
      content: 'peer reply',
      user_id: 42,
      createdAt: '2026-01-01T12:00:00.000Z'
    };
    const lastMessages = {
      dm_42: olderOwn,
      dm_7_42: newerReceived
    };
    const latest = selectLatestDmMessage(42, 7, lastMessages, olderOwn);
    expect(latest).toBe(newerReceived);
    expect(messageTimestamp(newerReceived)).toBeGreaterThan(messageTimestamp(olderOwn));
  });
});

describe('DM room aliases (live push)', () => {
  it('matches pairwise active room to peer aliases', () => {
    expect(isActiveDmRoom('dm_7_42', 42, 7)).toBe(true);
    expect(isActiveDmRoom('dm_42', 42, 7)).toBe(true);
    expect(isActiveDmRoom('dm_99', 42, 7)).toBe(false);
    expect(getPrimaryDmRoomId(42, 7)).toBe('dm_42');
  });

  it('matches velum aliases', () => {
    expect(getPrimaryDmRoomId(999, 7)).toBe('dm_velum_7');
    expect(getDmRoomAliases(999, 7)).toEqual(['dm_velum_7', 'dm_999']);
    expect(isActiveDmRoom('dm_velum_7', 999, 7)).toBe(true);
    expect(isActiveDmRoom('dm_999', 999, 7)).toBe(true);
  });
});

describe('mergeLastMessagesMap', () => {
  it('prefers newer in-memory message over stale store key', () => {
    const stale = {
      room_id: 'dm_42',
      content: 'old',
      timestamp: '2026-01-01T10:00:00.000Z'
    };
    const fresh = {
      room_id: 'dm_42',
      content: 'new',
      timestamp: '2026-01-01T12:00:00.000Z'
    };
    const merged = mergeLastMessagesMap({ dm_42: stale }, [fresh]);
    expect(merged.dm_42).toBe(fresh);
  });

  it('keeps store preview when messages are older', () => {
    const storeMsg = {
      room_id: 'dm_42',
      content: 'latest',
      created_at: '2026-01-02T00:00:00.000Z'
    };
    const older = {
      room_id: 'dm_42',
      content: 'older',
      timestamp: '2026-01-01T00:00:00.000Z'
    };
    const merged = mergeLastMessagesMap({ dm_42: storeMsg }, [older]);
    expect(merged.dm_42).toBe(storeMsg);
  });
});

describe('unread reconcile + deleted hide', () => {
  it('drops stale DM unread keys missing from server', () => {
    const prev = { 'dm_velum_7': 1, 'dm_42': 3, lounge_a: 2 };
    const server = { lounge_a: 2 };
    expect(reconcileUnreadCounts(prev, server)).toEqual({ lounge_a: 2 });
  });

  it('expands velum unread onto both aliases', () => {
    const expanded = expandDmUnreadAliases({ dm_999: 2 }, 7);
    expect(expanded['dm_999']).toBe(2);
    expect(expanded['dm_velum_7']).toBe(2);
  });

  it('hides deleted chat when last message has no usable timestamp', () => {
    expect(shouldHideDeletedDm(1000, { content: 'x' })).toBe(true);
    expect(shouldHideDeletedDm(Date.parse('2026-06-01T00:00:00.000Z'), { timestamp: '2026-01-01T00:00:00.000Z' })).toBe(true);
    expect(shouldHideDeletedDm(1000, { timestamp: '2099-01-01T00:00:00.000Z' })).toBe(false);
  });
});

describe('tab session scope', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('defaults to tab scope on web and routes auth to sessionStorage', async () => {
    const session = memoryStorage();
    const local = memoryStorage();
    local.setItem('velum-sessionId', JSON.stringify({ value: 'leaked-shared', timestamp: Date.now() }));
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('window', {
      sessionStorage: session,
      localStorage: local,
      location: { search: '' }
    });

    const { isTabSessionScope, storage } = await import('../../src/services/storageService');
    expect(isTabSessionScope()).toBe(true);
    expect(localStorage.getItem('velum-sessionId')).toBeNull();

    storage.setItem('velum-sessionId', 'tab-token-a');
    expect(sessionStorage.getItem('velum-sessionId')).toBeTruthy();
    expect(localStorage.getItem('velum-sessionId')).toBeNull();
    expect(storage.getItem('velum-sessionId')).toBe('tab-token-a');
  });

  it('honors ?sessionScope=shared escape hatch', async () => {
    const session = memoryStorage();
    const local = memoryStorage();
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('window', {
      sessionStorage: session,
      localStorage: local,
      location: { search: '?sessionScope=shared' }
    });

    const { isTabSessionScope, storage } = await import('../../src/services/storageService');
    expect(isTabSessionScope()).toBe(false);
    storage.setItem('velum-sessionId', 'shared-token');
    expect(localStorage.getItem('velum-sessionId')).toBeTruthy();
    expect(sessionStorage.getItem('velum-sessionId')).toBeNull();
  });

  it('getSessionId ignores polluted localStorage when tab-scoped', async () => {
    const session = memoryStorage();
    const local = memoryStorage();
    local.setItem('velum-sessionId', JSON.stringify({ value: 'should-not-win', timestamp: Date.now() }));
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('window', {
      sessionStorage: session,
      localStorage: local,
      location: { search: '?sessionScope=tab' }
    });

    await import('../../src/services/storageService');
    const { getSessionId } = await import('../../src/utils/auth');
    expect(getSessionId()).toBe('');
  });

  it('routes auth tokens to sessionStorage when ?sessionScope=tab', async () => {
    const session = memoryStorage();
    const local = memoryStorage();
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('window', {
      sessionStorage: session,
      localStorage: local,
      location: { search: '?sessionScope=tab' }
    });

    const { isTabSessionScope, storage } = await import('../../src/services/storageService');
    expect(isTabSessionScope()).toBe(true);
    storage.setItem('velum-sessionId', 'tab-token-a');
    expect(sessionStorage.getItem('velum-sessionId')).toBeTruthy();
    expect(localStorage.getItem('velum-sessionId')).toBeNull();
    expect(storage.getItem('velum-sessionId')).toBe('tab-token-a');
  });
});
