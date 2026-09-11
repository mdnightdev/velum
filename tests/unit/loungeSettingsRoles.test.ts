import { describe, it, expect } from 'vitest';
import {
  resolveLoungeSettingsRole,
  canSeeLoungeSettingsPage,
  visibleLoungeSettingsNav,
  isVelumOfficialLounge,
} from '../../src/components/Lounge/loungeSettingsRoles';

describe('resolveLoungeSettingsRole', () => {
  it('prefers ownerId over membership role', () => {
    expect(
      resolveLoungeSettingsRole({
        currentUserId: 7,
        ownerId: 7,
        membershipRole: 'member',
      })
    ).toBe('owner');
  });

  it('maps admin membership', () => {
    expect(
      resolveLoungeSettingsRole({
        currentUserId: 3,
        ownerId: 1,
        membershipRole: 'admin',
      })
    ).toBe('admin');
  });

  it('on Velum lounge maps CLI/LOGIN to owner and SUPPORT to admin', () => {
    expect(
      resolveLoungeSettingsRole({
        currentUserId: 2,
        ownerId: 1,
        membershipRole: 'member',
        systemUserRole: 'CLI_ADMIN',
        isVelumLounge: true,
      })
    ).toBe('owner');
    expect(
      resolveLoungeSettingsRole({
        currentUserId: 2,
        ownerId: 1,
        membershipRole: 'member',
        systemUserRole: 'LOGIN_ADMIN',
        isVelumLounge: true,
      })
    ).toBe('owner');
    expect(
      resolveLoungeSettingsRole({
        currentUserId: 2,
        ownerId: 1,
        membershipRole: 'member',
        systemUserRole: 'SUPPORT_ADMIN',
        isVelumLounge: true,
      })
    ).toBe('admin');
  });

  it('does not elevate system roles outside Velum lounge', () => {
    expect(
      resolveLoungeSettingsRole({
        currentUserId: 2,
        ownerId: 1,
        membershipRole: 'member',
        systemUserRole: 'CLI_ADMIN',
        isVelumLounge: false,
      })
    ).toBe('member');
  });
});

describe('isVelumOfficialLounge', () => {
  it('detects master slug', () => {
    expect(isVelumOfficialLounge({ loungeId: 'velum_master_lounge' })).toBe(true);
  });
});

describe('canSeeLoungeSettingsPage', () => {
  it('members only see Members', () => {
    expect(canSeeLoungeSettingsPage('member', 'members')).toBe(true);
    expect(canSeeLoungeSettingsPage('member', 'applications_invites')).toBe(false);
    expect(canSeeLoungeSettingsPage('member', 'lounge_info')).toBe(false);
    expect(canSeeLoungeSettingsPage('member', 'danger_delete')).toBe(false);
  });

  it('mods see settings but not danger', () => {
    expect(canSeeLoungeSettingsPage('moderator', 'applications_invites')).toBe(true);
    expect(canSeeLoungeSettingsPage('moderator', 'moderation')).toBe(true);
    expect(canSeeLoungeSettingsPage('moderator', 'danger_transfer')).toBe(false);
  });

  it('owner sees danger', () => {
    expect(canSeeLoungeSettingsPage('owner', 'danger_delete')).toBe(true);
    expect(visibleLoungeSettingsNav('owner').some((i) => i.group === 'danger')).toBe(true);
  });
});
