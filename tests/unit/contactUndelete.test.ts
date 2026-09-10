import { describe, it, expect, beforeEach, vi } from 'vitest';
import { unDeleteContact, isHiddenFromUserContacts } from '../../src/utils/deletedDms';

function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

describe('unDeleteContact', () => {
  const uid = 42;
  const key = `velum_deleted_dms_${uid}`;

  beforeEach(() => {
    const local = mockLocalStorage();
    vi.stubGlobal('localStorage', local);
  });

  it('removes peer from object-shaped deleted map', () => {
    localStorage.setItem(key, JSON.stringify({ 7: 1000, 9: 2000 }));
    unDeleteContact(uid, 7);
    expect(JSON.parse(localStorage.getItem(key) || '{}')).toEqual({ 9: 2000 });
  });

  it('removes peer from array-shaped deleted map', () => {
    localStorage.setItem(key, JSON.stringify([7, 9]));
    unDeleteContact(uid, 7);
    expect(JSON.parse(localStorage.getItem(key) || '[]')).toEqual([9]);
  });

  it('no-ops when key missing', () => {
    unDeleteContact(uid, 7);
    expect(localStorage.getItem(key)).toBeNull();
  });
});

describe('isHiddenFromUserContacts', () => {
  it('hides velum bot by id and username', () => {
    expect(isHiddenFromUserContacts({ friendId: 999 })).toBe(true);
    expect(isHiddenFromUserContacts({ username: 'VELUM' })).toBe(true);
    expect(isHiddenFromUserContacts({ sender_name: '@velum' })).toBe(true);
  });

  it('hides cli/admin/support roles', () => {
    expect(isHiddenFromUserContacts({ friendId: 50, role: 'CLI_ADMIN' })).toBe(true);
    expect(isHiddenFromUserContacts({ friendId: 50, role: 'LOGIN_ADMIN' })).toBe(true);
    expect(isHiddenFromUserContacts({ friendId: 50, role: 'SUPPORT_ADMIN' })).toBe(true);
    expect(isHiddenFromUserContacts({ friendId: 50, role: 'SUPPORT_OPERATOR' })).toBe(true);
  });

  it('allows normal users', () => {
    expect(isHiddenFromUserContacts({ friendId: 50, username: 'alice', role: 'USER' })).toBe(false);
  });
});
