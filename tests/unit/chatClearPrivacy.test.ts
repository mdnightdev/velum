import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { clearUserChatHistory } from '../../server/v2/services/loungeService.js';

describe('User-Specific Chat Clearing & Privacy Suite', () => {
  it('exports clearUserChatHistory function', () => {
    assert.equal(typeof clearUserChatHistory, 'function');
  });

  it('rejects clearing chat for non-existent lounge safely', async () => {
    const result = await clearUserChatHistory(1, 999999);
    assert.equal(result.success, false);
    assert.equal(result.error, 'Lounge not found');
  });
});
