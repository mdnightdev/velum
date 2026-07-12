import express from 'express';
import { authenticateUser } from '../middleware.js';
import { 
  getLounges, 
  getLounge, 
  getSublounges, 
  createLounge, 
  createSublounge, 
  getSystemLounges, 
  getUserLounges, 
  updateLounge, 
  deleteLounge, 
  getRooms, 
  createRoom, 
  joinLounge, 
  exploreLounges,
  getLoungeMembers,
  applyToJoinLounge,
  reviewJoinRequest,
  transferOwnership,
  respondOwnershipTransfer,
  updatePreferences,
  applySanctionEndpoint
} from '../controllers/lounges.js';

export const loungesRouter = express.Router();

loungesRouter.get('/lounges', authenticateUser, getLounges);
loungesRouter.get('/lounges/system', authenticateUser, getSystemLounges);
loungesRouter.get('/lounges/user', authenticateUser, getUserLounges);
loungesRouter.get('/lounges/explore', authenticateUser, exploreLounges);

loungesRouter.get('/lounges/:id', authenticateUser, getLounge);
loungesRouter.get('/lounges/:id/sublounges', authenticateUser, getSublounges);
loungesRouter.get('/lounges/:loungeId/members', authenticateUser, getLoungeMembers);

loungesRouter.post('/lounges', authenticateUser, (req, res, next) => {
  if (req.body.parent_lounge_id) {
    return createSublounge(req, res);
  }
  return createLounge(req, res);
});

loungesRouter.put('/lounges/:id', authenticateUser, updateLounge);
loungesRouter.delete('/lounges/:id', authenticateUser, deleteLounge);

loungesRouter.get('/lounges/:loungeId/rooms', authenticateUser, getRooms);
loungesRouter.post('/lounges/:loungeId/rooms', authenticateUser, createRoom);

loungesRouter.post('/lounges/join', authenticateUser, joinLounge);

// New Lounge system API routes
loungesRouter.post('/lounges/apply', authenticateUser, applyToJoinLounge);
loungesRouter.post('/lounges/apply/review', authenticateUser, reviewJoinRequest);
loungesRouter.post('/lounges/transfer', authenticateUser, transferOwnership);
loungesRouter.post('/lounges/transfer/respond', authenticateUser, respondOwnershipTransfer);
loungesRouter.post('/lounges/preferences', authenticateUser, updatePreferences);
loungesRouter.post('/lounges/sanction', authenticateUser, applySanctionEndpoint);
