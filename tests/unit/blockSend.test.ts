import { describe, expect, it } from 'vitest';
import { blockedSendErrorMessage } from '../../server/v2/utils/blockCopy';

describe('blockedSendErrorMessage', () => {
  it('tells the blocker to unblock', () => {
    expect(blockedSendErrorMessage('self')).toBe('Unblock this contact to send messages');
  });

  it('does not tell the blockee to unblock', () => {
    expect(blockedSendErrorMessage('peer')).toBe("You can't message this user");
    expect(blockedSendErrorMessage(undefined)).toBe("You can't message this user");
  });
});
