import express from 'express';
import { authenticateAdmin } from '../middleware.js';
import { 
  broadcastMessage, 
  getTickets, 
  replyTicket, 
  deleteTicket, 
  deleteUser, 
  approveRecovery, 
  sanctionUser, 
  revokeSanction, 
  lockUser, 
  getDiagnostics, 
  createInvite, 
  getInvites, 
  nominateSupport, 
  renameExecutive, 
  executeCli 
} from '../controllers/admin.js';

export const adminRouter = express.Router();

adminRouter.post('/admin/broadcast', authenticateAdmin, broadcastMessage);
adminRouter.get('/admin/tickets', authenticateAdmin, getTickets);
adminRouter.post('/admin/tickets/:ticket_id/reply', authenticateAdmin, replyTicket);

adminRouter.delete('/admin/tickets/:ticket_id', authenticateAdmin, deleteTicket);
adminRouter.post('/admin/tickets/:ticket_id/delete', authenticateAdmin, deleteTicket);

adminRouter.delete('/admin/users/:user_id', authenticateAdmin, deleteUser);
adminRouter.post('/admin/users/:user_id/delete', authenticateAdmin, deleteUser);

adminRouter.post('/admin/recover-approve', authenticateAdmin, approveRecovery);
adminRouter.post('/admin/sanction', authenticateAdmin, sanctionUser);
adminRouter.post('/admin/sanction/revoke', authenticateAdmin, revokeSanction);
adminRouter.post('/admin/user-lock', authenticateAdmin, lockUser);
adminRouter.get('/admin/diagnostics', authenticateAdmin, getDiagnostics);

adminRouter.post('/admin/invites', authenticateAdmin, createInvite);
adminRouter.get('/admin/invites', authenticateAdmin, getInvites);
adminRouter.post('/admin/nominate', authenticateAdmin, nominateSupport);
adminRouter.post('/admin/rename-executive', authenticateAdmin, renameExecutive);
adminRouter.post('/admin/cli/exec', authenticateAdmin, executeCli);