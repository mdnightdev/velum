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

export async function getLinkPreview(req: Request, res: Response) {
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
