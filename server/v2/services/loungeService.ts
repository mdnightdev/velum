import { db } from '../db/client.js';
import { lounges, loungeMembers, messages } from '../db/schema/lounges.js';
import { loungeMuteSettings } from '../db/schema/lounge_mutes.js';
import { userReadCursors } from '../db/schema/read_cursors.js';
import { users } from '../db/schema/users.js';
import { userRepository } from '../repositories/userRepository.js';
import { eq, gt, and, desc, like, inArray, sql } from 'drizzle-orm';

export const SYSTEM_ADMIN_ROLES = ['ADMIN', 'CLI_ADMIN', 'LOGIN_ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN'];
export const SYSTEM_ADMIN_USERNAMES = ['lexie', 'midnight'];

export function checkIsSystemAdmin(user?: { role?: string; username?: string }): boolean {
  if (!user) return false;
  if (user.role && SYSTEM_ADMIN_ROLES.includes(user.role)) return true;
  if (user.username && SYSTEM_ADMIN_USERNAMES.includes(user.username.toLowerCase())) return true;
  return false;
}

export const OFFICIAL_SLUGS_ORDER = [
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

export async function getConversationsSummary(currentUserId?: number) {
  if (!currentUserId) {
    return { summary: {}, unreadCounts: {} };
  }

  const allLounges = await db.select().from(lounges);
  const summary: Record<string, any> = {};
  const unreadCounts: Record<string, number> = {};

  for (const lounge of allLounges) {
    const roomId = lounge.slug || `lounge_${lounge.id}`;

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

  return { summary, unreadCounts };
}

export async function getUnreadSequenceCounts(currentUserId: number) {
  const allLounges = await db.select().from(lounges);
  const readCursors = await db.select()
    .from(userReadCursors)
    .where(eq(userReadCursors.userId, currentUserId));

  const cursorMap = new Map<number, number>();
  for (const rc of readCursors) {
    cursorMap.set(rc.loungeId, rc.lastReadSeq || 0);
  }

  const unreadCounts: Record<string, number> = {};
  for (const lounge of allLounges) {
    const roomId = lounge.slug || `lounge_${lounge.id}`;
    const lastSeq = lounge.currentSequenceId || 0;
    const readSeq = cursorMap.get(lounge.id) || 0;
    const unread = Math.max(0, lastSeq - readSeq);
    if (unread > 0) {
      unreadCounts[roomId] = unread;
    }
  }

  return unreadCounts;
}

export async function getMuteRule(currentUserId: number, rawId: string) {
  const all = await db.select().from(lounges);
  const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

  if (!target) {
    return { error: 'Lounge not found.', status: 404 };
  }

  const [setting] = await db.select()
    .from(loungeMuteSettings)
    .where(and(eq(loungeMuteSettings.userId, currentUserId), eq(loungeMuteSettings.loungeId, target.id)))
    .limit(1);

  return { mute_rule: setting ? setting.muteRule : 'off' };
}

export async function setMuteRule(currentUserId: number, rawId: string, muteRule: string) {
  if (!['off', 'mentions_only', 'forever'].includes(muteRule)) {
    return { error: 'Invalid mute rule. Allowed: off, mentions_only, forever', status: 400 };
  }

  const all = await db.select().from(lounges);
  const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

  if (!target) {
    return { error: 'Lounge not found.', status: 404 };
  }

  await db.insert(loungeMuteSettings)
    .values({
      userId: currentUserId,
      loungeId: target.id,
      muteRule,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: [loungeMuteSettings.userId, loungeMuteSettings.loungeId],
      set: {
        muteRule,
        updatedAt: new Date()
      }
    });

  return { success: true, mute_rule: muteRule };
}

export async function listLounges(user?: any, searchQuery = '') {
  const currentUserId = user?.userId;
  const isAdmin = checkIsSystemAdmin(user);

  let userJoinedIds = new Set<number>();
  if (currentUserId) {
    const m = await db.select().from(loungeMembers).where(and(eq(loungeMembers.userId, currentUserId), eq(loungeMembers.status, 'active')));
    userJoinedIds = new Set(m.map(x => x.loungeId));
  }

  const allLounges = (await db.select().from(lounges)).filter(l => l.type !== 'dm');
  const parentLounges = allLounges.filter(l => !l.parentLoungeId);

  const visibleParents = parentLounges.filter(parent => {
    if (searchQuery) {
      const nameMatch = (parent.name || '').toLowerCase().includes(searchQuery);
      const descMatch = (parent.description || '').toLowerCase().includes(searchQuery);
      const slugMatch = (parent.slug || '').toLowerCase().includes(searchQuery);
      if (!nameMatch && !descMatch && !slugMatch) return false;
    }

    if (!parent.isPrivate && !parent.isHidden) return true;
    if (isAdmin) return true;
    if (currentUserId) {
      if (parent.ownerId === currentUserId) return true;
      if (userJoinedIds.has(parent.id)) return true;
    }
    return false;
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
      return false;
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

  return { lounges: formatted };
}

export async function getUserLounges(user?: any) {
  const currentUserId = user?.userId;
  const isAdmin = checkIsSystemAdmin(user);
  const allLounges = (await db.select().from(lounges)).filter(l => l.type !== 'dm');
  
  if (!currentUserId) {
    const publicLounges = allLounges.filter(l => !l.isPrivate && !l.isHidden);
    return { lounges: publicLounges };
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

  return { lounges: userLounges };
}

export async function getLoungeDetails(rawId: string, user?: any) {
  const isAdmin = checkIsSystemAdmin(user);
  const all = await db.select().from(lounges);
  const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

  if (!target) {
    return { error: `Lounge "${rawId}" not found.`, status: 404 };
  }

  if (target.isHidden && !isAdmin) {
    return { error: `Lounge "${rawId}" not found.`, status: 404 };
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

  return {
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
  };
}

export async function getLoungeRooms(rawId: string, user?: any) {
  const currentUserId = user?.userId;
  const isAdmin = checkIsSystemAdmin(user);

  const all = await db.select().from(lounges);
  const parent = all.find(l => l.slug === rawId || l.id.toString() === rawId);

  if (!parent) {
    return { rooms: [] };
  }

  let userJoinedSubIds = new Set<number>();
  if (currentUserId) {
    const m = await db.select().from(loungeMembers).where(and(eq(loungeMembers.userId, currentUserId), eq(loungeMembers.status, 'active')));
    userJoinedSubIds = new Set(m.map(x => x.loungeId));
  }

  const subs = all.filter(l => l.parentLoungeId === parent.id);

  const visibleSubs = subs.filter(sub => {
    if (!sub.isPrivate && !sub.isHidden) return true;
    if (isAdmin) return true;
    if (currentUserId) {
      if (sub.ownerId === currentUserId) return true;
      if (parent.ownerId === currentUserId) return true;
      if (userJoinedSubIds.has(sub.id)) return true;
    }
    return false;
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

  return { rooms: formattedRooms };
}

export async function getLoungeMembersList(rawId: string) {
  const all = await db.select().from(lounges);
  const parent = all.find(l => l.slug === rawId || l.id.toString() === rawId);

  if (!parent) {
    return { members: [] };
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

  return { members: memberList };
}

export async function joinLounge(currentUserId: number, loungeId?: string, inviteCode?: string) {
  const all = await db.select().from(lounges);
  let target;

  if (inviteCode) {
    target = all.find(l => l.inviteCode === inviteCode);
  } else {
    target = all.find(l => (l.slug === loungeId || l.id.toString() === loungeId) && l.isPrivate !== true);
  }

  if (!target) {
    return { error: 'Lounge not found.', status: 404 };
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

  return { success: true, message: `Successfully joined ${target.name}`, lounge: target };
}

export async function createLounge(currentUserId: number, name: string, description?: string, isPrivate?: boolean, iconUrl?: string) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { error: 'Lounge name is required.', status: 400 };
  }

  const cleanName = name.trim();

  const existing = await db.select().from(lounges);
  const dup = existing.find(
    l => !l.parentLoungeId &&
         l.ownerId === currentUserId &&
         l.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (dup) {
    return { error: `You already created a lounge named "${cleanName}".`, status: 409 };
  }

  const privateFlag = Boolean(isPrivate);
  const inviteCode = privateFlag ? `VL/M-${Math.random().toString(36).substring(2, 6).toUpperCase()}` : null;
  const slug = `lounge_${Date.now()}`;
  const [created] = await db.insert(lounges).values({
    slug,
    name: cleanName,
    description: typeof description === 'string' ? description : null,
    ownerId: currentUserId,
    isPrivate: privateFlag,
    type: 'user_created',
    accessLevel: 'ALL',
    inviteCode,
    avatarUrl: typeof iconUrl === 'string' ? iconUrl : null
  }).returning();

  await db.insert(loungeMembers).values({
    loungeId: created.id,
    userId: currentUserId,
    role: 'owner',
    status: 'active'
  });

  return { lounge: created };
}

export async function createSublounge(user: any, rawId: string, name: string, description?: string, isPrivate?: boolean) {
  const currentUserId = user.userId;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { error: 'Sublounge name is required.', status: 400 };
  }

  const allLounges = await db.select().from(lounges);
  const parentLounge = allLounges.find(l => l.id.toString() === rawId || l.slug === rawId);

  if (!parentLounge) {
    return { error: 'Parent lounge not found.', status: 404 };
  }

  const parentLoungeId = parentLounge.id;

  const isSysAdmin = checkIsSystemAdmin(user);
  if (parentLounge.isOfficial || parentLounge.isSystem || parentLounge.slug === 'velum_master_lounge') {
    if (!isSysAdmin) {
      return { error: 'Sub-lounge creation under Velum Official Lounge is restricted exclusively to System Admins.', status: 403 };
    }
  }

  const isOwner = parentLounge.ownerId === currentUserId;
  if (!isOwner) {
    const existingSublounges = allLounges.filter(l => l.parentLoungeId === parentLoungeId && l.ownerId === currentUserId);
    if (existingSublounges.length >= 1) {
      return { error: 'You can only create one sublounge in lounges you do not own.', status: 403 };
    }
  }

  const cleanSubName = name.trim();
  const existingSameName = allLounges.find(
    l => l.parentLoungeId === parentLoungeId &&
         l.name.toLowerCase() === cleanSubName.toLowerCase()
  );
  if (existingSameName) {
    return { error: `A channel or room named "${cleanSubName}" already exists in this lounge.`, status: 409 };
  }

  const privateFlag = Boolean(isPrivate);
  const inviteCode = privateFlag ? `VL/S-${Math.random().toString(36).substring(2, 6).toUpperCase()}` : null;
  const slug = `sublounge_${Date.now()}`;

  const [created] = await db.insert(lounges).values({
    slug,
    name: cleanSubName,
    description: typeof description === 'string' ? description : null,
    ownerId: currentUserId,
    parentLoungeId: parentLoungeId,
    isPrivate: privateFlag,
    type: 'user_created',
    accessLevel: 'ALL',
    inviteCode
  }).returning();

  await db.insert(loungeMembers).values({
    loungeId: created.id,
    userId: currentUserId,
    role: 'owner',
    status: 'active'
  });

  return { sublounge: created };
}

export async function updateLoungeAvatar(currentUserId: number, rawId: string, avatarUrl: string) {
  if (!avatarUrl || typeof avatarUrl !== 'string') {
    return { error: 'Avatar URL is required.', status: 400 };
  }

  const all = await db.select().from(lounges);
  const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

  if (!target) {
    return { error: 'Lounge not found.', status: 404 };
  }

  if (target.ownerId !== currentUserId) {
    return { error: 'Only lounge owner can update avatar.', status: 403 };
  }

  if (target.parentLoungeId) {
    return { error: 'Avatar upload is only available for parent lounges.', status: 403 };
  }

  await db.update(lounges).set({ avatarUrl }).where(eq(lounges.id, target.id));

  return { success: true, message: 'Lounge avatar updated successfully.' };
}

export async function searchLoungeMessages(rawId: string, query: string) {
  if (!query) {
    return { messages: [] };
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
    return { messages: [] };
  }

  const msgList = await db.select({
    id: messages.id,
    loungeId: messages.loungeId,
    senderId: messages.senderId,
    content: messages.content,
    createdAt: messages.createdAt,
    avatar: users.avatarUrl,
    username: users.username,
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

  return { messages: msgList };
}

export async function syncLoungeMessages(rawId: string, sinceSeq: number, limit: number) {
  const all = await db.select().from(lounges);
  const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

  if (!target) {
    return { room_id: rawId, lounge_id: null, messages: [], max_seq: 0 };
  }

  const syncMsgs = await db.select({
    id: messages.id,
    loungeId: messages.loungeId,
    senderId: messages.senderId,
    content: messages.content,
    clientMsgId: messages.clientMsgId,
    sequenceId: messages.sequenceId,
    createdAt: messages.createdAt,
    avatar: users.avatarUrl,
    username: users.username,
    deliveredTo: messages.deliveredTo,
    readBy: messages.readBy
  })
  .from(messages)
  .leftJoin(users, eq(messages.senderId, users.id))
  .where(and(eq(messages.loungeId, target.id), gt(messages.sequenceId, isNaN(sinceSeq) ? 0 : sinceSeq)))
  .orderBy(messages.sequenceId)
  .limit(limit);

  const formatted = syncMsgs.map(m => ({
    message_id: String(m.id),
    db_message_id: m.id,
    room_id: rawId,
    lounge_id: String(target.id),
    user_id: m.senderId,
    username: m.username || `User_${m.senderId}`,
    avatar: m.avatar || '',
    content: m.content,
    sequence_id: m.sequenceId,
    client_msg_id: m.clientMsgId,
    created_at: m.createdAt,
    timestamp: m.createdAt
  }));

  return {
    room_id: rawId,
    lounge_id: target.id,
    messages: formatted,
    max_seq: target.currentSequenceId
  };
}

export async function getLoungeMessages(rawId: string, currentUserId: number | null, since?: Date | null) {
  const all = await db.select().from(lounges);
  const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

  if (!target) {
    return { messages: [] };
  }

  const isDM = target.type === 'dm';
  const whereClause = since && !isNaN(since.getTime())
    ? and(eq(messages.loungeId, target.id), gt(messages.createdAt, since))
    : eq(messages.loungeId, target.id);

  const msgList = await db.select({
    id: messages.id,
    loungeId: messages.loungeId,
    senderId: messages.senderId,
    content: messages.content,
    clientMsgId: messages.clientMsgId,
    sequenceId: messages.sequenceId,
    createdAt: messages.createdAt,
    avatar: users.avatarUrl,
    username: users.username,
    deliveredTo: messages.deliveredTo,
    readBy: messages.readBy
  })
  .from(messages)
  .leftJoin(users, eq(messages.senderId, users.id))
  .where(whereClause)
  .orderBy(desc(messages.createdAt))
  .limit(100);

  const messagesWithStatus = msgList.reverse().map(m => {
    let status = 'sent';
    if (isDM && currentUserId) {
      const deliveredTo = m.deliveredTo ? m.deliveredTo.split(',').map(Number).filter(id => !isNaN(id)) : [];
      const readBy = m.readBy ? m.readBy.split(',').map(Number).filter(id => !isNaN(id)) : [];

      if (m.senderId === currentUserId) {
        if (readBy.length > 0) {
          status = 'read';
        } else if (deliveredTo.length > 0) {
          status = 'delivered';
        }
      } else {
        if (readBy.includes(currentUserId)) {
          status = 'read';
        } else if (deliveredTo.includes(currentUserId)) {
          status = 'delivered';
        }
      }
    }

    const isoCreatedAt = m.createdAt instanceof Date ? m.createdAt.toISOString() : (m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString());
    return {
      ...m,
      message_id: String(m.id),
      db_message_id: m.id,
      sequence_id: m.sequenceId,
      client_msg_id: m.clientMsgId,
      createdAt: isoCreatedAt,
      timestamp: isoCreatedAt,
      status: isDM ? status : undefined
    };
  });

  return { messages: messagesWithStatus };
}

export async function postLoungeMessage(user: any, rawId: string, content: string, clientMsgId?: string | null) {
  const currentUserId = user.userId;
  if (!content || typeof content !== 'string' || !content.trim()) {
    return { error: 'Message content cannot be empty.', status: 400 };
  }

  const all = await db.select().from(lounges);
  const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

  if (!target) {
    return { error: 'Lounge not found.', status: 404 };
  }

  if (target.accessLevel === 'ANNOUNCE' && user.role !== 'ADMIN' && user.role !== 'CLI_ADMIN') {
    return { error: 'Only administrators can post in Announcement channels.', status: 403 };
  }

  if (target.accessLevel === 'EXEC_ONLY' && !['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'].includes(user.role)) {
    return { error: 'Executive Lounge access restricted to system staff.', status: 403 };
  }

  if (clientMsgId) {
    const existing = await db.select()
      .from(messages)
      .where(and(eq(messages.senderId, currentUserId), eq(messages.clientMsgId, clientMsgId)))
      .limit(1);

    if (existing.length > 0) {
      return {
        message: {
          ...existing[0],
          message_id: String(existing[0].id),
          db_message_id: existing[0].id,
          sequence_id: existing[0].sequenceId,
          client_msg_id: existing[0].clientMsgId
        },
        deduplicated: true
      };
    }
  }

  const [created] = await db.transaction(async (tx) => {
    const [updatedLounge] = await tx.update(lounges)
      .set({
        currentSequenceId: sql`${lounges.currentSequenceId} + 1`,
        lastMessageAt: new Date(),
        lastMessageText: content.trim(),
        lastMessageSenderId: currentUserId,
        updatedAt: new Date()
      })
      .where(eq(lounges.id, target.id))
      .returning({ currentSequenceId: lounges.currentSequenceId });

    const nextSeq = updatedLounge ? updatedLounge.currentSequenceId : 1;

    const [msg] = await tx.insert(messages).values({
      loungeId: target.id,
      senderId: currentUserId,
      content: content.trim(),
      clientMsgId: clientMsgId,
      sequenceId: nextSeq
    }).returning();
      
    return [msg];
  });

  return {
    message: {
      ...created,
      message_id: String(created.id),
      db_message_id: created.id,
      sequence_id: created.sequenceId,
      client_msg_id: created.clientMsgId
    }
  };
}

export async function getLoungeInvites(rawId: string, user: any) {
  const currentUserId = user.userId;
  const isAdmin = ['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'].includes(user.role);

  const all = await db.select().from(lounges);
  const lounge = all.find(l => l.slug === rawId || l.id.toString() === rawId);
  if (!lounge) {
    return { error: 'Lounge not found.', status: 404 };
  }

  if (lounge.parentLoungeId && lounge.isPrivate) {
    if (lounge.ownerId !== currentUserId && !isAdmin) {
      return { error: 'Only the creator of this private room can view invite links.', status: 403 };
    }
  }

  if (lounge.inviteCode) {
    return [{
      invite_id: 'code',
      invite_code: lounge.inviteCode,
      created_at: lounge.createdAt.toISOString()
    }];
  }
  return [];
}

export async function createLoungeInvite(rawId: string, user: any) {
  const currentUserId = user.userId;
  const isAdmin = ['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'].includes(user.role);

  const all = await db.select().from(lounges);
  const lounge = all.find(l => l.slug === rawId || l.id.toString() === rawId);
  if (!lounge) {
    return { error: 'Lounge not found.', status: 404 };
  }

  if (lounge.parentLoungeId && lounge.isPrivate) {
    if (lounge.ownerId !== currentUserId && !isAdmin) {
      return { error: 'Only the creator of this private room can generate invite links.', status: 403 };
    }
  }

  let code = lounge.inviteCode;
  if (!code) {
    const prefix = lounge.parentLoungeId ? 'VL/S' : 'VL/M';
    code = `${prefix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    await db.update(lounges).set({ inviteCode: code }).where(eq(lounges.id, lounge.id));
  }
  return {
    invite_id: 'code',
    invite_code: code,
    created_at: lounge.createdAt.toISOString()
  };
}

export async function deleteLoungeInvite(rawId: string) {
  const all = await db.select().from(lounges);
  const lounge = all.find(l => l.slug === rawId || l.id.toString() === rawId);
  if (!lounge) {
    return { error: 'Lounge not found.', status: 404 };
  }
  await db.update(lounges).set({ inviteCode: null }).where(eq(lounges.id, lounge.id));
  return { success: true };
}

export async function getJoinRequests(rawId: string) {
  const all = await db.select().from(lounges);
  const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

  if (!target) {
    return { requests: [] };
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

  return { requests };
}

export async function reviewJoinRequest(requestId: string, approve: boolean) {
  if (!requestId) {
    return { error: 'Request ID is required.', status: 400 };
  }

  const memberId = parseInt(requestId, 10);
  if (isNaN(memberId)) {
    return { error: 'Invalid Request ID.', status: 400 };
  }

  if (approve) {
    await db.update(loungeMembers)
      .set({ status: 'active' })
      .where(eq(loungeMembers.id, memberId));
  } else {
    await db.delete(loungeMembers)
      .where(eq(loungeMembers.id, memberId));
  }

  return { success: true, approved: Boolean(approve) };
}

export async function updateMemberRole(user: any, rawId: string, targetUserId: number, role: string) {
  if (isNaN(targetUserId) || !role) {
    return { error: 'Valid target user ID and role are required.', status: 400 };
  }

  const all = await db.select().from(lounges);
  const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

  if (!target) {
    return { error: 'Lounge not found.', status: 404 };
  }

  const isAdmin = ['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'].includes(user.role);
  if (target.ownerId !== user.userId && !isAdmin) {
    return { error: 'Only lounge owner can modify member roles.', status: 403 };
  }

  await db.update(loungeMembers)
    .set({ role })
    .where(and(
      eq(loungeMembers.loungeId, target.id),
      eq(loungeMembers.userId, targetUserId)
    ));

  return { success: true, message: 'Member role updated.' };
}

export async function removeMember(user: any, rawId: string, targetUserId: number) {
  if (isNaN(targetUserId)) {
    return { error: 'Valid target user ID is required.', status: 400 };
  }

  const all = await db.select().from(lounges);
  const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

  if (!target) {
    return { error: 'Lounge not found.', status: 404 };
  }

  const isAdmin = ['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'].includes(user.role);
  if (target.ownerId !== user.userId && targetUserId !== user.userId && !isAdmin) {
    return { error: 'Permission denied.', status: 403 };
  }

  await db.delete(loungeMembers)
    .where(and(
      eq(loungeMembers.loungeId, target.id),
      eq(loungeMembers.userId, targetUserId)
    ));

  return { success: true, message: 'Member removed from lounge.' };
}

export async function applySanction(user: any, rawId: string, targetUserId: any, type: string) {
  if (!rawId || !targetUserId || !type) {
    return { error: 'loungeId, targetUserId, and type are required.', status: 400 };
  }

  const all = await db.select().from(lounges);
  const target = all.find(l => l.slug === rawId || l.id.toString() === rawId.toString());

  if (!target) {
    return { error: 'Lounge not found.', status: 404 };
  }

  const isAdmin = ['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'].includes(user.role);
  if (target.ownerId !== user.userId && !isAdmin) {
    return { error: 'Only lounge owners or admins can apply sanctions.', status: 403 };
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

  return { success: true, message: `Sanction "${type}" applied successfully.` };
}

export async function addMemberDirect(user: any, rawId: string, username: string) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    return { error: 'Username is required.', status: 400 };
  }

  const all = await db.select().from(lounges);
  const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

  if (!target) {
    return { error: 'Lounge not found.', status: 404 };
  }

  const isAdmin = ['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'].includes(user.role);
  if (target.ownerId !== user.userId && !isAdmin) {
    return { error: 'Only lounge owner or admins can add members directly.', status: 403 };
  }

  const cleanUsername = username.trim().replace(/^@/, '');
  const targetUser = await userRepository.findByUsername(cleanUsername);

  if (!targetUser) {
    return { error: `User "@${cleanUsername}" not found.`, status: 404 };
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

  return { success: true, message: `Added @${cleanUsername} to ${target.name}` };
}

export async function joinRoom(currentUserId: number, roomId: string, inviteCode?: string) {
  const all = await db.select().from(lounges);
  const target = all.find(l => l.slug === roomId || l.id.toString() === roomId || (inviteCode && l.inviteCode === inviteCode));

  if (!target) {
    return { error: 'Room not found.', status: 404 };
  }

  if (target.isPrivate && target.inviteCode && target.inviteCode !== inviteCode && target.ownerId !== currentUserId) {
    return { error: 'Invalid invite code for private room.', status: 403 };
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

  return { success: true, message: `Joined room ${target.name}`, room: target };
}

export async function updateLoungeSettings(user: any, rawId: string, body: any) {
  const { name, description, icon_url, is_private } = body;
  const currentUserId = user.userId;

  const all = await db.select().from(lounges);
  const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

  if (!target) {
    return { error: 'Lounge not found.', status: 404 };
  }

  const isAdmin = checkIsSystemAdmin(user);
  if (target.ownerId !== currentUserId && !isAdmin) {
    return { error: 'Only lounge owner or admins can update settings.', status: 403 };
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
  const iconVal = icon_url !== undefined ? icon_url : body.avatar_url;
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

  return {
    ...updated,
    lounge_id: updated.slug || `lounge_${updated.id}`,
    is_official: updated.isOfficial,
    is_private: updated.isPrivate,
    avatar_url: updated.avatarUrl
  };
}

export async function applyToLounge(currentUserId: number, rawId: string) {
  const all = await db.select().from(lounges);
  const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

  if (!target) {
    return { error: 'Lounge or room not found.', status: 404 };
  }

  if (target.parentLoungeId && target.isPrivate) {
    return {
      error: 'Applications are restricted for this private room. Joining requires an invite link or code shared directly by the room creator.',
      status: 403
    };
  }

  const existing = await db.select().from(loungeMembers)
    .where(and(eq(loungeMembers.loungeId, target.id), eq(loungeMembers.userId, currentUserId)));

  if (existing.length > 0) {
    const member = existing[0];
    if (member.status === 'active') {
      return { success: true, status: 'active', message: 'You are already a member.' };
    }
    if (member.status === 'pending') {
      return { success: true, status: 'pending', message: 'Your application is pending review.' };
    }
  }

  await db.insert(loungeMembers).values({
    loungeId: target.id,
    userId: currentUserId,
    role: 'member',
    status: 'pending'
  });

  return {
    success: true,
    status: 'pending',
    message: 'Join application submitted successfully! Awaiting approval.'
  };
}

export async function deleteLounge(user: any, rawId: string) {
  const currentUserId = user.userId;
  const isAdmin = checkIsSystemAdmin(user);

  const all = await db.select().from(lounges);
  const target = all.find(l => l.slug === rawId || l.id.toString() === rawId);

  if (!target) {
    return { error: 'Lounge not found.', status: 404 };
  }

  if ((target.isOfficial || target.isSystem || target.slug === 'velum_master_lounge') && !isAdmin) {
    return { error: 'Official Velum lounges cannot be deleted.', status: 403 };
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
    return { error: 'You do not have permission to delete this lounge.', status: 403 };
  }

  const childSubs = all.filter(l => l.parentLoungeId === target.id);
  const targetIds = [target.id, ...childSubs.map(s => s.id)];

  await db.delete(messages).where(inArray(messages.loungeId, targetIds));
  await db.delete(loungeMembers).where(inArray(loungeMembers.loungeId, targetIds));
  await db.delete(lounges).where(inArray(lounges.id, targetIds));

  return { success: true, message: `Lounge "${target.name}" and all associated channels were deleted successfully.` };
}
