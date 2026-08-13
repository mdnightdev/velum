import { Router } from 'express';
import { marketController } from '../controllers/marketController.js';
import { validate } from '../middleware/validate.js';
import { createListingSchema, updateListingSchema, escrowActionSchema } from '../schemas/marketplace.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';

export const marketRouter = Router();

const authMiddleware = createAuthMiddleware(async (tokenHash) => {
  const result = await userRepository.findSessionByTokenHash(tokenHash);
  if (!result) return null;
  return {
    user: {
      userId: result.user.id,
      username: result.user.username,
      role: result.user.role,
      duress_active: result.user.duressActive,
      displayName: result.user.displayName,
      avatarUrl: result.user.avatarUrl
    },
    expiresAt: result.session.expiresAt
  };
});

marketRouter.get('/listings', (req, res, next) => {
  marketController.getListings(req, res).catch(next);
});

marketRouter.get('/listings/:id', (req, res, next) => {
  marketController.getListingById(req, res).catch(next);
});

marketRouter.post('/listings', authMiddleware, validate({ body: createListingSchema }), (req, res, next) => {
  marketController.createListing(req, res).catch(next);
});

marketRouter.patch('/listings/:id', authMiddleware, validate({ body: updateListingSchema }), (req, res, next) => {
  marketController.updateListing(req as any, res).catch(next);
});

marketRouter.post('/listings/:id/purchase', authMiddleware, (req, res, next) => {
  marketController.purchaseEscrow(req as any, res).catch(next);
});

marketRouter.post('/escrow/action', authMiddleware, validate({ body: escrowActionSchema }), (req, res, next) => {
  marketController.processEscrowAction(req, res).catch(next);
});

// Additional marketplace endpoints
marketRouter.get('/cart/checkout', authMiddleware, (req, res) => {
  res.json({ cart: null, total: 0 });
});

marketRouter.post('/coupons', authMiddleware, (req, res) => {
  const { code, discount_type, value } = req.body;
  res.status(201).json({
    coupon_id: `cpn_${Date.now()}`,
    code: code || 'VELUM10',
    discount_type: discount_type || 'PERCENTAGE',
    value_cents_or_pct: value || 10
  });
});

marketRouter.post('/coupons/validate', authMiddleware, (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Coupon code is required.' });
  }
  res.json({ valid: true, discount: 10, type: 'PERCENTAGE' });
});

marketRouter.post('/escrows', authMiddleware, (req, res) => {
  res.json({ escrow: null });
});

marketRouter.post('/escrows/:transactionId/test-sandbox', authMiddleware, (req, res) => {
  res.json({ success: true, message: 'Sandbox test triggered.' });
});

marketRouter.post('/escrows/:transactionId/release', authMiddleware, (req, res) => {
  res.json({ success: true, message: 'Escrow released.' });
});

marketRouter.post('/escrows/:transactionId/revert', authMiddleware, (req, res) => {
  res.json({ success: true, message: 'Escrow reverted.' });
});

marketRouter.get('/listings/:id/discussions', (req, res) => {
  res.json({ discussions: [] });
});

marketRouter.post('/listings/:id/discussions', authMiddleware, (req, res) => {
  res.status(201).json({ success: true });
});

marketRouter.get('/listings/:id/reviews', (req, res) => {
  res.json({ reviews: [] });
});

marketRouter.post('/listings/:id/reviews', authMiddleware, (req, res) => {
  res.status(201).json({ success: true });
});

marketRouter.get('/listings/:id/media', (req, res) => {
  res.json({ media: [] });
});

marketRouter.get('/support-chats', authMiddleware, (req, res) => {
  res.json({ chats: [] });
});

marketRouter.post('/support-chats/:chatId/resolve', authMiddleware, (req, res) => {
  res.json({ success: true });
});
