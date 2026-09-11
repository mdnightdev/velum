import { describe, it, expect } from 'vitest';
import {
  loungeRoleRank,
  sortMembersAdminsFirst,
  normalizeLoungeMembersPayload,
} from '../../src/components/Lounge/utils/memberRoster';

describe('loungeRoleRank', () => {
  it('ranks owner and admin above member', () => {
    expect(loungeRoleRank('owner')).toBeLessThan(loungeRoleRank('admin'));
    expect(loungeRoleRank('admin')).toBeLessThan(loungeRoleRank('member'));
    expect(loungeRoleRank('moderator')).toBeLessThan(loungeRoleRank('member'));
  });
});

describe('sortMembersAdminsFirst', () => {
  it('orders owner, admin, then members', () => {
    const sorted = sortMembersAdminsFirst([
      { user_id: 1, username: 'zoe', role: 'member' },
      { user_id: 2, username: 'ada', role: 'admin' },
      { user_id: 3, username: 'bob', role: 'owner' },
      { user_id: 4, username: 'amy', role: 'member' },
    ]);
    expect(sorted.map((m) => m.username)).toEqual(['bob', 'ada', 'amy', 'zoe']);
  });
});

describe('normalizeLoungeMembersPayload', () => {
  it('parses { members } wrapper and drops system bots', () => {
    const result = normalizeLoungeMembersPayload({
      members: [
        { user_id: 10, username: 'alice', role: 'member' },
        { user_id: 999, username: 'velum', role: 'admin' },
        { user_id: 11, username: 'boss', role: 'admin' },
      ],
    });
    expect(result.map((m) => m.username)).toEqual(['boss', 'alice']);
  });
});
