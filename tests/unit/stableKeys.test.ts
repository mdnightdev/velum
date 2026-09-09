import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getMessageListKey } from '../../src/components/Chat/messageKey';

describe('stable list keys', () => {
  it('prefers client_msg_id for list identity', () => {
    expect(
      getMessageListKey({
        id: 99,
        client_msg_id: 'c-1',
        message_id: 'm-1',
        user_id: 1,
        created_at: '2026-01-01',
      } as any)
    ).toBe('c-1');
  });

  it('ChatArea remounts MessageList only via chatKey', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/ChatArea.tsx'), 'utf8');
    expect(src).toMatch(/<MessageList[\s\S]*?key=\{chatKey\}/);
  });

  it('MessageList uses getMessageListKey', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/Chat/MessageList.tsx'), 'utf8');
    expect(src).toMatch(/getMessageListKey\(/);
  });
});
