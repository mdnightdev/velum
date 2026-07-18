import { Request, Response } from 'express';
import { 
  Lounge, LoungeMember, LoungeInvite, LoungeSanction, 
  LoungeJoinRequest, LoungeOwnershipTransfer, UserLoungePreference, 
  LoungeAuditLog, SystemAuditLog 
} from '../../src/types.js';
import { db, loadDb, saveDb } from '../db.js';
import { generatePrefixedId } from '../utils/ulid.js';

// Granular permissions represented as bitmasks
export const PERMISSIONS = {
  SEND_MESSAGE: 1 << 0,
  DELETE_MESSAGE: 1 << 1,
  MUTE_MEMBER: 1 << 2,
  BAN_MEMBER: 1 << 3,
  KICK_MEMBER: 1 << 4,
  MANAGE_SUBLOUNGES: 1 << 5,
  CREATE_ROOM: 1 << 6,
  VIEW_MEMBERS: 1 << 7,
  UPDATE_SETTINGS: 1 << 8
};

// Default role permissions bitmasks
export const ROLE_PERMISSIONS: Record<string, number> = {
  owner: PERMISSIONS.SEND_MESSAGE | PERMISSIONS.DELETE_MESSAGE | PERMISSIONS.MUTE_MEMBER | PERMISSIONS.BAN_MEMBER | PERMISSIONS.KICK_MEMBER | PERMISSIONS.MANAGE_SUBLOUNGES | PERMISSIONS.CREATE_ROOM | PERMISSIONS.VIEW_MEMBERS | PERMISSIONS.UPDATE_SETTINGS,
  admin: PERMISSIONS.SEND_MESSAGE | PERMISSIONS.DELETE_MESSAGE | PERMISSIONS.MUTE_MEMBER | PERMISSIONS.KICK_MEMBER | PERMISSIONS.MANAGE_SUBLOUNGES | PERMISSIONS.CREATE_ROOM | PERMISSIONS.VIEW_MEMBERS | PERMISSIONS.UPDATE_SETTINGS,
  moderator: PERMISSIONS.SEND_MESSAGE | PERMISSIONS.DELETE_MESSAGE | PERMISSIONS.MUTE_MEMBER | PERMISSIONS.KICK_MEMBER | PERMISSIONS.VIEW_MEMBERS,
  member: PERMISSIONS.SEND_MESSAGE | PERMISSIONS.VIEW_MEMBERS
};

// Centralized permission check function (Authority Model Axis 1 & 2)
export const can = (actor: any, action: number, resource: any): boolean => {
  // Axis 2 — Platform authority: cli_admin or login_admin short-circuits everything
  if (actor.role === 'CLI_ADMIN' || actor.role === 'LOGIN_ADMIN') {
    return true;
  }

  const loungeId = resource.lounge_id || resource.id;
  if (!loungeId) return false;

  const parentLoungeId = resource.parent_lounge_id || null;
  const isPrivateSublounge = resource.type === 'private_sublounge' || (parentLoungeId && (resource.visibility === 'private' || resource.is_private === 1));

  // Find membership
  const membership = db.lounge_members?.find(m => m.lounge_id === loungeId && String(m.user_id) === String(actor.user_id));

  // Explicit block: parent admins/moderators who are not members of the private sublounge cannot access it
  if (isPrivateSublounge && parentLoungeId && !membership) {
    return false;
  }

  // Check role-based permission
  if (!membership) {
    // If not a member, check if it's a public lounge and action is SEND_MESSAGE or VIEW_MEMBERS
    const isPublic = resource.visibility === 'public' && resource.status !== 'suspended' && resource.status !== 'deleted';
    if (isPublic && (action === PERMISSIONS.SEND_MESSAGE || action === PERMISSIONS.VIEW_MEMBERS)) {
      return true;
    }
    return false;
  }

  // Check if member is muted or kicked/banned inside this lounge
  if (membership.status === 'banned' || membership.status === 'kicked') {
    return false;
  }

  // If action is SEND_MESSAGE, check if user is muted (both lounge member status and live sanctions)
  if (action === PERMISSIONS.SEND_MESSAGE) {
    if (membership.status === 'muted') {
      return false;
    }
    // Live sanction check
    const sanction = db.lounge_sanctions?.find(s => s.lounge_id === loungeId && String(s.user_id) === String(actor.user_id) && s.type === 'mute' && !s.lifted_at);
    if (sanction) {
      return false;
    }
    // Check parent mute if sublounge (Live cascade check)
    if (parentLoungeId) {
      const parentMembership = db.lounge_members?.find(m => m.lounge_id === parentLoungeId && String(m.user_id) === String(actor.user_id));
      if (parentMembership?.status === 'muted') {
        return false;
      }
      const parentSanction = db.lounge_sanctions?.find(s => s.lounge_id === parentLoungeId && String(s.user_id) === String(actor.user_id) && s.type === 'mute' && !s.lifted_at);
      if (parentSanction) {
        return false;
      }
    }
  }

  const roleBitmask = ROLE_PERMISSIONS[membership.role] || 0;
  return (roleBitmask & action) === action;
};

// Helper to generate a unique slug
const generateUniqueSlug = (name: string): string => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `${base || 'lounge'}-${Math.random().toString(36).substr(2, 4)}`;
};

// Helper to generate formatted invite codes
const generateInviteCode = (type: 'p' | 's'): string => {
  const unique = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `VE/${type}/${unique}`;
};

// GET visible lounges feed
export const getLounges = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    loadDb();
    db.lounges = db.lounges || [];

    const isAdmin = user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_ADMIN';

    let visible = db.lounges.filter(c => {
      if (!c) return false;
      if (c.parent_lounge_id) return false; // top-level only

      const isCreator = String(c.creator_id || c.owner_id || c.owner_user_id) === String(user.user_id);
      if (c.status === 'suspended' || c.status === 'archived' || c.status === 'deleted') {
        if (!isCreator && !isAdmin) return false;
      }

      if (isAdmin) {
        return true;
      } else {
        if (c.lounge_id === 'secops' || c.id === 'secops') return false;

        const isPrivateVisibility = c.visibility === 'private' || c.visibility === 'invite_only' || Number(c.is_private) === 1;
        if (isPrivateVisibility) {
          const isMember = db.lounge_members?.some(m => m.lounge_id === c.lounge_id && String(m.user_id) === String(user.user_id) && m.status === 'active');
          const profile = db.profiles?.find(p => String(p.user_id) === String(user.user_id));
          const joinedLegacy = profile?.joined_lounges?.includes(c.lounge_id) || profile?.joined_lounges?.includes(c.id || '');
          return !!isMember || !!joinedLegacy || isCreator;
        }

        return true;
      }
    });

    // Decorate and sort by pin preferences (Section 14)
    const decorated = visible.map(l => {
      const pref = db.user_lounge_preferences?.find(p => p.lounge_id === l.lounge_id && String(p.user_id) === String(user.user_id));
      return {
        ...l,
        pinned: pref ? !!pref.pinned : false,
        pin_order: pref ? pref.pin_order : null
      };
    });

    decorated.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (a.pinned && b.pinned) {
        return (a.pin_order || 0) - (b.pin_order || 0);
      }
      return 0;
    });

    res.json(decorated);
  } catch (err: any) {
    console.error('Error fetching lounges:', err);
    res.status(500).json({ error: 'Failed to retrieve lounges.' });
  }
};

// GET single lounge
export const getLounge = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    loadDb();
    db.lounges = db.lounges || [];

    const lounge = db.lounges.find(l => l && (l.id === id || l.lounge_id === id || l.slug === id));
    if (!lounge) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    // Check parent-admin minimal view constraint (Section 15)
    const isPrivate = lounge.type === 'private_sublounge' || lounge.visibility === 'private' || lounge.is_private === 1;
    if (isPrivate && lounge.parent_lounge_id) {
      const isSubMember = db.lounge_members?.some(m => m.lounge_id === lounge.lounge_id && String(m.user_id) === String(user.user_id) && m.status === 'active');
      const isCreator = String(lounge.owner_user_id || lounge.owner_id || lounge.creator_id) === String(user.user_id);
      const isSystemAdmin = user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN';
      
      const isParentAdmin = db.lounge_members?.some(m => m.lounge_id === lounge.parent_lounge_id && String(m.user_id) === String(user.user_id) && (m.role === 'admin' || m.role === 'owner'));

      if (!isSubMember && !isCreator && !isSystemAdmin && isParentAdmin) {
        // Enforce minimal card view payload at query layer!
        const minimalLounge = {
          lounge_id: lounge.lounge_id,
          id: lounge.id,
          name: lounge.name,
          parent_lounge_id: lounge.parent_lounge_id,
          type: lounge.type,
          owner_user_id: lounge.owner_user_id,
          owner_username: db.users?.find(u => String(u.user_id) === String(lounge.owner_user_id))?.username || 'unknown',
          visibility: lounge.visibility,
          is_locked: lounge.is_locked,
          status: lounge.status,
          created_at: lounge.created_at,
          memberCount: db.lounge_members?.filter(m => m.lounge_id === lounge.lounge_id && m.status === 'active').length || 0,
          is_minimal_view: true
        };
        return res.json(minimalLounge);
      }

      // If not parent admin, and not member/creator/system admin, block access entirely!
      if (!isSubMember && !isCreator && !isSystemAdmin) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }

    // Decorate the full lounge object with owner_username and memberCount
    const decoratedLounge = {
      ...lounge,
      owner_username: db.users?.find(u => String(u.user_id) === String(lounge.owner_user_id || lounge.owner_id || lounge.creator_id))?.username || 'unknown',
      memberCount: db.lounge_members?.filter(m => m.lounge_id === lounge.lounge_id && m.status === 'active').length || 0
    };

    res.json(decoratedLounge);
  } catch (err: any) {
    console.error('Error fetching lounge:', err);
    res.status(500).json({ error: 'Failed to retrieve lounge.' });
  }
};

// GET sublounges for a parent lounge

// POST create lounge
export const createLounge = async (req: Request, res: Response) => {
  try {
    const { name, description, slug, visibility, type, icon_url } = req.body;
    const user = (req as any).user;

    if (!name) {
      return res.status(400).json({ error: 'Lounge name is required.' });
    }

    loadDb();
    db.lounges = db.lounges || [];

    let targetSlug = slug ? slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : '';
    if (!targetSlug) {
      targetSlug = generateUniqueSlug(name);
    }
    if (db.lounges.some(l => l && l.slug === targetSlug)) {
      targetSlug = `${targetSlug}-${Math.random().toString(36).substr(2, 4)}`;
    }

    const isAdmin = user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_ADMIN';
    const finalType = type || (isAdmin ? 'official' : 'user_created');
    const isSystemVal = finalType === 'official' ? 1 : 0;
    const loungeId = generatePrefixedId('comm');
    
    // Generate Invite Code (Section 3)
    const inviteCode = generateInviteCode('p');

    const newLounge: Lounge = {
      lounge_id: loungeId,
      name: name.trim(),
      description: description || '',
      icon_url: icon_url || '',
      owner_id: String(user.user_id),
      created_at: Date.now(),
      is_private: visibility === 'private' ? 1 : 0,
      is_official: isSystemVal,
      last_message_at: Date.now(),
      invite_code: inviteCode,
      id: loungeId,
      slug: targetSlug,
      creator_id: String(user.user_id),
      parent_lounge_id: null,
      updated_at: Date.now(),
      is_system: isSystemVal,
      visibility: visibility || 'public',
      status: 'active',
      type: finalType,
      owner_user_id: user.user_id,
      hide_member_list: 0,
      is_locked: 0,
      last_active_at: Date.now()
    };

    db.lounges.push(newLounge);

    // Register initial owner (Section 4)
    db.lounge_members = db.lounge_members || [];
    db.lounge_members.push({
      lounge_id: loungeId,
      user_id: user.user_id,
      role: 'owner',
      status: 'active',
      joined_via: 'default',
      joined_at: Date.now()
    });

    // Populate invite code in lounge_invites table
    db.lounge_invites = db.lounge_invites || [];
    db.lounge_invites.push({
      id: generatePrefixedId('inv'),
      lounge_id: loungeId,
      code: inviteCode,
      created_by: user.user_id,
      max_uses: 9999, // default community code is reusable
      uses_count: 0,
      expires_at: null,
      revoked_at: null
    });

    // Legacy support profile array
    const profile = db.profiles?.find(p => String(p.user_id) === String(user.user_id));
    if (profile) {
      profile.joined_lounges = profile.joined_lounges || [];
      if (!profile.joined_lounges.includes(loungeId)) {
        profile.joined_lounges.push(loungeId);
      }
    }

    // System welcome message (Section 13)
    db.messages = db.messages || [];
    db.messages.push({
      message_id: generatePrefixedId('msg_welcome'),
      room_id: loungeId,
      user_id: 999,
      content: `System: You created Lounge "${name.trim()}".`,
      timestamp: new Date().toISOString(),
      status: 'sent',
      type: 'text'
    } as any);

    saveDb();
    res.status(201).json(newLounge);
  } catch (err: any) {
    console.error('Error creating lounge:', err);
    res.status(500).json({ error: 'Failed to create lounge.' });
  }
};

// POST create sublounge / private sublounge
export const createSublounge = async (req: Request, res: Response) => {
  try {
    const { name, description, slug, parent_lounge_id, visibility, type } = req.body;
    const user = (req as any).user;

    if (!name) {
      return res.status(400).json({ error: 'Sublounge name is required.' });
    }
    if (!parent_lounge_id) {
      return res.status(400).json({ error: 'parent_lounge_id is required.' });
    }

    loadDb();
    db.lounges = db.lounges || [];

    const parent = db.lounges.find(l => l.lounge_id === parent_lounge_id || l.id === parent_lounge_id);
    if (!parent) {
      return res.status(404).json({ error: 'Parent lounge not found.' });
    }

    // Section 2: Max 10 sublounges per parent
    const activeSublounges = db.lounges.filter(l => l.parent_lounge_id === parent_lounge_id && l.status !== 'deleted');
    if (activeSublounges.length >= 10) {
      return res.status(400).json({ error: 'Rejecting sublounge creation: Max 10 sublounges per parent exceeded.' });
    }

    const finalType = type || (visibility === 'private' ? 'private_sublounge' : 'user_created');

    // Section 2: One private sublounge per user per parent
    if (finalType === 'private_sublounge') {
      const existing = db.lounges.find(l => 
        l.parent_lounge_id === parent_lounge_id && 
        String(l.owner_user_id || l.owner_id) === String(user.user_id) && 
        l.type === 'private_sublounge' && 
        l.status !== 'deleted'
      );
      if (existing) {
        return res.status(400).json({ error: 'Rejecting sublounge creation: One private sublounge per user per parent allowed.' });
      }
    }

    let targetSlug = slug ? slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : '';
    if (!targetSlug) {
      targetSlug = generateUniqueSlug(name);
    }
    if (db.lounges.some(l => l && l.slug === targetSlug)) {
      targetSlug = `${targetSlug}-${Math.random().toString(36).substr(2, 4)}`;
    }

    const loungeId = generatePrefixedId('comm');
    const inviteCode = generateInviteCode('s'); // Section 3

    const newSublounge: Lounge = {
      lounge_id: loungeId,
      name: name.trim(),
      description: description || '',
      owner_id: String(user.user_id),
      created_at: Date.now(),
      is_private: visibility === 'private' ? 1 : 0,
      is_official: 0,
      last_message_at: Date.now(),
      invite_code: inviteCode,
      id: loungeId,
      slug: targetSlug,
      creator_id: String(user.user_id),
      parent_lounge_id: parent_lounge_id,
      updated_at: Date.now(),
      is_system: 0,
      visibility: visibility || 'public',
      status: 'active',
      type: finalType,
      owner_user_id: user.user_id,
      hide_member_list: 0,
      is_locked: visibility === 'private' ? 1 : 0,
      last_active_at: Date.now()
    };

    db.lounges.push(newSublounge);

    // Register initial member/owner of sub
    db.lounge_members = db.lounge_members || [];
    db.lounge_members.push({
      lounge_id: loungeId,
      user_id: user.user_id,
      role: 'owner',
      status: 'active',
      joined_via: 'default',
      joined_at: Date.now()
    });

    db.lounge_invites = db.lounge_invites || [];
    db.lounge_invites.push({
      id: generatePrefixedId('inv'),
      lounge_id: loungeId,
      code: inviteCode,
      created_by: user.user_id,
      max_uses: 1, // Section 3 sublounge codes single use by default
      uses_count: 0,
      expires_at: null,
      revoked_at: null
    });

    // Add to legacy profile joined array
    const profile = db.profiles?.find(p => String(p.user_id) === String(user.user_id));
    if (profile) {
      profile.joined_lounges = profile.joined_lounges || [];
      if (!profile.joined_lounges.includes(loungeId)) {
        profile.joined_lounges.push(loungeId);
      }
    }

    saveDb();
    res.status(201).json(newSublounge);
  } catch (err: any) {
    console.error('Error creating sublounge:', err);
    res.status(500).json({ error: 'Failed to create sublounge.' });
  }
};

// GET system lounges
export const getSystemLounges = async (req: Request, res: Response) => {
  try {
    loadDb();
    db.lounges = db.lounges || [];
    const systemLounges = db.lounges.filter(l => l && (Number(l.is_system) === 1 || l.type === 'official') && l.status !== 'deleted');
    res.json(systemLounges);
  } catch (err: any) {
    console.error('Error fetching system lounges:', err);
    res.status(500).json({ error: 'Failed to retrieve system lounges.' });
  }
};

// GET user lounges
export const getUserLounges = async (req: Request, res: Response) => {
  try {
    loadDb();
    db.lounges = db.lounges || [];
    const userLounges = db.lounges.filter(l => l && Number(l.is_system) === 0 && l.type !== 'official' && l.status !== 'deleted');
    res.json(userLounges);
  } catch (err: any) {
    console.error('Error fetching user lounges:', err);
    res.status(500).json({ error: 'Failed to retrieve user lounges.' });
  }
};

// PUT update lounge
export const updateLounge = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, slug, visibility, status, hide_member_list, welcome_message, icon_url } = req.body;
    const user = (req as any).user;

    loadDb();
    db.lounges = db.lounges || [];

    const index = db.lounges.findIndex(l => l && (l.id === id || l.lounge_id === id || l.slug === id));
    if (index === -1) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    const lounge = db.lounges[index];

    // Section 4 Axis 1 & 2 Permission checking
    const hasPerm = can(user, PERMISSIONS.UPDATE_SETTINGS, lounge);
    if (!hasPerm) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify settings.' });
    }

    if (name) lounge.name = name.trim();
    if (description !== undefined) lounge.description = description;
    if (visibility) {
      lounge.visibility = visibility;
      lounge.is_private = visibility === 'private' ? 1 : 0;
    }
    if (status) lounge.status = status;
    if (icon_url !== undefined) lounge.icon_url = icon_url;
    if (hide_member_list !== undefined) lounge.hide_member_list = hide_member_list ? 1 : 0;
    if (welcome_message !== undefined) (lounge as any).welcome_message = welcome_message;

    if (slug) {
      const slugVal = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const slugDuplicate = db.lounges.some(l => l && l.slug === slugVal && l.id !== lounge.id);
      if (slugDuplicate) {
        return res.status(400).json({ error: 'Slug is already in use.' });
      }
      lounge.slug = slugVal;
    }

    lounge.updated_at = Date.now();
    saveDb();

    res.json(lounge);
  } catch (err: any) {
    console.error('Error updating lounge:', err);
    res.status(500).json({ error: 'Failed to update lounge.' });
  }
};

// DELETE lounge (Section 5: Cascading delete for sublounges)
export const deleteLounge = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    loadDb();
    db.lounges = db.lounges || [];

    const index = db.lounges.findIndex(l => l && (l.id === id || l.lounge_id === id || l.slug === id));
    if (index === -1) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    const lounge = db.lounges[index];

    // Axis 2 check: System Admins override, otherwise only creator/owner can delete
    const isCreator = String(lounge.creator_id || lounge.owner_id || lounge.owner_user_id) === String(user.user_id);
    const isSysAdmin = user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN';

    if (!isCreator && !isSysAdmin) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges to delete lounge.' });
    }

    const targetId = lounge.lounge_id;
    const idsToPurge = [targetId];

    // Collect child sublounges
    db.lounges.forEach(l => {
      if (l && l.parent_lounge_id === targetId) {
        idsToPurge.push(l.lounge_id);
      }
    });

    // Mark as deleted or filter out
    db.lounges = db.lounges.filter(l => l && !idsToPurge.includes(l.lounge_id));
    
    // Purge members of these lounges
    db.lounge_members = (db.lounge_members || []).filter(m => !idsToPurge.includes(m.lounge_id));

    saveDb();
    res.json({ success: true, purgedIds: idsToPurge });
  } catch (err: any) {
    console.error('Error deleting lounge:', err);
    res.status(500).json({ error: 'Failed to delete lounge.' });
  }
};

// GET rooms under a lounge
export const getRooms = async (req: Request, res: Response) => {
  try {
    const { loungeId } = req.params;
    const user = (req as any).user;

    if (loungeId === 'secops') {
      const isAdmin = user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_ADMIN';
      if (!isAdmin) return res.status(403).json({ error: 'Access denied.' });
    }

    loadDb();
    db.lounges = db.lounges || [];

    const parentLounge = db.lounges.find(l => l && l.lounge_id === loungeId);
    if (!parentLounge) {
      return res.status(404).json({ error: 'Parent lounge not found.' });
    }

    let rooms = db.lounges
      .filter(l => l && l.parent_lounge_id === loungeId && l.status !== 'deleted')
      .map(r => ({
        id: r.lounge_id,
        lounge_id: r.parent_lounge_id!,
        name: r.name,
        created_at: r.created_at,
        is_locked: r.visibility === 'private' || r.is_private === 1,
        invite_code: r.invite_code,
        created_by: Number(r.creator_id || r.owner_id || r.owner_user_id)
      }));

    // Filter to room access bounds
    rooms = rooms.filter(r => {
      // Check can check
      const roomObj = db.lounges?.find(l => l.lounge_id === r.id);
      return can(user, PERMISSIONS.VIEW_MEMBERS, roomObj);
    });

    res.json(rooms);
  } catch (err: any) {
    console.error('Error fetching rooms:', err);
    res.status(500).json({ error: 'Failed to fetch rooms.' });
  }
};

// POST create room under a lounge
export const createRoom = async (req: Request, res: Response) => {
  try {
    const { loungeId } = req.params;
    const { name, is_locked } = req.body;
    const user = (req as any).user;

    if (loungeId === 'secops') {
      const isAdmin = user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_ADMIN';
      if (!isAdmin) return res.status(403).json({ error: 'Access denied.' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Room name is required.' });
    }

    loadDb();
    db.lounges = db.lounges || [];

    const parentLounge = db.lounges.find(l => l && l.lounge_id === loungeId);
    if (!parentLounge) {
      return res.status(404).json({ error: 'Parent lounge not found.' });
    }

    // Section 2: Max 10 sublounges per parent
    const activeSublounges = db.lounges.filter(l => l.parent_lounge_id === loungeId && l.status !== 'deleted');
    if (activeSublounges.length >= 10) {
      return res.status(400).json({ error: 'Rejecting room creation: Max 10 sublounges per parent exceeded.' });
    }

    // Section 2: One private sublounge per user per parent
    if (is_locked) {
      const existing = db.lounges.find(l => 
        l.parent_lounge_id === loungeId && 
        String(l.owner_user_id || l.owner_id) === String(user.user_id) && 
        l.type === 'private_sublounge' && 
        l.status !== 'deleted'
      );
      if (existing) {
        return res.status(400).json({ error: 'Rejecting room creation: One private sublounge per user per parent allowed.' });
      }
    }

    const subLoungeId = generatePrefixedId('comm');
    const slug = generateUniqueSlug(name);
    const inviteCode = is_locked ? generateInviteCode('s') : null;

    const newSublounge: Lounge = {
      lounge_id: subLoungeId,
      name: name.trim(),
      description: '',
      owner_id: String(user.user_id),
      created_at: Date.now(),
      is_private: is_locked ? 1 : 0,
      is_official: 0,
      last_message_at: Date.now(),
      invite_code: inviteCode,
      id: subLoungeId,
      slug,
      creator_id: String(user.user_id),
      parent_lounge_id: loungeId,
      updated_at: Date.now(),
      is_system: 0,
      visibility: is_locked ? 'private' : 'public',
      status: 'active',
      type: is_locked ? 'private_sublounge' : 'user_created',
      owner_user_id: user.user_id,
      hide_member_list: 0,
      is_locked: is_locked ? 1 : 0,
      last_active_at: Date.now()
    };

    db.lounges.push(newSublounge);

    // Register initial member
    db.lounge_members = db.lounge_members || [];
    db.lounge_members.push({
      lounge_id: subLoungeId,
      user_id: user.user_id,
      role: 'owner',
      status: 'active',
      joined_via: 'default',
      joined_at: Date.now()
    });

    if (inviteCode) {
      db.lounge_invites = db.lounge_invites || [];
      db.lounge_invites.push({
        id: generatePrefixedId('inv'),
        lounge_id: subLoungeId,
        code: inviteCode,
        created_by: user.user_id,
        max_uses: 1, // sublounge codes single use by default
        uses_count: 0,
        expires_at: null,
        revoked_at: null
      });
    }

    saveDb();

    res.status(201).json({
      id: newSublounge.lounge_id,
      lounge_id: newSublounge.parent_lounge_id,
      name: newSublounge.name,
      created_at: newSublounge.created_at,
      is_locked: newSublounge.is_private === 1,
      created_by: Number(newSublounge.creator_id),
      invite_code: newSublounge.invite_code
    });
  } catch (err: any) {
    console.error('Error creating room:', err);
    res.status(500).json({ error: 'Failed to create room.' });
  }
};

// POST join lounge by invite code (Section 6)
export const joinLounge = async (req: Request, res: Response) => {
  try {
    const { invite_code } = req.body;
    const user = (req as any).user;

    if (!invite_code) {
      return res.status(400).json({ error: 'Invite code is required.' });
    }

    loadDb();
    db.lounges = db.lounges || [];

    // Format verify & resolve (Section 3 & Section 6)
    let lounge: Lounge | undefined;
    let inviteRecord = db.lounge_invites?.find(i => i.code === invite_code && !i.revoked_at);

    if (inviteRecord) {
      if (inviteRecord.expires_at && inviteRecord.expires_at < Date.now()) {
        return res.status(400).json({ error: 'Invite code has expired.' });
      }
      if (inviteRecord.uses_count >= inviteRecord.max_uses) {
        return res.status(400).json({ error: 'Invite code usage limit exceeded.' });
      }
      lounge = db.lounges.find(l => l.lounge_id === inviteRecord?.lounge_id);
    } else {
      // Legacy code support (fallback lookup directly on lounges array)
      lounge = db.lounges.find(l => l && l.invite_code === invite_code);
    }

    if (!lounge) {
      return res.status(404).json({ error: 'Invalid invite code.' });
    }

    // Check if target is banned
    const membership = db.lounge_members?.find(m => m.lounge_id === lounge?.lounge_id && String(m.user_id) === String(user.user_id));
    if (membership && (membership.status === 'banned' || membership.status === 'kicked')) {
      return res.status(403).json({ error: 'Access denied: You are banned or kicked from this lounge.' });
    }

    // Increment invite usage
    if (inviteRecord) {
      inviteRecord.uses_count++;
    }

    // Register member in lounge_members
    db.lounge_members = db.lounge_members || [];
    const isAlreadyMember = db.lounge_members.some(m => m.lounge_id === lounge?.lounge_id && String(m.user_id) === String(user.user_id));
    if (!isAlreadyMember) {
      db.lounge_members.push({
        lounge_id: lounge.lounge_id,
        user_id: user.user_id,
        role: 'member',
        status: 'active',
        joined_via: 'invite_code',
        joined_at: Date.now()
      });
    }

    // Register in legacy joined_lounges array
    const profile = db.profiles?.find(p => String(p.user_id) === String(user.user_id));
    if (profile) {
      profile.joined_lounges = profile.joined_lounges || [];
      if (!profile.joined_lounges.includes(lounge.lounge_id)) {
        profile.joined_lounges.push(lounge.lounge_id);
      }
    }

    // Append welcome message if owner welcome authoring exists (Section 13)
    if ((lounge as any).welcome_message) {
      db.messages = db.messages || [];
      db.messages.push({
        message_id: generatePrefixedId('msg_welcome'),
        room_id: lounge.lounge_id,
        user_id: 999, // unattributed system sender
        content: (lounge as any).welcome_message,
        timestamp: new Date().toISOString(),
        status: 'sent',
        type: 'text'
      } as any);
    }

    saveDb();
    res.json({ success: true, lounge_id: lounge.lounge_id });
  } catch (err: any) {
    console.error('Error joining lounge:', err);
    res.status(500).json({ error: 'Failed to join lounge.' });
  }
};

// GET explore lounges
export const exploreLounges = async (req: Request, res: Response) => {
  try {
    loadDb();
    db.lounges = db.lounges || [];

    // Filter out private sublounges and private parent lounges (Section 12)
    const exploreList = db.lounges.filter(c => 
      c && c.parent_lounge_id === null && 
      Number(c.is_system) === 0 && 
      Number(c.is_official) === 0 && 
      c.visibility === 'public' &&
      c.status !== 'deleted'
    );
    res.json(exploreList);
  } catch (err: any) {
    console.error('Error exploring lounges:', err);
    res.status(500).json({ error: 'Failed to explore lounges.' });
  }
};

// GET lounge members
export const getLoungeMembers = async (req: Request, res: Response) => {
  try {
    const { loungeId } = req.params;
    const actor = (req as any).user;
    loadDb();
    db.users = db.users || [];
    db.profiles = db.profiles || [];
    db.lounges = db.lounges || [];

    const lounge = db.lounges.find(l => l && (l.id === loungeId || l.lounge_id === loungeId));
    if (!lounge && loungeId !== 'velum_lounge') {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    // Section 2: Owner controlled hide member list
    if (lounge && lounge.hide_member_list) {
      const isActorAdmin = db.lounge_members?.some(m => m.lounge_id === loungeId && String(m.user_id) === String(actor.user_id) && (m.role === 'admin' || m.role === 'owner'));
      const isSystemAdmin = actor.role === 'CLI_ADMIN' || actor.role === 'LOGIN_ADMIN';
      if (!isActorAdmin && !isSystemAdmin) {
        return res.status(403).json({ error: 'Forbidden: Membership list is hidden in this lounge.' });
      }
    }

    let loungeMembers = [];

    if (loungeId === 'velum_lounge') {
      loungeMembers = db.users;
    } else {
      loungeMembers = db.users.filter(u => {
        const isMember = db.lounge_members?.some(m => m.lounge_id === loungeId && m.user_id === u.user_id && m.status === 'active');
        const legacyJoined = db.profiles.find(p => p && String(p.user_id) === String(u.user_id))?.joined_lounges?.includes(loungeId);
        return isMember || legacyJoined || (lounge && String(u.user_id) === String(lounge.owner_id || lounge.owner_user_id));
      });
    }

    const membersData = loungeMembers.map(u => {
      const prof = db.profiles.find(p => p && String(p.user_id) === String(u.user_id));
      const membership = db.lounge_members?.find(m => m.lounge_id === loungeId && m.user_id === u.user_id);
      return {
        user_id: u.user_id,
        userId: u.user_id,
        username: u.username,
        role: loungeId === 'velum_lounge'
          ? (u.user_id === 1 || u.user_id === 2 ? 'owner' : (u.role === 'SUPPORT_ADMIN' ? 'moderator' : 'member'))
          : (membership?.role || u.role || 'member'),
        status: u.status,
        last_seen_at: u.last_seen_at || null,
        displayName: prof?.displayName || u.username,
        avatar: prof?.avatar || 'emerald',
        location: prof?.location || 'Warsaw, Poland'
      };
    });

    res.json(membersData);
  } catch (err: any) {
    console.error('Error fetching lounge members:', err);
    res.status(500).json({ error: 'Failed to retrieve lounge members.' });
  }
};

// POST apply to join a private lounge (Section 6)
export const applyToJoinLounge = async (req: Request, res: Response) => {
  try {
    const { loungeId, message } = req.body;
    const user = (req as any).user;

    loadDb();
    db.lounges = db.lounges || [];

    const lounge = db.lounges.find(l => l.lounge_id === loungeId);
    if (!lounge) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    db.lounge_join_requests = db.lounge_join_requests || [];
    const existing = db.lounge_join_requests.find(r => r.lounge_id === loungeId && r.user_id === user.user_id && r.status === 'pending');
    if (existing) {
      return res.status(400).json({ error: 'You already have a pending join request for this lounge.' });
    }

    const newRequest: LoungeJoinRequest = {
      id: generatePrefixedId('req'),
      lounge_id: loungeId,
      user_id: user.user_id,
      message: message || '',
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null
    };

    db.lounge_join_requests.push(newRequest);
    saveDb();

    res.status(201).json(newRequest);
  } catch (err: any) {
    console.error('Error applying to lounge:', err);
    res.status(500).json({ error: 'Failed to submit join request.' });
  }
};

// POST review join request (Section 6)
export const reviewJoinRequest = async (req: Request, res: Response) => {
  try {
    const { requestId, approve } = req.body;
    const actor = (req as any).user;

    loadDb();
    db.lounge_join_requests = db.lounge_join_requests || [];

    const request = db.lounge_join_requests.find(r => r.id === requestId);
    if (!request) {
      return res.status(404).json({ error: 'Join request not found.' });
    }

    const lounge = db.lounges?.find(l => l.lounge_id === request.lounge_id);
    if (!lounge) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    // Check authority to review
    const hasPerm = can(actor, PERMISSIONS.UPDATE_SETTINGS, lounge);
    if (!hasPerm) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to review requests.' });
    }

    request.status = approve ? 'approved' : 'rejected';
    request.reviewed_by = actor.user_id;
    request.reviewed_at = Date.now();

    if (approve) {
      db.lounge_members = db.lounge_members || [];
      db.lounge_members.push({
        lounge_id: request.lounge_id,
        user_id: request.user_id,
        role: 'member',
        status: 'active',
        joined_via: 'application',
        joined_at: Date.now()
      });

      // Add to legacy profiles
      const profile = db.profiles?.find(p => String(p.user_id) === String(request.user_id));
      if (profile) {
        profile.joined_lounges = profile.joined_lounges || [];
        if (!profile.joined_lounges.includes(request.lounge_id)) {
          profile.joined_lounges.push(request.lounge_id);
        }
      }
    }

    saveDb();
    res.json({ success: true, request });
  } catch (err: any) {
    console.error('Error reviewing join request:', err);
    res.status(500).json({ error: 'Failed to process request.' });
  }
};

// POST transfer ownership (Section 7)
export const transferOwnership = async (req: Request, res: Response) => {
  try {
    const { loungeId, targetUserId } = req.body;
    const actor = (req as any).user;

    loadDb();
    const lounge = db.lounges?.find(l => l.lounge_id === loungeId);
    if (!lounge) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    const isOwner = String(lounge.owner_user_id || lounge.owner_id) === String(actor.user_id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden: Only the lounge owner can initiate transfer.' });
    }

    // Verify target user exists
    const target = db.users?.find(u => u.user_id === Number(targetUserId));
    if (!target) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    db.lounge_ownership_transfers = db.lounge_ownership_transfers || [];
    const transferId = generatePrefixedId('trans');

    const newTransfer: LoungeOwnershipTransfer = {
      id: transferId,
      lounge_id: loungeId,
      from_user_id: actor.user_id,
      to_user_id: Number(targetUserId),
      status: 'pending',
      initiated_at: Date.now(),
      resolved_at: null
    };

    db.lounge_ownership_transfers.push(newTransfer);
    saveDb();

    res.status(201).json(newTransfer);
  } catch (err: any) {
    console.error('Error initiating transfer:', err);
    res.status(500).json({ error: 'Failed to initiate transfer.' });
  }
};

// POST respond to ownership transfer (Section 7)
export const respondOwnershipTransfer = async (req: Request, res: Response) => {
  try {
    const { transferId, accept } = req.body;
    const actor = (req as any).user;

    loadDb();
    db.lounge_ownership_transfers = db.lounge_ownership_transfers || [];

    const transfer = db.lounge_ownership_transfers.find(t => t.id === transferId);
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer request not found.' });
    }

    if (String(transfer.to_user_id) !== String(actor.user_id)) {
      return res.status(403).json({ error: 'Forbidden: You are not the target of this transfer.' });
    }

    transfer.status = accept ? 'accepted' : 'declined';
    transfer.resolved_at = Date.now();

    if (accept) {
      const lounge = db.lounges?.find(l => l.lounge_id === transfer.lounge_id);
      if (lounge) {
        lounge.owner_user_id = transfer.to_user_id;
        lounge.owner_id = String(transfer.to_user_id);

        // Update members list: old owner becomes admin, new owner gets owner role
        const oldOwnerMem = db.lounge_members?.find(m => m.lounge_id === transfer.lounge_id && m.user_id === transfer.from_user_id);
        if (oldOwnerMem) oldOwnerMem.role = 'admin';

        const newOwnerMem = db.lounge_members?.find(m => m.lounge_id === transfer.lounge_id && m.user_id === transfer.to_user_id);
        if (newOwnerMem) {
          newOwnerMem.role = 'owner';
        } else {
          db.lounge_members?.push({
            lounge_id: transfer.lounge_id,
            user_id: transfer.to_user_id,
            role: 'owner',
            status: 'active',
            joined_via: 'default',
            joined_at: Date.now()
          });
        }
      }
    }

    saveDb();
    res.json({ success: true, transfer });
  } catch (err: any) {
    console.error('Error responding to transfer:', err);
    res.status(500).json({ error: 'Failed to resolve transfer.' });
  }
};

// POST user preferences mute/pin (Section 14)
export const updatePreferences = async (req: Request, res: Response) => {
  try {
    const { loungeId, notifications_muted, pinned, pin_order } = req.body;
    const user = (req as any).user;

    loadDb();
    db.user_lounge_preferences = db.user_lounge_preferences || [];

    let pref = db.user_lounge_preferences.find(p => p.lounge_id === loungeId && String(p.user_id) === String(user.user_id));
    if (!pref) {
      pref = {
        user_id: user.user_id,
        lounge_id: loungeId,
        notifications_muted: notifications_muted ? 1 : 0,
        pinned: pinned ? 1 : 0,
        pin_order: pin_order || 0
      };
      db.user_lounge_preferences.push(pref);
    } else {
      if (notifications_muted !== undefined) pref.notifications_muted = notifications_muted ? 1 : 0;
      if (pinned !== undefined) pref.pinned = pinned ? 1 : 0;
      if (pin_order !== undefined) pref.pin_order = pin_order;
    }

    saveDb();
    res.json(pref);
  } catch (err: any) {
    console.error('Error updating preferences:', err);
    res.status(500).json({ error: 'Failed to update preferences.' });
  }
};

// POST apply sanction (Section 5 & Section 10)
export const applySanctionEndpoint = async (req: Request, res: Response) => {
  try {
    const { loungeId, targetUserId, type, reason } = req.body;
    const actor = (req as any).user;

    loadDb();
    const lounge = db.lounges?.find(l => l.lounge_id === loungeId);
    if (!lounge) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    // Check authority to sanction
    let actionPerm = PERMISSIONS.MUTE_MEMBER;
    if (type === 'ban') actionPerm = PERMISSIONS.BAN_MEMBER;
    if (type === 'kick') actionPerm = PERMISSIONS.KICK_MEMBER;

    const hasPerm = can(actor, actionPerm, lounge);
    if (!hasPerm) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges to apply sanction.' });
    }

    // Verify target and authority tiers
    const target = db.users?.find(u => u.user_id === Number(targetUserId));
    if (!target) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    const actorAuthority = actor.role === 'CLI_ADMIN' ? 3 : actor.role === 'LOGIN_ADMIN' ? 2 : 1;
    const targetAuthority = target.role === 'CLI_ADMIN' ? 3 : target.role === 'LOGIN_ADMIN' ? 2 : 1;

    if (targetAuthority >= actorAuthority) {
      return res.status(403).json({ error: 'Forbidden: Cannot sanction user of equal or higher authority tier.' });
    }

    // Apply Sanction Record
    const sanctionId = generatePrefixedId('sanc');
    const actorType = actor.role === 'CLI_ADMIN' ? 'cli_admin' : actor.role === 'LOGIN_ADMIN' ? 'login_admin' : 'lounge_admin';

    const newSanction: LoungeSanction = {
      id: sanctionId,
      lounge_id: loungeId,
      user_id: Number(targetUserId),
      type,
      applied_by: actor.user_id,
      applied_by_type: actorType,
      applied_at: Date.now(),
      lifted_at: null,
      reason: reason || ''
    };

    db.lounge_sanctions = db.lounge_sanctions || [];
    db.lounge_sanctions.push(newSanction);

    // Update status in member registry
    const targetMem = db.lounge_members?.find(m => m.lounge_id === loungeId && m.user_id === Number(targetUserId));
    if (targetMem) {
      targetMem.status = type === 'mute' ? 'muted' : type === 'ban' ? 'banned' : 'kicked';
    } else {
      db.lounge_members = db.lounge_members || [];
      db.lounge_members.push({
        lounge_id: loungeId,
        user_id: Number(targetUserId),
        role: 'member',
        status: type === 'ban' ? 'banned' : type === 'kick' ? 'kicked' : 'muted',
        joined_via: 'default',
        joined_at: Date.now()
      });
    }

    // Cascade deletions for private sublounges (Section 5)
    if (type === 'ban' || type === 'kick') {
      const isGlobal = actor.role === 'CLI_ADMIN' || actor.role === 'LOGIN_ADMIN';
      const subloungesToPurge = (db.lounges || []).filter(l => {
        const matchesOwner = String(l.owner_user_id || l.owner_id) === String(targetUserId);
        const matchesParent = isGlobal || l.parent_lounge_id === loungeId;
        return matchesOwner && matchesParent && l.type === 'private_sublounge' && l.status !== 'deleted';
      });

      for (const sub of subloungesToPurge) {
        sub.status = 'deleted';
        db.lounge_members = (db.lounge_members || []).filter(m => m.lounge_id !== sub.lounge_id);
        
        // Notify user of room closure
        const dmRoomId = `dm_velum_${targetUserId}`;
        db.messages = db.messages || [];
        db.messages.push({
          message_id: generatePrefixedId('msg_sys_cascade'),
          room_id: dmRoomId,
          user_id: 999,
          content: `Your private sublounge "${sub.name}" was closed because of a parent sanction.`,
          timestamp: new Date().toISOString(),
          status: 'sent',
          type: 'text'
        } as any);
      }
    }

    // Add Audit Log
    db.lounge_audit_logs = db.lounge_audit_logs || [];
    db.lounge_audit_logs.push({
      id: generatePrefixedId('al'),
      lounge_id: loungeId,
      actor_id: actor.user_id,
      actor_type: actorType,
      action: type,
      target_type: 'user',
      target_id: String(targetUserId),
      metadata: JSON.stringify({ reason }),
      created_at: Date.now()
    });

    saveDb();
    res.json({ success: true, sanction: newSanction });
  } catch (err: any) {
    console.error('Error applying sanction:', err);
    res.status(500).json({ error: 'Failed to apply sanction.' });
  }
};

// GET join requests for a lounge (Section 6)
export const getLoungeJoinRequests = async (req: Request, res: Response) => {
  try {
    const { loungeId } = req.params;
    const actor = (req as any).user;

    loadDb();
    db.lounges = db.lounges || [];
    const lounge = db.lounges.find(l => l.lounge_id === loungeId || l.id === loungeId);
    if (!lounge) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    const hasPerm = can(actor, PERMISSIONS.UPDATE_SETTINGS, lounge);
    if (!hasPerm) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view join requests.' });
    }

    db.lounge_join_requests = db.lounge_join_requests || [];
    const requests = db.lounge_join_requests
      .filter(r => r.lounge_id === lounge.lounge_id && r.status === 'pending')
      .map(r => {
        const u = db.users?.find(usr => usr.user_id === r.user_id);
        const p = db.profiles?.find(prof => String(prof.user_id) === String(r.user_id));
        return {
          ...r,
          username: u?.username || 'unknown',
          displayName: p?.displayName || u?.username || 'unknown',
          avatar: p?.avatar || 'emerald'
        };
      });

    res.json(requests);
  } catch (err: any) {
    console.error('Error fetching join requests:', err);
    res.status(500).json({ error: 'Failed to retrieve join requests.' });
  }
};

// POST add lounge member directly by username (Section 6)
export const addLoungeMember = async (req: Request, res: Response) => {
  try {
    const { loungeId } = req.params;
    const { username } = req.body;
    const actor = (req as any).user;

    if (!username) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    loadDb();
    db.lounges = db.lounges || [];
    const lounge = db.lounges.find(l => l.lounge_id === loungeId || l.id === loungeId);
    if (!lounge) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    const hasPerm = can(actor, PERMISSIONS.UPDATE_SETTINGS, lounge);
    if (!hasPerm) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to add members directly.' });
    }

    const normalizedUsername = username.trim().toLowerCase().replace(/^@/, '');
    const targetUser = db.users?.find(u => u.username.toLowerCase() === normalizedUsername);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    db.lounge_members = db.lounge_members || [];
    const isAlreadyMember = db.lounge_members.some(m => m.lounge_id === lounge.lounge_id && m.user_id === targetUser.user_id && m.status === 'active');
    if (isAlreadyMember) {
      return res.status(400).json({ error: 'User is already an active member of this lounge.' });
    }

    const existingMembership = db.lounge_members.find(m => m.lounge_id === lounge.lounge_id && m.user_id === targetUser.user_id);
    if (existingMembership) {
      existingMembership.status = 'active';
      existingMembership.joined_via = 'added_by_admin';
      existingMembership.joined_at = Date.now();
    } else {
      db.lounge_members.push({
        lounge_id: lounge.lounge_id,
        user_id: targetUser.user_id,
        role: 'member',
        status: 'active',
        joined_via: 'added_by_admin',
        joined_at: Date.now()
      });
    }

    const profile = db.profiles?.find(p => String(p.user_id) === String(targetUser.user_id));
    if (profile) {
      profile.joined_lounges = profile.joined_lounges || [];
      if (!profile.joined_lounges.includes(lounge.lounge_id)) {
        profile.joined_lounges.push(lounge.lounge_id);
      }
    }

    saveDb();
    res.json({ success: true, user_id: targetUser.user_id });
  } catch (err: any) {
    console.error('Error adding lounge member:', err);
    res.status(500).json({ error: 'Failed to add lounge member.' });
  }
};

// POST update lounge member role (Section 4)
export const updateLoungeMemberRole = async (req: Request, res: Response) => {
  try {
    const { loungeId, targetUserId } = req.params;
    const { role, status } = req.body;
    const actor = (req as any).user;

    loadDb();
    db.lounges = db.lounges || [];
    const lounge = db.lounges.find(l => l.lounge_id === loungeId || l.id === loungeId);
    if (!lounge) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    const hasPerm = can(actor, PERMISSIONS.UPDATE_SETTINGS, lounge);
    if (!hasPerm) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to manage members.' });
    }

    db.lounge_members = db.lounge_members || [];
    const member = db.lounge_members.find(m => m.lounge_id === lounge.lounge_id && m.user_id === Number(targetUserId));
    if (!member) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    if (member.role === 'owner' && role && role !== 'owner') {
      return res.status(400).json({ error: 'Cannot demote the owner directly. Use ownership transfer.' });
    }

    if (role) {
      if (role === 'owner') {
        return res.status(400).json({ error: 'To promote to owner, use ownership transfer.' });
      }
      member.role = role;
    }

    if (status) {
      member.status = status;
    }

    saveDb();
    res.json({ success: true, member });
  } catch (err: any) {
    console.error('Error updating member role:', err);
    res.status(500).json({ error: 'Failed to update member role.' });
  }
};

// GET lounge invites (Section 3)
export const getLoungeInvites = async (req: Request, res: Response) => {
  try {
    const { loungeId } = req.params;
    const actor = (req as any).user;

    loadDb();
    db.lounges = db.lounges || [];
    const lounge = db.lounges.find(l => l.lounge_id === loungeId || l.id === loungeId);
    if (!lounge) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    const hasPerm = can(actor, PERMISSIONS.UPDATE_SETTINGS, lounge);
    if (!hasPerm) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view invites.' });
    }

    db.lounge_invites = db.lounge_invites || [];
    const invites = db.lounge_invites.filter(i => i.lounge_id === lounge.lounge_id && !i.revoked_at);
    res.json(invites);
  } catch (err: any) {
    console.error('Error fetching invites:', err);
    res.status(500).json({ error: 'Failed to retrieve invites.' });
  }
};

// POST create new lounge invite code (Section 3)
export const createLoungeInvite = async (req: Request, res: Response) => {
  try {
    const { loungeId } = req.params;
    const { max_uses, expires_in_days } = req.body;
    const actor = (req as any).user;

    loadDb();
    db.lounges = db.lounges || [];
    const lounge = db.lounges.find(l => l.lounge_id === loungeId || l.id === loungeId);
    if (!lounge) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    const hasPerm = can(actor, PERMISSIONS.UPDATE_SETTINGS, lounge);
    if (!hasPerm) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to generate invites.' });
    }

    const isSub = !!lounge.parent_lounge_id;
    const code = generateInviteCode(isSub ? 's' : 'p');

    db.lounge_invites = db.lounge_invites || [];
    const newInvite: LoungeInvite = {
      id: generatePrefixedId('inv'),
      lounge_id: lounge.lounge_id,
      code,
      created_by: actor.user_id,
      max_uses: max_uses || (isSub ? 1 : 999),
      uses_count: 0,
      expires_at: expires_in_days ? Date.now() + expires_in_days * 24 * 60 * 60 * 1000 : null,
      revoked_at: null
    };

    db.lounge_invites.push(newInvite);
    lounge.invite_code = code;

    saveDb();
    res.status(201).json(newInvite);
  } catch (err: any) {
    console.error('Error creating invite:', err);
    res.status(500).json({ error: 'Failed to generate invite.' });
  }
};

// POST revoke lounge invite (Section 3)
export const revokeLoungeInvite = async (req: Request, res: Response) => {
  try {
    const { loungeId, inviteId } = req.params;
    const actor = (req as any).user;

    loadDb();
    db.lounges = db.lounges || [];
    const lounge = db.lounges.find(l => l.lounge_id === loungeId || l.id === loungeId);
    if (!lounge) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    const hasPerm = can(actor, PERMISSIONS.UPDATE_SETTINGS, lounge);
    if (!hasPerm) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to revoke invites.' });
    }

    db.lounge_invites = db.lounge_invites || [];
    const invite = db.lounge_invites.find(i => i.id === inviteId && i.lounge_id === lounge.lounge_id);
    if (!invite) {
      return res.status(404).json({ error: 'Invite not found.' });
    }

    invite.revoked_at = Date.now();
    saveDb();
    res.json({ success: true, invite });
  } catch (err: any) {
    console.error('Error revoking invite:', err);
    res.status(500).json({ error: 'Failed to revoke invite.' });
  }
};
