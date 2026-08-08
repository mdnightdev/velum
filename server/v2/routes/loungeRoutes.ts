import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db/client.js';
import { lounges, loungeMembers, messages } from '../db/schema/lounges.js';
import { users } from '../db/schema/users.js';
import { ensureVelumLoungeSeeded } from '../services/loungeSeeder.js';
import { deduplicateSublounges } from '../services/loungeDeduplicator.js';
import { eq, gt, and, desc, like, inArray } from 'drizzle-orm';
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

const SYSTEM_ADMIN_ROLES = ['ADMIN', 'CLI_ADMIN', 'LOGIN_ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN'];
const SYSTEM_ADMIN_USERNAMES = ['lexie', 'midnight'];

export function checkIsSystemAdmin(user?: { role?: string; username?: string }): boolean {
  if (!user) return false;
  if (user.role && SYSTEM_ADMIN_ROLES.includes(user.role)) return true;
  if (user.username && SYSTEM_ADMIN_USERNAMES.includes(user.username.toLowerCase())) return true;
  return false;
}

const OFFICIAL_SLUGS_ORDER = [
  'velum_general',
  'velum_market',
  'velum_escrow',
  'velum_offtopic',
  'velum_bugs',
  'velum_support',
  'velum_suggestions',
  'velum_events',
  'velum_announcements',
  'velum_executives'
];

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

// GET /v2/lounges/conversations/summary - Get latest message & unread counts per lounge for current user
loungeRouter.get('/conversations/summary', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.json({ summary: {}, unreadCounts: {} });
    }

    const allLounges = await db.select().from(lounges);
    const summary: Record<string, any> = {};
    const unreadCounts: Record<string, number> = {};

    for (const lounge of allLounges) {
      const roomId = lounge.slug || `lounge_${lounge.id}`;

      // Use cached last message details if available, otherwise fallback to finding the last message
      let lastMsg: any = null;
      if (lounge.lastMessageText !== null) {
        lastMsg = {
          content: lounge.lastMessageText,
          user_id: lounge.lastMessageSenderId,
          createdAt: lounge.lastMessageAt || new Date(),
          deliveredTo: '',
          readBy: '',
        };
      } else {
        const [foundMsg] = await db
          .select({
            message_id: messages.id,
            lounge_id: messages.loungeId,
            user_id: messages.senderId,
            content: messages.content,
            is_encrypted: messages.encrypted,
            deliveredTo: messages.deliveredTo,
            readBy: messages.readBy,
            createdAt: messages.createdAt,
            username: users.username,
            avatar: users.avatarUrl
          })
          .from(messages)
          .leftJoin(users, eq(messages.senderId, users.id))
          .where(eq(messages.loungeId, lounge.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);
        lastMsg = foundMsg;
      }

      const unreadMsgs = await db
        .select({
          id: messages.id,
          readBy: messages.readBy,
          senderId: messages.senderId
        })
        .from(messages)
        .where(eq(messages.loungeId, lounge.id));

      let unreadCount = 0;
      for (const m of unreadMsgs) {
        if (m.senderId !== currentUserId) {
          const readByArr = m.readBy ? m.readBy.split(',').map(Number).filter(id => !isNaN(id)) : [];
          if (!readByArr.includes(currentUserId)) {
            unreadCount++;
          }
        }
      }

      if (unreadCount > 0) {
        unreadCounts[roomId] = unreadCount;
      }

      if (lastMsg) {
        summary[roomId] = {
          message_id: lastMsg.message_id ? lastMsg.message_id.toString() : 'cached',
          room_id: roomId,
          lounge_id: lounge.id.toString(),
          user_id: lastMsg.user_id,
          username: lastMsg.username,
          avatar: lastMsg.avatar,
          content: lastMsg.content,
          is_encrypted: !!lastMsg.is_encrypted,
          deliveredTo: lastMsg.deliveredTo,
          readBy: lastMsg.readBy,
          created_at: lastMsg.createdAt ? new Date(lastMsg.createdAt).toISOString() : new Date().toISOString()
        };
      }
    }

    res.json({ summary, unreadCounts });
  } catch (err) {
    next(err);
  }
});

// GET /v2/lounges/link-preview - Scrape OpenGraph metadata for link preview cards
loungeRouter.get('/link-preview', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUrl = req.query.url ? String(req.query.url).trim() : '';
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid URL. Only http and https protocols are supported.' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch target URL. Status: ${response.status}` });
    }

    const html = await response.text();

    const getMetaTag = (htmlText: string, name: string): string => {
      const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
      const match = htmlText.match(regex);
      if (match) return match[1];

      const altRegex = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, 'i');
      const altMatch = htmlText.match(altRegex);
      if (altMatch) return altMatch[1];

      return '';
    };

    const getTitle = (htmlText: string): string => {
      const match = htmlText.match(/<title[^>]*>([^<]*)<\/title>/i);
      return match ? match[1] : '';
    };

    const title = getMetaTag(html, 'og:title') || getTitle(html) || new URL(targetUrl).hostname;
    const description = getMetaTag(html, 'og:description') || getMetaTag(html, 'description') || '';
    const image = getMetaTag(html, 'og:image') || '';

    res.json({
      url: targetUrl,
      title: title.trim(),
      description: description.trim(),
      image: image.trim()
    });
  } catch (err) {
    res.json({
      url: req.query.url ? String(req.query.url).trim() : '',
      title: req.query.url ? new URL(String(req.query.url)).hostname : 'Link',
      description: '',
      image: ''
    });
  }
});

// GET /v2/lounges - List all official lounges and top-level public lounges
loungeRouter.get('/', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user?.userId;
    const isAdmin = checkIsSystemAdmin(req.user);

    let userJoinedIds = new Set<number>();
    if (currentUserId) {
      const m = await db.select().from(loungeMembers).where(and(eq(loungeMembers.userId, currentUserId), eq(loungeMembers.status, 'active')));
      userJoinedIds = new Set(m.map(x => x.loungeId));
    }

    const allLounges = (await db.select().from(lounges)).filter(l => l.type !== 'dm');
    const parentLounges = allLounges.filter(l => !l.parentLoungeId);
    
    const searchQueryParam = (req.query.q || req.query.search || req.query.query || '').toString().trim().toLowerCase();

    const visibleParents = parentLounges.filter(parent => {
      if (searchQueryParam) {
        const nameMatch = (parent.name || '').toLowerCase().includes(searchQueryParam);
        const descMatch = (parent.description || '').toLowerCase().includes(searchQueryParam);
        const slugMatch = (parent.slug || '').toLowerCase().includes(searchQueryParam);
        if (!nameMatch && !descMatch && !slugMatch) return false;
      }

      if (!parent.isPrivate && !parent.isHidden) return true;
      if (isAdmin) return true;
      if (currentUserId) {
        if (parent.ownerId === currentUserId) return true;
        if (userJoinedIds.has(parent.id)) return true;
      }
      return false; // Private parent lounge is invisible to non-members
    });

    const formatted = visibleParents.map(parent => {
      const sublounges = allLounges.filter(l => l.parentLoungeId === parent.id);
      const visibleSublounges = sublounges.filter(sub => {
        if (!sub.isPrivate && !sub.isHidden) return true;
        if (isAdmin) return true;
        if (currentUserId) {
          if (sub.ownerId === currentUserId) return true;
          if (parent.ownerId === currentUserId) return true;
          if (userJoinedIds.has(sub.id)) return true;
        }
        return false; // Private sublounge is invisible to non-members
      });

      if (parent.slug === 'velum_master_lounge') {
        visibleSublounges.sort((a, b) => {
          const idxA = OFFICIAL_SLUGS_ORDER.indexOf(a.slug || '');
          const idxB = OFFICIAL_SLUGS_ORDER.indexOf(b.slug || '');
          const posA = idxA !== -1 ? idxA : 999;
          const posB = idxB !== -1 ? idxB : 999;
          return posA - posB;
        });
      }
      
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
    const isAdmin = checkIsSystemAdmin(req.user);
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
    const isAdmin = checkIsSystemAdmin(req.user);
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

    if (target.slug === 'velum_master_lounge') {
      visibleSublounges.sort((a, b) => {
        const idxA = OFFICIAL_SLUGS_ORDER.indexOf(a.slug || '');
        const idxB = OFFICIAL_SLUGS_ORDER.indexOf(b.slug || '');
        const posA = idxA !== -1 ? idxA : 999;
        const posB = idxB !== -1 ? idxB : 999;
        return posA - posB;
      });
    }

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
    const currentUserId = req.user?.userId;
    const isAdmin = checkIsSystemAdmin(req.user);

    const all = await db.select().from(lounges);
    const parent = all.find(l => l.slug === rawId || l.id.toString() === rawId);

    if (!parent) {
      return res.json({ rooms: [] });
    }

    let userJoinedSubIds = new Set<number>();
    if (currentUserId) {
      const m = await db.select().from(loungeMembers).where(and(eq(loungeMembers.userId, currentUserId), eq(loungeMembers.status, 'active')));
      userJoinedSubIds = new Set(m.map(x => x.loungeId));
    }

    const subs = all.filter(l => l.parentLoungeId === parent.id);

    // Filter sublounges: private sublounges are invisible to non-members
    const visibleSubs = subs.filter(sub => {
      if (!sub.isPrivate && !sub.isHidden) return true; // Public room is visible
      if (isAdmin) return true;
      if (currentUserId) {
        if (sub.ownerId === currentUserId) return true; // Creator of private sublounge
        if (parent.ownerId === currentUserId) return true; // Parent lounge owner
        if (userJoinedSubIds.has(sub.id)) return true; // Active member of this sublounge
      }
      return false; // Invisible to non-members
    });

    if (parent.slug === 'velum_master_lounge') {
      visibleSubs.sort((a, b) => {
        const idxA = OFFICIAL_SLUGS_ORDER.indexOf(a.slug || '');
        const idxB = OFFICIAL_SLUGS_ORDER.indexOf(b.slug || '');
        const posA = idxA !== -1 ? idxA : 999;
        const posB = idxB !== -1 ? idxB : 999;
        return posA - posB;
      });
    }

    const formattedRooms = visibleSubs.map(sub => ({
      id: sub.slug || `sub_${sub.id}`,
      lounge_id: parent.slug || `lounge_${parent.id}`,
      name: sub.name,
      topic: sub.description,
      is_locked: sub.accessLevel === 'ANNOUNCE' || sub.accessLevel === 'EXEC_ONLY',
      accessLevel: sub.accessLevel,
      type: sub.type,
      is_private: sub.isPrivate,
      invite_code: sub.inviteCode,
      owner_id: sub.ownerId
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

    const cleanName = name.trim();

    // Prevent duplicate top-level lounge creation by same user with same name
    const existing = await db.select().from(lounges);
    const dup = existing.find(
      l => !l.parentLoungeId &&
           l.ownerId === currentUserId &&
           l.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (dup) {
      return res.status(409).json({ error: `You already created a lounge named "${cleanName}".` });
    }

    const isPrivate = Boolean(is_private);
    const inviteCode = isPrivate ? `VL/M-${Math.random().toString(36).substring(2, 6).toUpperCase()}` : null;
    const slug = `lounge_${Date.now()}`;
    const [created] = await db.insert(lounges).values({
      slug,
      name: cleanName,
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

    // Check if parent is Velum official lounge
    const isSysAdmin = checkIsSystemAdmin(req.user);
    if (parentLounge.isOfficial || parentLounge.isSystem || parentLounge.slug === 'velum_master_lounge') {
      if (!isSysAdmin) {
        return res.status(403).json({ error: 'Sub-lounge creation under Velum Official Lounge is restricted exclusively to System Admins.' });
      }
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

    // Prevent duplicate sublounge/channel creation with the same name under this parent
    const cleanSubName = name.trim();
    const existingSameName = allLounges.find(
      l => l.parentLoungeId === parentLoungeId &&
           l.name.toLowerCase() === cleanSubName.toLowerCase()
    );
    if (existingSameName) {
      return res.status(409).json({ error: `A channel or room named "${cleanSubName}" already exists in this lounge.` });
    }

    // Generate invite code only for private sublounges
    const isPrivate = Boolean(is_private);
    const inviteCode = isPrivate ? `VL/S-${Math.random().toString(36).substring(2, 6).toUpperCase()}` : null;
    const slug = `sublounge_${Date.now()}`;

    const [created] = await db.insert(lounges).values({
      slug,
      name: cleanSubName,
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

// GET /v2/lounges/:id/search - Search messages in lounge or DM
loungeRouter.get('/:id/search', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const query = req.query.q ? String(req.query.q).trim() : '';
    if (!query) {
      return res.json({ messages: [] });
    }

    let targetLoungeId: number | null = null;
    if (rawId.startsWith('dm_')) {
      const [dmLounge] = await db.select().from(lounges).where(eq(lounges.slug, rawId)).limit(1);
      if (dmLounge) {
        targetLoungeId = dmLounge.id;
      }
    } else {
      const all = await db.select().from(lounges);
      const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);
      if (target) {
        targetLoungeId = target.id;
      }
    }

    if (!targetLoungeId) {
      return res.json({ messages: [] });
    }

    const msgList = await db.select({
      id: messages.id,
      loungeId: messages.loungeId,
      senderId: messages.senderId,
      content: messages.content,
      createdAt: messages.createdAt,
      avatar: users.avatarUrl,
      senderName: users.username,
      is_pinned: messages.isPinned,
      reply_to: messages.replyTo
    })
    .from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .where(and(
      eq(messages.loungeId, targetLoungeId),
      like(messages.content, `%${query}%`)
    ))
    .orderBy(desc(messages.createdAt))
    .limit(50);

    res.json({ messages: msgList });
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

    const since = req.query.since ? new Date(req.query.since as string) : null;
    const whereClause = since && !isNaN(since.getTime())
      ? and(eq(messages.loungeId, target.id), gt(messages.createdAt, since))
      : eq(messages.loungeId, target.id);

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
    .where(whereClause)
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

    const [created] = await db.transaction(async (tx) => {
      const [msg] = await tx.insert(messages).values({
        loungeId: target.id,
        senderId: currentUserId,
        content: content.trim()
      }).returning();
      
      await tx.update(lounges)
        .set({
          lastMessageAt: msg.createdAt,
          lastMessageText: msg.content,
          lastMessageSenderId: msg.senderId,
          updatedAt: msg.createdAt
        })
        .where(eq(lounges.id, target.id));
        
      return [msg];
    });

    res.status(201).json({ message: created });
  } catch (err) {
    next(err);
  }
});

loungeRouter.get('/:loungeId/invites', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.loungeId;
    const currentUserId = req.user!.userId;
    const isAdmin = ['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'].includes(req.user!.role);

    const all = await db.select().from(lounges);
    const lounge = all.find(l => l.slug === rawId || l.id.toString() === rawId);
    if (!lounge) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    if (lounge.parentLoungeId && lounge.isPrivate) {
      if (lounge.ownerId !== currentUserId && !isAdmin) {
        return res.status(403).json({ error: 'Only the creator of this private room can view invite links.' });
      }
    }

    if (lounge.inviteCode) {
      return res.json([{
        invite_id: 'code',
        invite_code: lounge.inviteCode,
        created_at: lounge.createdAt.toISOString()
      }]);
    }
    res.json([]);
  } catch (err) {
    next(err);
  }
});

loungeRouter.post('/:loungeId/invites', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.loungeId;
    const currentUserId = req.user!.userId;
    const isAdmin = ['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'].includes(req.user!.role);

    const all = await db.select().from(lounges);
    const lounge = all.find(l => l.slug === rawId || l.id.toString() === rawId);
    if (!lounge) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    if (lounge.parentLoungeId && lounge.isPrivate) {
      if (lounge.ownerId !== currentUserId && !isAdmin) {
        return res.status(403).json({ error: 'Only the creator of this private room can generate invite links.' });
      }
    }

    let code = lounge.inviteCode;
    if (!code) {
      const prefix = lounge.parentLoungeId ? 'VL/S' : 'VL/M';
      code = `${prefix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      await db.update(lounges).set({ inviteCode: code }).where(eq(lounges.id, lounge.id));
    }
    res.json({
      invite_id: 'code',
      invite_code: code,
      created_at: lounge.createdAt.toISOString()
    });
  } catch (err) {
    next(err);
  }
});

loungeRouter.delete('/:loungeId/invites/:inviteId', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.loungeId;
    const all = await db.select().from(lounges);
    const lounge = all.find(l => l.slug === rawId || l.id.toString() === rawId);
    if (!lounge) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }
    await db.update(lounges).set({ inviteCode: null }).where(eq(lounges.id, lounge.id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /v2/lounges/:id/requests - Get pending join requests
loungeRouter.get('/:id/requests', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const all = await db.select().from(lounges);
    const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

    if (!target) {
      return res.json({ requests: [] });
    }

    const pendingMembers = await db.select({
      id: loungeMembers.id,
      user_id: loungeMembers.userId,
      role: loungeMembers.role,
      status: loungeMembers.status,
      username: users.username,
      avatar: users.avatarUrl
    })
    .from(loungeMembers)
    .leftJoin(users, eq(loungeMembers.userId, users.id))
    .where(and(
      eq(loungeMembers.loungeId, target.id),
      eq(loungeMembers.status, 'pending')
    ));

    const requests = pendingMembers.map(m => ({
      requestId: m.id.toString(),
      userId: m.user_id,
      username: m.username || `User_${m.user_id}`,
      avatar: m.avatar,
      createdAt: new Date().toISOString()
    }));

    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

// POST /v2/lounges/apply/review - Review join request
loungeRouter.post('/apply/review', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { requestId, approve } = req.body;

    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required.' });
    }

    const memberId = parseInt(requestId, 10);
    if (isNaN(memberId)) {
      return res.status(400).json({ error: 'Invalid Request ID.' });
    }

    if (approve) {
      await db.update(loungeMembers)
        .set({ status: 'active' })
        .where(eq(loungeMembers.id, memberId));
    } else {
      await db.delete(loungeMembers)
        .where(eq(loungeMembers.id, memberId));
    }

    res.json({ success: true, approved: Boolean(approve) });
  } catch (err) {
    next(err);
  }
});

// PUT /v2/lounges/:id/members/:targetUserId - Update member role
loungeRouter.put('/:id/members/:targetUserId', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const targetUserId = parseInt(req.params.targetUserId, 10);
    const { role } = req.body;
    const currentUserId = req.user!.userId;

    if (isNaN(targetUserId) || !role) {
      return res.status(400).json({ error: 'Valid target user ID and role are required.' });
    }

    const all = await db.select().from(lounges);
    const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

    if (!target) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    const isAdmin = ['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'].includes(req.user!.role);
    if (target.ownerId !== currentUserId && !isAdmin) {
      return res.status(403).json({ error: 'Only lounge owner can modify member roles.' });
    }

    await db.update(loungeMembers)
      .set({ role })
      .where(and(
        eq(loungeMembers.loungeId, target.id),
        eq(loungeMembers.userId, targetUserId)
      ));

    res.json({ success: true, message: 'Member role updated.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /v2/lounges/:id/members/:targetUserId - Kick/Remove member
loungeRouter.delete('/:id/members/:targetUserId', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const targetUserId = parseInt(req.params.targetUserId, 10);
    const currentUserId = req.user!.userId;

    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Valid target user ID is required.' });
    }

    const all = await db.select().from(lounges);
    const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

    if (!target) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    const isAdmin = ['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'].includes(req.user!.role);
    if (target.ownerId !== currentUserId && targetUserId !== currentUserId && !isAdmin) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    await db.delete(loungeMembers)
      .where(and(
        eq(loungeMembers.loungeId, target.id),
        eq(loungeMembers.userId, targetUserId)
      ));

    res.json({ success: true, message: 'Member removed from lounge.' });
  } catch (err) {
    next(err);
  }
});

// POST /v2/lounges/sanction - Sanction member (kick, ban, mute)
loungeRouter.post('/sanction', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { loungeId, targetUserId, type } = req.body;
    const currentUserId = req.user!.userId;

    if (!loungeId || !targetUserId || !type) {
      return res.status(400).json({ error: 'loungeId, targetUserId, and type are required.' });
    }

    const all = await db.select().from(lounges);
    const target = all.find(l => l.slug === loungeId || l.id.toString() === loungeId.toString());

    if (!target) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    const isAdmin = ['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'].includes(req.user!.role);
    if (target.ownerId !== currentUserId && !isAdmin) {
      return res.status(403).json({ error: 'Only lounge owners or admins can apply sanctions.' });
    }

    const numTargetId = parseInt(targetUserId, 10);

    if (type === 'kick') {
      await db.delete(loungeMembers)
        .where(and(
          eq(loungeMembers.loungeId, target.id),
          eq(loungeMembers.userId, numTargetId)
        ));
    } else if (type === 'ban' || type === 'mute') {
      await db.update(loungeMembers)
        .set({ status: type === 'ban' ? 'banned' : 'muted' })
        .where(and(
          eq(loungeMembers.loungeId, target.id),
          eq(loungeMembers.userId, numTargetId)
        ));
    }

    res.json({ success: true, message: `Sanction "${type}" applied successfully.` });
  } catch (err) {
    next(err);
  }
});

// POST /v2/lounges/:id/members/add - Direct add member by username
loungeRouter.post('/:id/members/add', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const { username } = req.body;
    const currentUserId = req.user!.userId;

    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    const all = await db.select().from(lounges);
    const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

    if (!target) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    const isAdmin = ['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'].includes(req.user!.role);
    if (target.ownerId !== currentUserId && !isAdmin) {
      return res.status(403).json({ error: 'Only lounge owner or admins can add members directly.' });
    }

    const cleanUsername = username.trim().replace(/^@/, '');
    const targetUser = await userRepository.findByUsername(cleanUsername);

    if (!targetUser) {
      return res.status(404).json({ error: `User "@${cleanUsername}" not found.` });
    }

    const existing = await db.select().from(loungeMembers)
      .where(and(
        eq(loungeMembers.loungeId, target.id),
        eq(loungeMembers.userId, targetUser.id)
      ));

    if (existing.length === 0) {
      await db.insert(loungeMembers).values({
        loungeId: target.id,
        userId: targetUser.id,
        role: 'member',
        status: 'active'
      });
    }

    res.json({ success: true, message: `Added @${cleanUsername} to ${target.name}` });
  } catch (err) {
    next(err);
  }
});

// POST /v2/lounges/:loungeId/rooms/:roomId/join - Join room
loungeRouter.post('/:loungeId/rooms/:roomId/join', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const { invite_code } = req.body || {};
    const currentUserId = req.user!.userId;

    const all = await db.select().from(lounges);
    const target = all.find(l => l.slug === roomId || l.id.toString() === roomId || (invite_code && l.inviteCode === invite_code));

    if (!target) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    if (target.isPrivate && target.inviteCode && target.inviteCode !== invite_code && target.ownerId !== currentUserId) {
      return res.status(403).json({ error: 'Invalid invite code for private room.' });
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

    res.json({ success: true, message: `Joined room ${target.name}`, room: target });
  } catch (err) {
    next(err);
  }
});

// PUT /v2/lounges/:id - Update lounge settings (name, description, avatar)
loungeRouter.put('/:id', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const { name, description, icon_url, is_private } = req.body;
    const currentUserId = req.user!.userId;

    const all = await db.select().from(lounges);
    const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

    if (!target) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    const isAdmin = checkIsSystemAdmin(req.user);
    if (target.ownerId !== currentUserId && !isAdmin) {
      return res.status(403).json({ error: 'Only lounge owner or admins can update settings.' });
    }

    const updates: Record<string, any> = {
      updatedAt: new Date()
    };

    if (name && typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }
    if (description !== undefined) {
      updates.description = typeof description === 'string' ? description.trim() : null;
    }
    const iconVal = icon_url !== undefined ? icon_url : req.body.avatar_url;
    if (iconVal !== undefined) {
      updates.avatarUrl = typeof iconVal === 'string' ? iconVal.trim() : null;
    }
    if (is_private !== undefined) {
      updates.isPrivate = Boolean(is_private);
    }

    const [updated] = await db.update(lounges)
      .set(updates)
      .where(eq(lounges.id, target.id))
      .returning();

    res.json({
      ...updated,
      lounge_id: updated.slug || `lounge_${updated.id}`,
      is_official: updated.isOfficial,
      is_private: updated.isPrivate,
      avatar_url: updated.avatarUrl
    });
  } catch (err) {
    next(err);
  }
});

// POST /v2/lounges/:id/apply - Apply to join a private lounge or sublounge (Telegram style)
loungeRouter.post('/:id/apply', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const currentUserId = req.user!.userId;

    const all = await db.select().from(lounges);
    const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

    if (!target) {
      return res.status(404).json({ error: 'Lounge or room not found.' });
    }

    // Restrict applications for private sublounges (joining is by creator's invite code/link only)
    if (target.parentLoungeId && target.isPrivate) {
      return res.status(403).json({
        error: 'Applications are restricted for this private room. Joining requires an invite link or code shared directly by the room creator.'
      });
    }

    const existing = await db.select().from(loungeMembers)
      .where(and(eq(loungeMembers.loungeId, target.id), eq(loungeMembers.userId, currentUserId)));

    if (existing.length > 0) {
      const member = existing[0];
      if (member.status === 'active') {
        return res.json({ success: true, status: 'active', message: 'You are already a member.' });
      }
      if (member.status === 'pending') {
        return res.json({ success: true, status: 'pending', message: 'Your application is pending review.' });
      }
    }

    await db.insert(loungeMembers).values({
      loungeId: target.id,
      userId: currentUserId,
      role: 'member',
      status: 'pending'
    });

    res.json({
      success: true,
      status: 'pending',
      message: 'Join application submitted successfully! Awaiting approval.'
    });
  } catch (err) {
    next(err);
  }
});

// POST /v2/lounges/deduplicate - Run self-healing deduplication for duplicate sublounges/lounges
loungeRouter.post('/deduplicate', auth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deduplicateSublounges();
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// DELETE /v2/lounges/:id - Delete lounge or sublounge with cascade
loungeRouter.delete('/:id', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const currentUserId = req.user!.userId;
    const isAdmin = checkIsSystemAdmin(req.user);

    const all = await db.select().from(lounges);
    const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

    if (!target) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    if ((target.isOfficial || target.isSystem || target.slug === 'velum_master_lounge') && !isAdmin) {
      return res.status(403).json({ error: 'Official Velum lounges cannot be deleted.' });
    }

    let canDelete = false;
    if (isAdmin || target.ownerId === currentUserId) {
      canDelete = true;
    } else if (target.parentLoungeId) {
      const parentLounge = all.find(l => l.id === target.parentLoungeId);
      if (parentLounge && parentLounge.ownerId === currentUserId) {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return res.status(403).json({ error: 'You do not have permission to delete this lounge.' });
    }

    // Collect target ID and all child sublounge IDs
    const childSubs = all.filter(l => l.parentLoungeId === target.id);
    const targetIds = [target.id, ...childSubs.map(s => s.id)];

    // Cascade delete messages, members, and lounges
    await db.delete(messages).where(inArray(messages.loungeId, targetIds));
    await db.delete(loungeMembers).where(inArray(loungeMembers.loungeId, targetIds));
    await db.delete(lounges).where(inArray(lounges.id, targetIds));

    res.json({ success: true, message: `Lounge "${target.name}" and all associated channels were deleted successfully.` });
  } catch (err) {
    next(err);
  }
});
