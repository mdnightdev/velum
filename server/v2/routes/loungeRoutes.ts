import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db/client.js';
import { lounges, loungeMembers, messages } from '../db/schema/lounges.js';
import { users } from '../db/schema/users.js';
import { ensureVelumLoungeSeeded } from '../services/loungeSeeder.js';
import { eq, and, desc } from 'drizzle-orm';
import { createAuthMiddleware, extractSessionToken, hashSessionToken } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';

export const loungeRouter = Router();

const auth = createAuthMiddleware(async (hashedToken) => {
  const result = await userRepository.findSessionByTokenHash(hashedToken);
  if (!result) return null;
  const { session, user } = result;
  return {
    user: {
      userId: user.id,
      username: user.username,
      role: user.role,
      duress_active: user.duressActive
    },
    expiresAt: session.expiresAt
  };
});

const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const rawToken = extractSessionToken(req);
    if (rawToken) {
      const hashed = hashSessionToken(rawToken);
      const result = await userRepository.findSessionByTokenHash(hashed);
      if (result) {
        req.user = {
          userId: result.user.id,
          username: result.user.username,
          role: result.user.role,
          duress_active: result.user.duressActive
        };
      }
    }
  } catch {
    // optional auth ignore
  }
  next();
};

// Ensure master lounge is seeded in background
loungeRouter.use((_req: Request, _res: Response, next: NextFunction) => {
  ensureVelumLoungeSeeded().catch(err => console.error('Lounge seeder background error:', err));
  next();
});

// GET /v2/lounges - List all official lounges and top-level public lounges
loungeRouter.get('/', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allLounges = (await db.select().from(lounges)).filter(l => l.type !== 'dm');
    const parentLounges = allLounges.filter(l => !l.parentLoungeId);
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'BANK_ADMIN' || req.user?.role === 'SUPPORT_ADMIN' || req.user?.role === 'CLI_ADMIN';
    
    const formatted = parentLounges.map(parent => {
      const sublounges = allLounges.filter(l => l.parentLoungeId === parent.id);
      const visibleSublounges = isAdmin ? sublounges : sublounges.filter(l => !l.isHidden);
      
      return {
        ...parent,
        lounge_id: parent.slug || `lounge_${parent.id}`,
        is_official: parent.isOfficial,
        is_private: parent.isPrivate,
        avatar_url: parent.avatarUrl,
        sublounges: visibleSublounges.map(sub => ({
          ...sub,
          lounge_id: sub.slug || `lounge_${sub.id}`,
          is_official: sub.isOfficial,
          is_private: sub.isPrivate
        }))
      };
    });

    res.json({ lounges: formatted });
  } catch (err) {
    next(err);
  }
});

// GET /v2/lounges/user - Get lounges joined by current user
loungeRouter.get('/user', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user?.userId;
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'BANK_ADMIN' || req.user?.role === 'SUPPORT_ADMIN' || req.user?.role === 'CLI_ADMIN';
    const allLounges = (await db.select().from(lounges)).filter(l => l.type !== 'dm');
    
    if (!currentUserId) {
      const publicLounges = allLounges.filter(l => !l.isPrivate && !l.isHidden);
      return res.json({ lounges: publicLounges });
    }

    const memberships = await db.select().from(loungeMembers).where(eq(loungeMembers.userId, currentUserId));
    const joinedIds = new Set(memberships.map(m => m.loungeId));

    const userLounges = allLounges.filter(l => {
      if (l.slug === 'velum_master_lounge') return true;
      if (joinedIds.has(l.id)) return true;
      if (!l.isPrivate && !l.isHidden) return true;
      if (isAdmin) return true;
      return false;
    });

    res.json({ lounges: userLounges });
  } catch (err) {
    next(err);
  }
});

// GET /v2/lounges/:id - Get lounge metadata
loungeRouter.get('/:id', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'BANK_ADMIN' || req.user?.role === 'SUPPORT_ADMIN' || req.user?.role === 'CLI_ADMIN';
    const all = await db.select().from(lounges);
    const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

    if (!target) {
      return res.status(404).json({ error: `Lounge "${rawId}" not found.` });
    }

    // Hide hidden lounges from non-admin users
    if (target.isHidden && !isAdmin) {
      return res.status(404).json({ error: `Lounge "${rawId}" not found.` });
    }

    const sublounges = all.filter(l => l.parentLoungeId === target.id);
    const visibleSublounges = isAdmin ? sublounges : sublounges.filter(l => !l.isHidden);

    res.json({
      lounge: {
        ...target,
        lounge_id: target.slug || `lounge_${target.id}`,
        is_official: target.isOfficial,
        is_private: target.isPrivate,
        avatar_url: target.avatarUrl,
        sublounges: visibleSublounges.map(s => ({
          ...s,
          lounge_id: s.slug || `lounge_${s.id}`,
          is_official: s.isOfficial,
          is_private: s.isPrivate
        }))
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /v2/lounges/:id/rooms - Get sublounges/rooms for a lounge
loungeRouter.get('/:id/rooms', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const all = await db.select().from(lounges);
    const parent = all.find(l => l.slug === rawId || l.id.toString() === rawId);

    if (!parent) {
      return res.json({ rooms: [] });
    }

    const subs = all.filter(l => l.parentLoungeId === parent.id);
    const formattedRooms = subs.map(sub => ({
      id: sub.slug || `sub_${sub.id}`,
      lounge_id: parent.slug || `lounge_${parent.id}`,
      name: sub.name,
      topic: sub.description,
      is_locked: sub.accessLevel === 'ANNOUNCE' || sub.accessLevel === 'EXEC_ONLY',
      accessLevel: sub.accessLevel,
      type: sub.type
    }));

    res.json({ rooms: formattedRooms });
  } catch (err) {
    next(err);
  }
});

// GET /v2/lounges/:id/members - Get lounge members
loungeRouter.get('/:id/members', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const all = await db.select().from(lounges);
    const parent = all.find(l => l.slug === rawId || l.id.toString() === rawId);

    if (!parent) {
      return res.json({ members: [] });
    }

    const memberRows = await db.select({
      id: loungeMembers.id,
      userId: loungeMembers.userId,
      role: loungeMembers.role,
      status: loungeMembers.status,
      username: users.username,
      userRole: users.role
    })
    .from(loungeMembers)
    .leftJoin(users, eq(loungeMembers.userId, users.id))
    .where(eq(loungeMembers.loungeId, parent.id));

    // If master lounge, also include active users
    let memberList = memberRows.map(m => ({
      id: m.id,
      user_id: m.userId,
      username: m.username || `User_${m.userId}`,
      role: m.role || 'member',
      status: m.status || 'active',
      userRole: m.userRole
    }));

    if (memberList.length === 0) {
      const allUsers = await db.select({ id: users.id, username: users.username, role: users.role }).from(users).limit(50);
      memberList = allUsers.map(u => ({
        id: u.id,
        user_id: u.id,
        username: u.username,
        role: u.role === 'ADMIN' ? 'owner' : 'member',
        status: 'active',
        userRole: u.role
      }));
    }

    res.json({ members: memberList });
  } catch (err) {
    next(err);
  }
});

// POST /v2/lounges/join - Join lounge
loungeRouter.post('/join', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lounge_id, invite_code } = req.body;
    const currentUserId = req.user!.userId;

    const all = await db.select().from(lounges);
    let target;

    // If invite code provided, find lounge by code (works for both private and public)
    if (invite_code) {
      target = all.find(l => l.inviteCode === invite_code);
    } else {
      // If no invite code, find by slug/ID but only if NOT private
      target = all.find(l => (l.slug === lounge_id || l.id.toString() === lounge_id) && l.isPrivate !== true);
    }

    if (!target) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    const existing = await db.select().from(loungeMembers)
      .where(and(eq(loungeMembers.loungeId, target.id), eq(loungeMembers.userId, currentUserId)));

    if (existing.length === 0) {
      await db.insert(loungeMembers).values({
        loungeId: target.id,
        userId: currentUserId,
        role: 'member',
        status: 'active'
      });
    }

    res.json({ success: true, message: `Successfully joined ${target.name}`, lounge: target });
  } catch (err) {
    next(err);
  }
});

// POST /v2/lounges - Create custom lounge
loungeRouter.post('/', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, is_private, icon_url } = req.body;
    const currentUserId = req.user!.userId;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Lounge name is required.' });
    }

    const isPrivate = Boolean(is_private);
    const inviteCode = isPrivate ? `VL/M-${Math.random().toString(36).substring(2, 6).toUpperCase()}` : null;
    const slug = `lounge_${Date.now()}`;
    const [created] = await db.insert(lounges).values({
      slug,
      name: name.trim(),
      description: typeof description === 'string' ? description : null,
      ownerId: currentUserId,
      isPrivate,
      type: 'user_created',
      accessLevel: 'ALL',
      inviteCode,
      avatarUrl: typeof icon_url === 'string' ? icon_url : null
    }).returning();

    await db.insert(loungeMembers).values({
      loungeId: created.id,
      userId: currentUserId,
      role: 'owner',
      status: 'active'
    });

    res.status(201).json({ lounge: created });
  } catch (err) {
    next(err);
  }
});

// POST /v2/lounges/:id/sublounges - Create sublounge under parent lounge
loungeRouter.post('/:id/sublounges', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, is_private } = req.body;
    const currentUserId = req.user!.userId;
    const rawId = req.params.id;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Sublounge name is required.' });
    }

    // Get parent lounge details - support both ID and slug
    const allLounges = await db.select().from(lounges);
    const parentLounge = allLounges.find(l => l.id.toString() === rawId || l.slug === rawId);

    if (!parentLounge) {
      return res.status(404).json({ error: 'Parent lounge not found.' });
    }

    const parentLoungeId = parentLounge.id;

    // Check if parent is user-created (not Velum official)
    if (parentLounge.isOfficial || parentLounge.isSystem) {
      return res.status(403).json({ error: 'Cannot create sublounges under Velum official lounges.' });
    }

    // Permission checks
    const isOwner = parentLounge.ownerId === currentUserId;
    const parentMembers = await db.select().from(loungeMembers).where(eq(loungeMembers.loungeId, parentLoungeId));
    const userMember = parentMembers.find(m => m.userId === currentUserId);

    // Check if user already created a sublounge in this lounge (if not owner)
    if (!isOwner) {
      const existingSublounges = allLounges.filter(l => l.parentLoungeId === parentLoungeId && l.ownerId === currentUserId);
      if (existingSublounges.length >= 1) {
        return res.status(403).json({ error: 'You can only create one sublounge in lounges you do not own.' });
      }
    }

    // Generate invite code only for private sublounges
    const isPrivate = Boolean(is_private);
    const inviteCode = isPrivate ? `VL/S-${Math.random().toString(36).substring(2, 6).toUpperCase()}` : null;
    const slug = `sublounge_${Date.now()}`;

    const [created] = await db.insert(lounges).values({
      slug,
      name: name.trim(),
      description: typeof description === 'string' ? description : null,
      ownerId: currentUserId,
      parentLoungeId: parentLoungeId,
      isPrivate,
      type: 'user_created',
      accessLevel: 'ALL',
      inviteCode
    }).returning();

    // Add creator as owner of sublounge
    await db.insert(loungeMembers).values({
      loungeId: created.id,
      userId: currentUserId,
      role: 'owner',
      status: 'active'
    });

    res.status(201).json({ sublounge: created });
  } catch (err) {
    next(err);
  }
});

// PUT /v2/lounges/:id/avatar - Update parent lounge avatar
loungeRouter.put('/:id/avatar', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { avatar_url } = req.body;
    const currentUserId = req.user!.userId;
    const rawId = req.params.id;

    if (!avatar_url || typeof avatar_url !== 'string') {
      return res.status(400).json({ error: 'Avatar URL is required.' });
    }

    const all = await db.select().from(lounges);
    const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

    if (!target) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    // Only allow owner to update avatar
    if (target.ownerId !== currentUserId) {
      return res.status(403).json({ error: 'Only lounge owner can update avatar.' });
    }

    // Don't allow avatar updates for sublounges
    if (target.parentLoungeId) {
      return res.status(403).json({ error: 'Avatar upload is only available for parent lounges.' });
    }

    await db.update(lounges).set({ avatarUrl: avatar_url }).where(eq(lounges.id, target.id));

    res.json({ success: true, message: 'Lounge avatar updated successfully.' });
  } catch (err) {
    next(err);
  }
});

// GET /v2/lounges/:id/messages - Get lounge chat messages
loungeRouter.get('/:id/messages', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const all = await db.select().from(lounges);
    const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

    if (!target) {
      return res.json({ messages: [] });
    }

    const currentUserId = req.user?.userId || null;
    const isDM = target.type === 'dm';

    const msgList = await db.select({
      id: messages.id,
      loungeId: messages.loungeId,
      senderId: messages.senderId,
      content: messages.content,
      createdAt: messages.createdAt,
      avatar: users.avatarUrl,
      senderName: users.username,
      deliveredTo: messages.deliveredTo,
      readBy: messages.readBy
    })
    .from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.loungeId, target.id))
    .orderBy(desc(messages.createdAt))
    .limit(100);

    const messagesWithStatus = msgList.reverse().map(m => {
      if (!isDM || !currentUserId) {
        return { ...m };
      }

      const deliveredTo = m.deliveredTo ? m.deliveredTo.split(',').map(Number).filter(id => !isNaN(id)) : [];
      const readBy = m.readBy ? m.readBy.split(',').map(Number).filter(id => !isNaN(id)) : [];
      let status = 'sent';

      if (m.senderId === currentUserId) {
        // Current user is sender
        if (readBy.length > 0) {
          status = 'read';
        } else if (deliveredTo.length > 0) {
          status = 'delivered';
        }
      } else {
        // Current user is receiver
        if (readBy.includes(currentUserId)) {
          status = 'read';
        } else if (deliveredTo.includes(currentUserId)) {
          status = 'delivered';
        }
      }

      return { ...m, status };
    });

    res.json({ messages: messagesWithStatus });
  } catch (err) {
    next(err);
  }
});

// POST /v2/lounges/:id/messages - Send message to lounge
loungeRouter.post('/:id/messages', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const { content } = req.body;
    const currentUserId = req.user!.userId;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }

    const all = await db.select().from(lounges);
    const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

    if (!target) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    if (target.accessLevel === 'ANNOUNCE' && req.user!.role !== 'ADMIN' && req.user!.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'Only administrators can post in Announcement channels.' });
    }

    if (target.accessLevel === 'EXEC_ONLY' && !['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Executive Lounge access restricted to system staff.' });
    }

    const [created] = await db.insert(messages).values({
      loungeId: target.id,
      senderId: currentUserId,
      content: content.trim()
    }).returning();

    res.status(201).json({ message: created });
  } catch (err) {
    next(err);
  }
});
