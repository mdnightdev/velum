import { describe, it, expect, beforeEach, vi } from 'vitest';
import { marketRepository } from './marketRepository.js';
import { walletRepository } from './walletRepository.js';
import { db } from '../db.js';

vi.mock('../db.js', () => {
  const mockDb: any = {
    market_listings: [],
    escrow_transactions: [],
    market_coupons: [],
    market_discussions: [],
    market_reviews: [],
    user_wallets: [],
    wallet_balances: [],
    kyc_verifications: [],
    users: [
      { user_id: 42, username: 'seller' },
      { user_id: 101, username: 'buyer' }
    ]
  };
  return {
    db: mockDb,
    saveDb: vi.fn(),
  };
});

describe('Marketplace Repositories Unit Tests', () => {
  beforeEach(() => {
    // Initialize or clear tables for clean state
    db.market_listings = [];
    db.escrow_transactions = [];
    db.market_coupons = [];
    db.market_discussions = [];
    db.market_reviews = [];
    db.user_wallets = [];
    db.wallet_balances = [];
    db.kyc_verifications = [];
  });

  describe('marketRepository', () => {
    it('should create and retrieve market listings', () => {
      const listing = {
        listing_id: 'test_listing_1',
        seller_id: 42,
        title: 'Premium Script',
        description: 'VLM test asset',
        price: 99.99,
        status: 'ACTIVE' as const,
        created_at: Date.now()
      };

      marketRepository.createListing(listing);
      const found = marketRepository.findListingById('test_listing_1');
      expect(found).toBeDefined();
      expect(found?.title).toBe('Premium Script');
      expect(found?.price).toBe(99.99);

      const all = marketRepository.findAllListings();
      expect(all.length).toBe(1);
    });

    it('should update listing fields successfully', () => {
      const listing = {
        listing_id: 'test_listing_2',
        seller_id: 42,
        title: 'Original Title',
        price: 50.00,
        status: 'ACTIVE' as const,
        created_at: Date.now()
      };

      marketRepository.createListing(listing);
      const updated = marketRepository.updateListing('test_listing_2', {
        title: 'Updated Title',
        price: 45.00
      });

      expect(updated).toBeDefined();
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.price).toBe(45.00);

      const found = marketRepository.findListingById('test_listing_2');
      expect(found?.title).toBe('Updated Title');
    });

    it('should handle coupons validation queries', () => {
      const coupon = {
        coupon_id: 'coupon_1',
        code: 'SAVE50',
        discount_type: 'PERCENTAGE' as const,
        value: 50.00,
        value_cents_or_pct: 50,
        minimum_order_value_cents: 0,
        expiration_date: Date.now() + 1000000,
        usage_limit: 10,
        usage_count: 0,
        active: true
      };

      marketRepository.createCoupon(coupon);
      const found = marketRepository.findCouponByCode('save50');
      expect(found).toBeDefined();
      expect(found?.coupon_id).toBe('coupon_1');
    });
  });

  describe('walletRepository', () => {
    it('should get or create legacy user wallets', () => {
      const wallet = walletRepository.getOrCreateWallet(101);
      expect(wallet).toBeDefined();
      expect(wallet.balance_cents).toBe(0);

      walletRepository.updateWalletBalance(101, 5000);
      const updated = walletRepository.findWalletByUserId(101);
      expect(updated?.balance_cents).toBe(5000);
    });

    it('should manage multi-currency wallet balances', () => {
      const bal = walletRepository.getOrCreateWalletBalance(102, 'USD');
      expect(bal.balance_cents).toBe(0);

      walletRepository.updateWalletBalanceCents(102, 'USD', 25000);
      const updated = walletRepository.findWalletBalance(102, 'USD');
      expect(updated?.balance_cents).toBe(25000);
    });
  });
});
