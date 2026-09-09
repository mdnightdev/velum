import { describe, it, expect } from 'vitest';
import {
  purgeExpiredChatState,
  recomputeLastMessagesAfterRemoval,
  decrementUnreadForAliases,
  isUnreadIncoming,
} from '../../src/utils/roomPreview';

describe('roomPreview recompute', () => {
  const me = 7;
  const peer = 42;
  const room = `dm_${peer}`;

  it('falls back to previous message when last preview is removed', () => {
    const older = {
      id: 1,
      message_id: '1',
      room_id: room,
      user_id: peer,
      content: 'older',
      plaintext: 'older',
      timestamp: '2020-01-01T00:00:00.000Z',
    };
    const newer = {
      id: 2,
      message_id: '2',
      room_id: room,
      user_id: peer,
      content: 'newer',
      plaintext: 'newer',
      timestamp: '2020-01-02T00:00:00.000Z',
    };
    const remaining = [older];
    const lastMessages = { [room]: newer, [`dm_7_42`]: newer };
    const next = recomputeLastMessagesAfterRemoval(lastMessages, remaining, newer, me);
    expect(next[room].id).toBe(1);
    expect(next[room].plaintext).toBe('older');
    expect(next['dm_7_42'].id).toBe(1);
  });

  it('clears preview when no remaining messages', () => {
    const only = {
      id: 9,
      message_id: '9',
      room_id: room,
      user_id: peer,
      timestamp: '2020-01-01T00:00:00.000Z',
    };
    const next = recomputeLastMessagesAfterRemoval({ [room]: only }, [], only, me);
    expect(next[room]).toBeUndefined();
  });

  it('leaves preview unchanged when a non-last message is removed', () => {
    const older = {
      id: 1,
      message_id: '1',
      room_id: room,
      user_id: peer,
      timestamp: '2020-01-01T00:00:00.000Z',
    };
    const newer = {
      id: 2,
      message_id: '2',
      room_id: room,
      user_id: peer,
      plaintext: 'keep',
      timestamp: '2020-01-02T00:00:00.000Z',
    };
    const next = recomputeLastMessagesAfterRemoval(
      { [room]: newer },
      [newer],
      older,
      me
    );
    expect(next[room].id).toBe(2);
    expect(next[room].plaintext).toBe('keep');
  });
});

describe('roomPreview unread on purge', () => {
  const me = 7;
  const peer = 42;

  it('treats unread incoming correctly', () => {
    expect(isUnreadIncoming({ user_id: peer, status: 'delivered' }, me)).toBe(true);
    expect(isUnreadIncoming({ user_id: me, status: 'sent' }, me)).toBe(false);
    expect(isUnreadIncoming({ user_id: peer, status: 'read' }, me)).toBe(false);
    expect(isUnreadIncoming({ user_id: peer, read_at: '2020-01-01' }, me)).toBe(false);
  });

  it('decrements unread across DM aliases', () => {
    const keys = [`dm_${peer}`, 'dm_7_42', 'dm_42_7'];
    const next = decrementUnreadForAliases(
      { [`dm_${peer}`]: 3, 'dm_7_42': 3 },
      keys,
      1
    );
    expect(next[`dm_${peer}`]).toBe(2);
    expect(next['dm_7_42']).toBe(2);
    expect(next['dm_42_7']).toBe(2);
  });

  it('purgeExpiredChatState updates preview and unread', () => {
    const now = Date.parse('2020-01-01T00:00:30.000Z');
    const keep = {
      id: 1,
      message_id: '1',
      room_id: 'dm_42',
      user_id: 42,
      plaintext: 'keep',
      timestamp: '2020-01-01T00:00:00.000Z',
    };
    const expired = {
      id: 2,
      message_id: '2',
      room_id: 'dm_42',
      user_id: 42,
      plaintext: 'gone',
      status: 'delivered',
      expires_at: '2020-01-01T00:00:10.000Z',
      timestamp: '2020-01-01T00:00:00.000Z',
    };
    const result = purgeExpiredChatState(
      {
        messages: [keep, expired],
        lastMessages: { dm_42: expired },
        unreadCounts: { dm_42: 2, dm_7_42: 2 },
      },
      now,
      7
    );
    expect(result.purged).toHaveLength(1);
    expect(result.messages).toHaveLength(1);
    expect(result.lastMessages.dm_42.plaintext).toBe('keep');
    expect(result.unreadCounts.dm_42).toBe(1);
  });

  it('does not decrement unread for own expired message', () => {
    const now = Date.parse('2020-01-01T00:00:30.000Z');
    const expired = {
      id: 2,
      message_id: '2',
      room_id: 'dm_42',
      user_id: 7,
      expires_at: '2020-01-01T00:00:10.000Z',
      timestamp: '2020-01-01T00:00:00.000Z',
    };
    const result = purgeExpiredChatState(
      {
        messages: [expired],
        lastMessages: { dm_42: expired },
        unreadCounts: { dm_42: 1 },
      },
      now,
      7
    );
    expect(result.unreadCounts.dm_42).toBe(1);
    expect(result.lastMessages.dm_42).toBeUndefined();
  });
});
