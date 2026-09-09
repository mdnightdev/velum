import { describe, expect, it } from 'vitest';
import { resolveContactName } from '../../src/utils/contactName';

describe('resolveContactName', () => {
  it('prefers nickname over displayName and username', () => {
    expect(
      resolveContactName({
        nickname: 'Hawktuah',
        displayName: 'Spencer',
        username: 'spencer',
      })
    ).toBe('Hawktuah');
  });

  it('falls back to displayName when nickname is empty', () => {
    expect(
      resolveContactName({
        nickname: '  ',
        displayName: 'Spencer',
        username: 'spencer',
      })
    ).toBe('Spencer');
  });

  it('falls back to username when nickname and displayName are empty', () => {
    expect(
      resolveContactName({
        nickname: '',
        displayName: null,
        username: '@spencer',
      })
    ).toBe('spencer');
  });

  it('uses fallback when all names are missing', () => {
    expect(resolveContactName({ fallback: 'User #12' })).toBe('User #12');
    expect(resolveContactName({})).toBe('Contact');
  });

  it('strips leading @ from nickname', () => {
    expect(resolveContactName({ nickname: '@Buddy' })).toBe('Buddy');
  });
});
