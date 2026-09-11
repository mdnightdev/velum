import { describe, it, expect } from 'vitest';
import { resolveLoungeSender } from '../../src/components/Chat/MessageItem';
import type { Message } from '../../src/types';

function msg(partial: Partial<Message>): Message {
  return {
    id: 1,
    room_id: 'velum_general',
    user_id: 42,
    content: 'hi',
    timestamp: Date.now(),
    ...partial,
  };
}

describe('resolveLoungeSender', () => {
  it('prefers live member directory avatar and name', () => {
    const r = resolveLoungeSender(msg({ username: 'Old', avatar: '/uploads/old.webp' }), {
      '42': { username: 'Alex', displayName: 'Alex', avatar: '/uploads/live.webp' },
    });
    expect(r.name).toBe('Alex');
    expect(r.avatar).toBe('/uploads/live.webp');
  });

  it('falls back to message avatar when directory missing', () => {
    const r = resolveLoungeSender(msg({ username: 'Jordan', avatar: '/uploads/j.webp' }));
    expect(r.name).toBe('Jordan');
    expect(r.avatar).toBe('/uploads/j.webp');
  });
});
