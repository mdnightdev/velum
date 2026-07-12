import { db, saveDb } from '../db.js';
import { 
  MarketListing, EscrowTransaction, MarketCoupon, 
  MarketDiscussion, MarketReview, MarketSkuVariant
} from '../../src/types.js';

export const marketRepository = {
  // ==========================================
  // MARKET LISTINGS
  // ==========================================
  
  findAllListings(): MarketListing[] {
    return db.market_listings || [];
  },

  findListingById(id: string): MarketListing | undefined {
    return (db.market_listings || []).find(l => l && l.listing_id === id);
  },

  createListing(listing: MarketListing): void {
    db.market_listings = db.market_listings || [];
    db.market_listings.push(listing);
    saveDb();
  },

  updateListing(id: string, updates: Partial<MarketListing>): MarketListing | undefined {
    const listing = this.findListingById(id);
    if (!listing) return undefined;

    Object.assign(listing, updates);
    saveDb();
    return listing;
  },

  deleteListing(id: string): void {
    db.market_listings = (db.market_listings || []).filter(l => l && l.listing_id !== id);
    saveDb();
  },

  // ==========================================
  // ESCROW TRANSACTIONS
  // ==========================================

  findAllEscrows(): EscrowTransaction[] {
    return db.escrow_transactions || [];
  },

  findEscrowById(id: string): EscrowTransaction | undefined {
    return (db.escrow_transactions || []).find(t => t && t.transaction_id === id);
  },

  createEscrow(escrow: EscrowTransaction): void {
    db.escrow_transactions = db.escrow_transactions || [];
    db.escrow_transactions.push(escrow);
    saveDb();
  },

  updateEscrow(id: string, updates: Partial<EscrowTransaction>): EscrowTransaction | undefined {
    const escrow = this.findEscrowById(id);
    if (!escrow) return undefined;

    Object.assign(escrow, updates);
    saveDb();
    return escrow;
  },

  deleteEscrow(id: string): void {
    db.escrow_transactions = (db.escrow_transactions || []).filter(t => t && t.transaction_id !== id);
    saveDb();
  },

  // ==========================================
  // COUPONS
  // ==========================================

  findAllCoupons(): MarketCoupon[] {
    return db.market_coupons || [];
  },

  findCouponByCode(code: string): MarketCoupon | undefined {
    if (!code) return undefined;
    const target = code.toUpperCase().trim();
    return (db.market_coupons || []).find(c => c && c.code === target);
  },

  findCouponById(id: string): MarketCoupon | undefined {
    return (db.market_coupons || []).find(c => c && c.coupon_id === id);
  },

  createCoupon(coupon: MarketCoupon): void {
    db.market_coupons = db.market_coupons || [];
    db.market_coupons.push(coupon);
    saveDb();
  },

  updateCoupon(id: string, updates: Partial<MarketCoupon>): MarketCoupon | undefined {
    const coupon = this.findCouponById(id);
    if (!coupon) return undefined;

    Object.assign(coupon, updates);
    saveDb();
    return coupon;
  },

  // ==========================================
  // SKU VARIANTS
  // ==========================================

  findAllSkuVariants(): MarketSkuVariant[] {
    return db.market_sku_variants || [];
  },

  findSkuVariantsByListingId(listingId: string): MarketSkuVariant[] {
    return (db.market_sku_variants || []).filter(v => v && v.listing_id === listingId);
  },

  findSkuVariantById(id: string): MarketSkuVariant | undefined {
    return (db.market_sku_variants || []).find(v => v && v.sku_id === id);
  },

  createSkuVariant(variant: MarketSkuVariant): void {
    db.market_sku_variants = db.market_sku_variants || [];
    db.market_sku_variants.push(variant);
    saveDb();
  },

  deleteSkuVariant(id: string): void {
    db.market_sku_variants = (db.market_sku_variants || []).filter(v => v && v.sku_id !== id);
    saveDb();
  },

  // ==========================================
  // DISCUSSIONS
  // ==========================================

  findAllDiscussions(): MarketDiscussion[] {
    return db.market_discussions || [];
  },

  findDiscussionsByListingId(listingId: string): MarketDiscussion[] {
    return (db.market_discussions || []).filter(d => d && d.listing_id === listingId);
  },

  createDiscussion(discussion: MarketDiscussion): void {
    db.market_discussions = db.market_discussions || [];
    db.market_discussions.push(discussion);
    saveDb();
  },

  // ==========================================
  // REVIEWS
  // ==========================================

  findAllReviews(): MarketReview[] {
    return db.market_reviews || [];
  },

  findReviewsByListingId(listingId: string): MarketReview[] {
    return (db.market_reviews || []).filter(r => r && r.listing_id === listingId);
  },

  createReview(review: MarketReview): void {
    db.market_reviews = db.market_reviews || [];
    db.market_reviews.push(review);
    saveDb();
  },

  // ==========================================
  // ADMINISTRATIVE LOGS AND ACTIONS
  // ==========================================

  createPlatformFinancialAuditLog(log: any): void {
    db.platform_financial_audit_logs = db.platform_financial_audit_logs || [];
    db.platform_financial_audit_logs.push(log);
    saveDb();
  },

  createAutomationAction(action: any): void {
    db.automation_actions = db.automation_actions || [];
    db.automation_actions.push(action);
    saveDb();
  },

  createRefundRequest(request: any): void {
    db.refund_requests = db.refund_requests || [];
    db.refund_requests.push(request);
    saveDb();
  }
};
