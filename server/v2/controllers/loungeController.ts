import type { Request, Response, NextFunction } from 'express';
import * as loungeService from '../services/loungeService.js';
import { deduplicateSublounges } from '../services/loungeDeduplicator.js';

export async function getConversationsSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUserId = req.user?.userId;
    const result = await loungeService.getConversationsSummary(currentUserId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getUnreads(req: Request, res: Response, next: NextFunction) {
  try {
    const currentUserId = req.user!.userId;
    const unreadCounts = await loungeService.getUnreadSequenceCounts(currentUserId);
    res.json({ unreadCounts });
  } catch (err) {
    next(err);
  }
}

export async function getMuteRule(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const currentUserId = req.user!.userId;
    const result = await loungeService.getMuteRule(currentUserId, rawId);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function setMuteRule(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const { mute_rule } = req.body;
    const currentUserId = req.user!.userId;
    const result = await loungeService.setMuteRule(currentUserId, rawId, mute_rule);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

const LINK_PREVIEW_CACHE = new Map<string, { at: number; payload: Record<string, string> }>();
const LINK_PREVIEW_TTL_MS = 30 * 60 * 1000;

export async function getLinkPreview(req: Request, res: Response) {
  try {
    const { buildSafeLinkPreview } = await import('../utils/linkPreviewSafe.js');
    const rawUrl = req.query.url ? String(req.query.url).trim() : '';
    if (!rawUrl) {
      return res.status(400).json({ error: 'URL required.' });
    }

    let cacheKey = rawUrl;
    try {
      cacheKey = new URL(rawUrl).toString();
    } catch {
      return res.status(400).json({ error: 'Invalid URL.' });
    }

    const cached = LINK_PREVIEW_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.at < LINK_PREVIEW_TTL_MS) {
      return res.json(cached.payload);
    }

    const payload = await buildSafeLinkPreview(rawUrl);
    LINK_PREVIEW_CACHE.set(payload.url, { at: Date.now(), payload });
    if (LINK_PREVIEW_CACHE.size > 200) {
      const oldest = LINK_PREVIEW_CACHE.keys().next().value;
      if (oldest) LINK_PREVIEW_CACHE.delete(oldest);
    }
    return res.json(payload);
  } catch (err) {
    const code = (err as Error)?.message || 'PREVIEW_FAIL';
    if (
      code === 'INVALID_URL' ||
      code === 'INVALID_PROTOCOL' ||
      code === 'INVALID_URL_AUTH' ||
      code === 'BLOCKED_HOST' ||
      code === 'BLOCKED_IP' ||
      code === 'DNS_FAIL'
    ) {
      return res.status(400).json({ error: 'URL not allowed.', code });
    }
    return res.json({
      url: '',
      title: '',
      description: '',
      image: '',
    });
  }
}

export async function listLounges(req: Request, res: Response, next: NextFunction) {
  try {
    const searchQuery = (req.query.q || req.query.search || req.query.query || '').toString().trim().toLowerCase();
    const result = await loungeService.listLounges(req.user, searchQuery);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getUserLounges(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await loungeService.getUserLounges(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getLoungeDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const result = await loungeService.getLoungeDetails(rawId, req.user);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getLoungeRooms(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const result = await loungeService.getLoungeRooms(rawId, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getLoungeMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const result = await loungeService.getLoungeMembersList(rawId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function joinLounge(req: Request, res: Response, next: NextFunction) {
  try {
    const { lounge_id, invite_code } = req.body;
    const currentUserId = req.user!.userId;
    const result = await loungeService.joinLounge(currentUserId, lounge_id, invite_code);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createLounge(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, is_private, icon_url } = req.body;
    const currentUserId = req.user!.userId;
    const result = await loungeService.createLounge(currentUserId, name, description, is_private, icon_url);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createSublounge(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, is_private } = req.body;
    const rawId = req.params.id;
    const result = await loungeService.createSublounge(req.user!, rawId, name, description, is_private);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateLoungeAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    const { avatar_url } = req.body;
    const currentUserId = req.user!.userId;
    const rawId = req.params.id;
    const result = await loungeService.updateLoungeAvatar(currentUserId, rawId, avatar_url);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function searchLoungeMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const query = req.query.q ? String(req.query.q).trim() : '';
    const result = await loungeService.searchLoungeMessages(rawId, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function syncLoungeMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const sinceSeqParam = req.query.since_seq || req.query.sinceSeq || '0';
    const sinceSeq = parseInt(sinceSeqParam as string, 10);
    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 500);

    const result = await loungeService.syncLoungeMessages(rawId, sinceSeq, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getLoungeMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const currentUserId = req.user?.userId || null;
    const since = req.query.since ? new Date(req.query.since as string) : null;

    const result = await loungeService.getLoungeMessages(rawId, currentUserId, since);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function postLoungeMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const content = req.body.content || req.body.message;
    const clientMsgId = req.body.client_msg_id || req.body.nonce || null;

    const result = await loungeService.postLoungeMessage(req.user!, rawId, content, clientMsgId);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    const statusCode = ('deduplicated' in result && result.deduplicated) ? 200 : 201;
    res.status(statusCode).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getLoungeInvites(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.loungeId;
    const result = await loungeService.getLoungeInvites(rawId, req.user!);
    if (typeof result === 'object' && 'error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createLoungeInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.loungeId;
    const result = await loungeService.createLoungeInvite(rawId, req.user!);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteLoungeInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.loungeId;
    const result = await loungeService.deleteLoungeInvite(rawId);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getJoinRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const result = await loungeService.getJoinRequests(rawId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function reviewJoinRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { requestId, approve } = req.body;
    const result = await loungeService.reviewJoinRequest(requestId, approve);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateMemberRole(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const targetUserId = parseInt(req.params.targetUserId, 10);
    const { role } = req.body;
    const result = await loungeService.updateMemberRole(req.user!, rawId, targetUserId, role);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const targetUserId = parseInt(req.params.targetUserId, 10);
    const result = await loungeService.removeMember(req.user!, rawId, targetUserId);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function applySanction(req: Request, res: Response, next: NextFunction) {
  try {
    const { loungeId, targetUserId, type } = req.body;
    const result = await loungeService.applySanction(req.user!, loungeId, targetUserId, type);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function addMemberDirect(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const { username } = req.body;
    const result = await loungeService.addMemberDirect(req.user!, rawId, username);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function joinRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const { roomId } = req.params;
    const { invite_code } = req.body || {};
    const currentUserId = req.user!.userId;
    const result = await loungeService.joinRoom(currentUserId, roomId, invite_code);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateLoungeSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const result = await loungeService.updateLoungeSettings(req.user!, rawId, req.body);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function applyToLounge(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const currentUserId = req.user!.userId;
    const result = await loungeService.applyToLounge(currentUserId, rawId);
    if ('error' in result && typeof result.status === 'number') {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deduplicateLounges(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deduplicateSublounges();
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function deleteLounge(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const result = await loungeService.deleteLounge(req.user!, rawId);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}
