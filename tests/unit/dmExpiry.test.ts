import { describe, it, expect } from 'vitest';

/**
 * Pure helpers mirroring server unread recount math (no DB).
 * Keeps Phase 2 contract documented for client/server alignment.
 */
function recountAfterExpire(
  previousUnread: number,
  purgedUnreadIncoming: number
): number {
  return Math.max(0, previousUnread - Math.max(0, purgedUnreadIncoming));
}

describe('dm expiry unread recount', () => {
  it('drops unread by number of purged unread-incoming rows', () => {
    expect(recountAfterExpire(3, 1)).toBe(2);
    expect(recountAfterExpire(1, 1)).toBe(0);
    expect(recountAfterExpire(0, 1)).toBe(0);
  });

  it('ignores purged own/read messages for unread', () => {
    expect(recountAfterExpire(2, 0)).toBe(2);
  });
});
