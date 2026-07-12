import { describe, it, expect, vi } from 'vitest';
import { can, PERMISSIONS } from '../controllers/lounges';

vi.mock('../db.js', () => {
  const mockDb = {
    lounges: [
      { lounge_id: 'velum_lounge', id: 'velum_lounge', visibility: 'public', type: 'official', status: 'active' },
      { lounge_id: 'secops', id: 'secops', visibility: 'private', type: 'official', status: 'active' },
      { lounge_id: 'comm_user', id: 'comm_user', visibility: 'public', type: 'user_created', status: 'active' },
      { lounge_id: 'comm_sub', id: 'comm_sub', parent_lounge_id: 'comm_user', visibility: 'private', type: 'private_sublounge', status: 'active', owner_user_id: 10 }
    ],
    lounge_members: [
      { lounge_id: 'comm_user', user_id: 10, role: 'owner', status: 'active' },
      { lounge_id: 'comm_user', user_id: 20, role: 'admin', status: 'active' },
      { lounge_id: 'comm_user', user_id: 30, role: 'member', status: 'active' },
      { lounge_id: 'comm_user', user_id: 40, role: 'member', status: 'muted' },
      { lounge_id: 'comm_sub', user_id: 10, role: 'owner', status: 'active' }
    ],
    lounge_sanctions: []
  };
  return {
    db: mockDb,
    loadDb: vi.fn(),
    saveDb: vi.fn(),
  };
});

describe('Lounge Redesign Authorization checks', () => {
  it('should short-circuit permissions for system admins', () => {
    const actor = { user_id: 1, role: 'CLI_ADMIN' };
    const resource = { lounge_id: 'secops', visibility: 'private' };
    expect(can(actor, PERMISSIONS.SEND_MESSAGE, resource)).toBe(true);
  });

  it('should allow public lounge access for non-members to view and send messages', () => {
    const actor = { user_id: 99, role: 'USER' };
    const resource = { lounge_id: 'comm_user', visibility: 'public' };
    expect(can(actor, PERMISSIONS.SEND_MESSAGE, resource)).toBe(true);
    expect(can(actor, PERMISSIONS.DELETE_MESSAGE, resource)).toBe(false);
  });

  it('should respect role permission bitmasks', () => {
    const comm = { lounge_id: 'comm_user', visibility: 'public' };
    
    // Owner
    expect(can({ user_id: 10, role: 'USER' }, PERMISSIONS.DELETE_MESSAGE, comm)).toBe(true);
    // Admin
    expect(can({ user_id: 20, role: 'USER' }, PERMISSIONS.DELETE_MESSAGE, comm)).toBe(true);
    // Member
    expect(can({ user_id: 30, role: 'USER' }, PERMISSIONS.DELETE_MESSAGE, comm)).toBe(false);
  });

  it('should block message sending when user is muted', () => {
    const comm = { lounge_id: 'comm_user', visibility: 'public' };
    expect(can({ user_id: 40, role: 'USER' }, PERMISSIONS.SEND_MESSAGE, comm)).toBe(false);
  });

  it('should block parent admins from private sublounges if they are not members', () => {
    const sub = { lounge_id: 'comm_sub', parent_lounge_id: 'comm_user', type: 'private_sublounge', visibility: 'private' };
    // User 20 is parent admin but not sub member
    expect(can({ user_id: 20, role: 'USER' }, PERMISSIONS.SEND_MESSAGE, sub)).toBe(false);
  });
});
