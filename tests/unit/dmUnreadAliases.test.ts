import { describe, it, expect } from 'vitest';
import { getDmRoomAliases, resolveDmUnreadCount, parseDmPeerId } from '../../src/utils/roomUtils';

describe('DM room aliases and unread resolution', () => {
  it('lists peer and pairwise aliases', () => {
    expect(getDmRoomAliases(42, 7)).toEqual([
      'dm_42',
      'dm_7_42',
      'dm_42_7'
    ]);
    expect(getDmRoomAliases(999, 7)).toEqual(['dm_velum_7', 'dm_999']);
  });

  it('prefers live peer-scoped unread over stale pairwise counts', () => {
    const counts = {
      dm_42: 0,
      dm_7_42: 5
    };
    expect(resolveDmUnreadCount(42, 7, counts, 3)).toBe(0);
  });

  it('falls back to server unread when no live keys exist', () => {
    expect(resolveDmUnreadCount(42, 7, {}, 4)).toBe(4);
    expect(resolveDmUnreadCount(42, 7, undefined, 0)).toBe(0);
  });

  it('parses peer id from pairwise rooms against current user', () => {
    expect(parseDmPeerId('dm_7_42', 7)).toBe(42);
    expect(parseDmPeerId('dm_42_7', 7)).toBe(42);
    expect(parseDmPeerId('dm_42', 7)).toBe(42);
  });
});
