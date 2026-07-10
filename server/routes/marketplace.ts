import express from 'express';
import { authenticateUser } from '../middleware.js';
import { 
  getListings, 
  createListing, 
  addListingMedia, 
  getListingMedia, 
  getListingReviews, 
  createListingReview, 
  reportReview, 
  createCoupon, 
  getCoupons, 
  validateCoupon, 
  createDiscussion, 
  getListingDiscussions, 
  getEscrows, 
  createEscrow, 
  testSandboxEscrow, 
  releaseEscrow, 
  revertEscrow,
  getSupportChats,
  createSupportChat,
  addSupportChatMessage,
  resolveSupportChatDispute
} from '../controllers/marketplace.js';

export const marketplaceRouter = express.Router();

// PILLAR A: Storefront Listings & Media API
marketplaceRouter.get('/marketplace/listings', authenticateUser, getListings);
marketplaceRouter.post('/marketplace/listings', authenticateUser, createListing);
marketplaceRouter.post('/marketplace/listings/:listingId/media', authenticateUser, addListingMedia);
marketplaceRouter.get('/marketplace/listings/:listingId/media', authenticateUser, getListingMedia);

// PILLAR B: Social Reputation & Reviews API
marketplaceRouter.get('/marketplace/listings/:listingId/reviews', authenticateUser, getListingReviews);
marketplaceRouter.post('/marketplace/listings/:listingId/reviews', authenticateUser, createListingReview);
marketplaceRouter.post('/marketplace/reviews/:reviewId/report', authenticateUser, reportReview);

// PILLAR C: Coupon & Pricing Engine API
marketplaceRouter.post('/marketplace/coupons', authenticateUser, createCoupon);
marketplaceRouter.get('/marketplace/coupons', authenticateUser, getCoupons);
marketplaceRouter.post('/marketplace/coupons/validate', authenticateUser, validateCoupon);

// PILLAR D: Public Listings Discussion Boards
marketplaceRouter.post('/marketplace/listings/:listingId/discussions', authenticateUser, createDiscussion);
marketplaceRouter.get('/marketplace/listings/:listingId/discussions', authenticateUser, getListingDiscussions);

// PILLAR F: Secure Escrow & Sandboxed Execution
marketplaceRouter.get('/marketplace/escrows', authenticateUser, getEscrows);
marketplaceRouter.post('/marketplace/escrows', authenticateUser, createEscrow);
marketplaceRouter.post('/marketplace/escrows/:transactionId/test-sandbox', authenticateUser, testSandboxEscrow);
marketplaceRouter.post('/marketplace/escrows/:transactionId/release', authenticateUser, releaseEscrow);
marketplaceRouter.post('/marketplace/escrows/:transactionId/revert', authenticateUser, revertEscrow);

// Support chats & dispute resolution
marketplaceRouter.get('/marketplace/support-chats', authenticateUser, getSupportChats);
marketplaceRouter.post('/marketplace/support-chats', authenticateUser, createSupportChat);
marketplaceRouter.post('/marketplace/support-chats/:chatId/messages', authenticateUser, addSupportChatMessage);
marketplaceRouter.post('/marketplace/support-chats/:chatId/resolve', authenticateUser, resolveSupportChatDispute);
