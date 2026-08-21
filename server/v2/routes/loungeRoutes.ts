import { Router, Request, Response, NextFunction } from 'express';
import { createAuthMiddleware, extractSessionToken, hashSessionToken } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { checkIsSystemAdmin } from '../services/loungeService.js';
import * as loungeController from '../controllers/loungeController.js';

export { checkIsSystemAdmin };

export const auth = createAuthMiddleware(async (hashedToken) => {
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

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = extractSessionToken(req);
    if (token) {
      const hashedToken = hashSessionToken(token);
      const result = await userRepository.findSessionByTokenHash(hashedToken);
      if (result) {
        req.user = {
          userId: result.user.id,
          username: result.user.username,
          role: result.user.role,
          duress_active: result.user.duressActive
        };
        req.sessionId = token;
      }
    }
  } catch (_) {
    // Ignore error for optionalAuth
  }
  next();
};

export const loungeRouter = Router();

// Conversations summary & unreads
loungeRouter.get('/conversations/summary', optionalAuth, loungeController.getConversationsSummary);
loungeRouter.get('/unreads', auth, loungeController.getUnreads);

// Mute settings
loungeRouter.get('/:id/mute', auth, loungeController.getMuteRule);
loungeRouter.post('/:id/mute', auth, loungeController.setMuteRule);

// Link preview
loungeRouter.get('/link-preview', optionalAuth, loungeController.getLinkPreview);

// Lounge listings & details
loungeRouter.get('/', optionalAuth, loungeController.listLounges);
loungeRouter.get('/user', auth, loungeController.getUserLounges);
loungeRouter.get('/:id', optionalAuth, loungeController.getLoungeDetails);
loungeRouter.get('/:id/rooms', optionalAuth, loungeController.getLoungeRooms);
loungeRouter.get('/:id/members', optionalAuth, loungeController.getLoungeMembers);

// Lounge lifecycle
loungeRouter.post('/join', auth, loungeController.joinLounge);
loungeRouter.post('/', auth, loungeController.createLounge);
loungeRouter.post('/:id/sublounges', auth, loungeController.createSublounge);
loungeRouter.put('/:id/avatar', auth, loungeController.updateLoungeAvatar);

// Messages & Search
loungeRouter.get('/:id/search', optionalAuth, loungeController.searchLoungeMessages);
loungeRouter.get('/:id/messages/sync', optionalAuth, loungeController.syncLoungeMessages);
loungeRouter.get('/:id/messages', optionalAuth, loungeController.getLoungeMessages);
loungeRouter.post('/:id/messages', auth, loungeController.postLoungeMessage);

// Invites
loungeRouter.get('/:loungeId/invites', auth, loungeController.getLoungeInvites);
loungeRouter.post('/:loungeId/invites', auth, loungeController.createLoungeInvite);
loungeRouter.delete('/:loungeId/invites/:inviteId', auth, loungeController.deleteLoungeInvite);

// Join requests & Membership management
loungeRouter.get('/:id/requests', auth, loungeController.getJoinRequests);
loungeRouter.post('/apply/review', auth, loungeController.reviewJoinRequest);
loungeRouter.put('/:id/members/:targetUserId', auth, loungeController.updateMemberRole);
loungeRouter.delete('/:id/members/:targetUserId', auth, loungeController.removeMember);
loungeRouter.post('/sanction', auth, loungeController.applySanction);
loungeRouter.post('/:id/members/add', auth, loungeController.addMemberDirect);
loungeRouter.post('/:loungeId/rooms/:roomId/join', auth, loungeController.joinRoom);

// Settings, Applications, Maintenance
loungeRouter.post('/:id/avatar', auth, loungeController.updateLoungeAvatar);
loungeRouter.put('/:id/avatar', auth, loungeController.updateLoungeAvatar);
loungeRouter.post('/:id', auth, loungeController.updateLoungeSettings);
loungeRouter.put('/:id', auth, loungeController.updateLoungeSettings);
loungeRouter.post('/:id/apply', auth, loungeController.applyToLounge);
loungeRouter.post('/deduplicate', auth, loungeController.deduplicateLounges);
loungeRouter.delete('/:id', auth, loungeController.deleteLounge);

export default loungeRouter;
