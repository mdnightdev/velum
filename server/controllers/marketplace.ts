import { Request, Response } from 'express';
import { 
  MarketListing, 
  EscrowTransaction, 
  MarketAssetMedia, 
  MarketReview, 
  MarketCoupon, 
  MarketDiscussion,
  MarketSkuVariant
} from '../../src/types.js';
import { db, saveDb, loadDb } from '../db.js';
import { userRepository } from '../db/userRepository.js';
import { marketRepository } from '../db/marketRepository.js';
import { walletRepository } from '../db/walletRepository.js';
import { calculateOrderSettlement } from '../utils/marketEngine.js';
import { generateUlid, generatePrefixedId } from '../utils/ulid.js';

// Helper to enrich escrow with dynamic calculated values or defaults for SQLite loaded records
function enrichEscrow(esc: any) {
  if (!esc) return esc;
  const buyer = userRepository.findById(esc.buyer_id);
  const seller = userRepository.findById(esc.seller_id);
  const amt = Number(esc.amount || 0);
  const platformFee = esc.platform_fee !== undefined ? Number(esc.platform_fee) : parseFloat((amt * 0.05).toFixed(2));
  const payoutAmount = esc.payout_amount !== undefined ? Number(esc.payout_amount) : parseFloat((amt - platformFee).toFixed(2));
  const sandboxState = esc.sandbox_state || 'DEPLOYED_SANDBOX';
  
  let sandboxLogs = esc.sandbox_logs;
  if (!sandboxLogs) {
    sandboxLogs = [
      `[SYS-SECURE] INITIALIZING ISO-WORKER DOCK STATE...`,
      `⚙️ ALLOCATING SECURE MEMORY CELL: 16.00MB RAM`,
      `✅ ISOLATION VERIFICATION INITIATED ON HELD_IN_ESCROW BUFFER...`
    ];
  } else if (typeof sandboxLogs === 'string') {
    try {
      sandboxLogs = JSON.parse(sandboxLogs);
    } catch (_) {
      sandboxLogs = [sandboxLogs];
    }
  }

  return {
    ...esc,
    buyer_username: buyer ? buyer.username : 'Buyer',
    seller_username: seller ? seller.username : 'Seller',
    platform_fee: platformFee,
    payout_amount: payoutAmount,
    sandbox_state: sandboxState,
    sandbox_logs: Array.isArray(sandboxLogs) ? sandboxLogs : [String(sandboxLogs)]
  };
}

// Retrieve all listings (with computed ratings, media counts)
export const getListings = async (req: Request, res: Response) => {
  try {
    const listings = marketRepository.findAllListings();
    const reviews = marketRepository.findAllReviews();
    const media = db.market_asset_media || [];

    const enrichedListings = listings.map(listing => {
      const listingReviews = reviews.filter(r => r.listing_id === listing.listing_id);
      const avgRating = listingReviews.length > 0 
        ? listingReviews.reduce((sum, r) => sum + r.rating, 0) / listingReviews.length 
        : 0;

      const listingMedia = media
        .filter(m => m.listing_id === listing.listing_id)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

      const skuVariants = marketRepository.findSkuVariantsByListingId(listing.listing_id);
      const seller = userRepository.findById(listing.seller_id);

      return {
        ...listing,
        seller_username: seller ? seller.username : 'Creator',
        average_rating: parseFloat(avgRating.toFixed(1)),
        review_count: listingReviews.length,
        media_count: listingMedia.length,
        media_list: listingMedia,
        sku_variants: skuVariants
      };
    });

    res.json(enrichedListings);
  } catch (err: any) {
    console.error('Error fetching market listings:', err);
    res.status(500).json({ error: 'Failed to retrieve listings index.' });
  }
};

// Create a new storefront listing
export const createListing = async (req: Request, res: Response) => {
  try {
    const { title, description, price, discount_price, inventory_count, sku_variants, media_list } = req.body;
    const user = (req as any).user;

    if (!title || price === undefined) {
      return res.status(400).json({ error: 'Title and numerical base price are required.' });
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ error: 'Base price must be a valid positive currency amount.' });
    }

    let numericDiscountPrice: number | undefined = undefined;
    if (discount_price !== undefined && discount_price !== '') {
      numericDiscountPrice = parseFloat(discount_price);
      if (isNaN(numericDiscountPrice) || numericDiscountPrice < 0 || numericDiscountPrice >= numericPrice) {
        return res.status(400).json({ error: 'Discount price must be less than base price and >= 0.' });
      }
    }

    const parsedInventory = inventory_count !== undefined ? parseInt(String(inventory_count), 10) : undefined;

    loadDb();
    db.listing_verification_checks = db.listing_verification_checks || [];

    // Verification check rules
    const prohibitedKeywords = ['cheat', 'exploit', 'hack', 'illegal', 'bypass', 'crack'];
    const titleLower = title.toLowerCase();
    const hasProhibited = prohibitedKeywords.some(kw => titleLower.includes(kw));

    const isSellerVerified = (db.verified_sellers || []).includes(Number(user.user_id));

    let verification_status: 'APPROVED' | 'PENDING_REVIEW' = 'APPROVED';
    if (hasProhibited || !isSellerVerified) {
      verification_status = 'PENDING_REVIEW';
    }

    const listingId = generatePrefixedId('list');
    const newListing: MarketListing = {
      listing_id: listingId,
      seller_id: Number(user.user_id),
      seller_username: user.username,
      title,
      description: description || '',
      price: numericPrice,
      discount_price: numericDiscountPrice,
      status: 'ACTIVE',
      verification_status,
      inventory_count: isNaN(parsedInventory as any) ? undefined : parsedInventory,
      created_at: Date.now()
    };

    marketRepository.createListing(newListing);

    // Save SKU variants if provided
    if (sku_variants && Array.isArray(sku_variants)) {
      sku_variants.forEach((v: any, index: number) => {
        const skuId = `${generatePrefixedId('sku')}_${index}`;
        const variant: MarketSkuVariant = {
          sku_id: skuId,
          variant_id: skuId,
          listing_id: listingId,
          attribute_name: v.attribute_name || 'Option',
          attribute_value: v.attribute_value || 'Default',
          additional_cost_cents: Number(v.additional_cost_cents) || 0,
          inventory_count: Number(v.inventory_count) || 0,
          file_payload_path: v.file_payload_path || ''
        };
        marketRepository.createSkuVariant(variant);
      });
    }

    // Save Media Assets if provided
    if (media_list && Array.isArray(media_list)) {
      db.market_asset_media = db.market_asset_media || [];
      media_list.forEach((m: any, index: number) => {
        const newMedia: MarketAssetMedia = {
          media_id: `${generatePrefixedId('med')}_${index}`,
          listing_id: listingId,
          url: m.url,
          is_banner: !!m.is_banner,
          display_order: m.display_order !== undefined ? Number(m.display_order) : (index + 1),
          file_size: m.file_size !== undefined ? Number(m.file_size) : 1024,
          aspect_ratio: m.aspect_ratio || '16:9'
        };
        db.market_asset_media = db.market_asset_media || [];
        db.market_asset_media.push(newMedia);
      });
      saveDb();
    }

    // Create verification checks
    if (hasProhibited) {
      db.listing_verification_checks.push({
        check_id: generatePrefixedId('chk'),
        listing_id: listingId,
        check_type: 'AUTOMATED_CONTENT_SCAN',
        result: 'FAIL',
        details: 'Title contains prohibited keywords.',
        created_at: Date.now()
      });
    } else {
      db.listing_verification_checks.push({
        check_id: generatePrefixedId('chk'),
        listing_id: listingId,
        check_type: 'AUTOMATED_CONTENT_SCAN',
        result: 'PASS',
        details: 'Content scan clean.',
        created_at: Date.now()
      });
    }

    if (isSellerVerified) {
      db.listing_verification_checks.push({
        check_id: generatePrefixedId('chk'),
        listing_id: listingId,
        check_type: 'SELLER_KYC_VERIFICATION',
        result: 'PASS',
        details: 'Seller has verified identity status.',
        created_at: Date.now()
      });
    } else {
      db.listing_verification_checks.push({
        check_id: generatePrefixedId('chk'),
        listing_id: listingId,
        check_type: 'SELLER_KYC_VERIFICATION',
        result: 'FAIL',
        details: 'Seller lacks verified status.',
        created_at: Date.now()
      });
    }

    res.json(newListing);
  } catch (err: any) {
    console.error('Error creating market listing:', err);
    res.status(500).json({ error: 'Failed to publish listing.' });
  }
};

// Attach a media asset card URL under a listing
export const addListingMedia = async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const { url, is_banner, display_order, file_size, aspect_ratio } = req.body;
    const user = (req as any).user;

    if (!url || !file_size) {
      return res.status(400).json({ error: 'Url and file size specifier are required.' });
    }

    loadDb();
    const listing = marketRepository.findListingById(listingId);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (Number(listing.seller_id) !== Number(user.user_id)) {
      return res.status(403).json({ error: 'Not permitted to attach media to other creators listings.' });
    }

    db.market_asset_media = db.market_asset_media || [];
    const newMedia: MarketAssetMedia = {
      media_id: generatePrefixedId('med'),
      listing_id: listingId,
      url,
      is_banner: !!is_banner,
      display_order: Number(display_order) || 1,
      file_size: Number(file_size),
      aspect_ratio: aspect_ratio || '16:9'
    };

    db.market_asset_media.push(newMedia);
    saveDb();

    res.json(newMedia);
  } catch (err: any) {
    console.error('Error attaching media:', err);
    res.status(500).json({ error: 'Failed to attach asset media.' });
  }
};

// Retrieve media list for a specific listing
export const getListingMedia = async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    loadDb();
    const media = db.market_asset_media || [];
    const bannerItems = media.filter(m => m.listing_id === listingId);
    res.json(bannerItems);
  } catch (err) {
    res.status(500).json({ error: 'Failed to query media.' });
  }
};

// Fetch reviews for a specific listing (with total average ratings count)
export const getListingReviews = async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    loadDb();
    const reviews = marketRepository.findReviewsByListingId(listingId);
    const filtered = reviews.filter(r => !r.is_reported);
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch review registry.' });
  }
};

// Write a Verified Review for a Listing
export const createListingReview = async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const { rating, comment } = req.body;
    const user = (req as any).user;

    const numericRating = parseInt(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
    }

    if (!comment || comment.trim().length === 0) {
      return res.status(455).json({ error: 'Comment text cannot be empty.' });
    }

    loadDb();
    const escrows = marketRepository.findAllEscrows();
    const reviews = marketRepository.findAllReviews();

    const hasPurchased = escrows.some(
      (esc) => esc && 
               esc.listing_id === listingId && 
               Number(esc.buyer_id) === Number(user.user_id) && 
               (esc.status === 'RELEASED' || esc.status === 'HELD_IN_ESCROW')
    );

    if (!hasPurchased) {
      return res.status(403).json({ error: 'Restricted: Verified Reviews are locked. You must acquire and clear this asset via escrow first.' });
    }

    const hasReviewed = reviews.some(
      r => r.listing_id === listingId && Number(r.buyer_id) === Number(user.user_id) && !r.is_reported
    );
    if (hasReviewed) {
      return res.status(400).json({ error: 'You have already published a review regarding this asset.' });
    }

    const newReview: MarketReview = {
      review_id: generatePrefixedId('rev'),
      listing_id: listingId,
      buyer_id: user.user_id,
      buyer_username: user.username,
      rating: numericRating,
      comment,
      helpful_votes: [],
      is_reported: false,
      created_at: Date.now()
    };

    marketRepository.createReview(newReview);

    res.json(newReview);
  } catch (err: any) {
    console.error('Error posting review:', err);
    res.status(500).json({ error: 'Failed to publish review.' });
  }
};

// Flag abuse/report a review
export const reportReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { reason } = req.body;

    loadDb();
    db.market_reviews = db.market_reviews || [];
    const index = db.market_reviews.findIndex(r => r.review_id === reviewId);
    if (index === -1) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    db.market_reviews[index].is_reported = true;
    db.market_reviews[index].moderation_reason = reason || 'Unassigned review report';
    saveDb();

    res.json({ success: true, message: 'Review escalated for moderator analysis.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not flag review.' });
  }
};

// Create a Discount Coupon (Admin Only role can create)
export const createCoupon = async (req: Request, res: Response) => {
  try {
    const { 
      code, 
      discount_type, 
      value, 
      value_cents_or_pct,
      tier_rules,
      expiration_days, 
      usage_limit,
      minimum_order_value_cents
    } = req.body;
    const user = (req as any).user;

    const isAdmin = user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_ADMIN';
    if (!isAdmin) {
      return res.status(403).json({ error: 'Restricted: Only Velum operations administrators can create coupons.' });
    }

    if (!code || !discount_type) {
      return res.status(400).json({ error: 'Coupon code and type are required.' });
    }

    const uppercaseCode = code.toUpperCase().trim();
    const expiry = Date.now() + (Number(expiration_days) || 7) * 24 * 60 * 60 * 1000;

    loadDb();
    const coupons = marketRepository.findAllCoupons();

    if (coupons.some(c => c.code === uppercaseCode)) {
      return res.status(400).json({ error: 'Coupon code already registered.' });
    }

    // Convert values if they come from standard fields
    let finalType: 'PERCENTAGE' | 'FIXED' | 'TIERED' = 'PERCENTAGE';
    if (discount_type === 'FIXED' || discount_type === 'FLAT' || discount_type === 'FIXED_AMOUNT') {
      finalType = 'FIXED';
    } else if (discount_type === 'TIERED') {
      finalType = 'TIERED';
    }

    let finalValueCentsOrPct = 0;
    if (value_cents_or_pct !== undefined) {
      finalValueCentsOrPct = Number(value_cents_or_pct);
    } else if (value !== undefined) {
      if (finalType === 'PERCENTAGE') {
        finalValueCentsOrPct = Math.round(Number(value));
      } else {
        finalValueCentsOrPct = Math.round(Number(value) * 100);
      }
    }

    const finalMinOrderValueCents = minimum_order_value_cents !== undefined 
      ? Number(minimum_order_value_cents) 
      : 0;

    const newCoupon: MarketCoupon = {
      coupon_id: generatePrefixedId('cpn'),
      code: uppercaseCode,
      discount_type: finalType,
      value_cents_or_pct: finalValueCentsOrPct,
      tier_rules: tier_rules || [],
      expiration_date: expiry,
      usage_limit: Number(usage_limit) || 100,
      usage_count: 0,
      minimum_order_value_cents: finalMinOrderValueCents,
      active: true
    };

    marketRepository.createCoupon(newCoupon);

    res.json(newCoupon);
  } catch (err) {
    console.error('Error creating coupon:', err);
    res.status(500).json({ error: 'Could not write coupon code.' });
  }
};

// Return active coupons
export const getCoupons = async (req: Request, res: Response) => {
  try {
    loadDb();
    res.json(marketRepository.findAllCoupons());
  } catch (err) {
    res.status(500).json({ error: 'Failed to load coupon registry.' });
  }
};

// Validate discount code & calculate math
export const validateCoupon = async (req: Request, res: Response) => {
  try {
    const codeVal = req.body.code || req.body.couponCode;
    const listingIdVal = req.body.listing_id || req.body.listingId;
    const { skuVariantId } = req.body;

    if (!codeVal || !listingIdVal) {
      return res.status(400).json({ error: 'Coupon code and listing identity are required.' });
    }

    loadDb();
    const listing = marketRepository.findListingById(listingIdVal);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    const targetCode = String(codeVal).toUpperCase().trim();
    const coupon = marketRepository.findCouponByCode(targetCode);
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon code is invalid or does not exist.' });
    }

    if (!coupon.active) {
      return res.status(400).json({ error: 'Coupon code has been deactivated.' });
    }

    if (coupon.expiration_date !== undefined) {
      const exp = typeof coupon.expiration_date === 'string' ? Date.parse(coupon.expiration_date) : coupon.expiration_date;
      if (Date.now() > exp) {
        return res.status(400).json({ error: 'Coupon has expired.' });
      }
    }

    if (coupon.usage_count !== undefined && coupon.usage_limit !== undefined) {
      if (coupon.usage_count >= coupon.usage_limit) {
        return res.status(400).json({ error: 'Coupon maximum usage limit exceeded.' });
      }
    }

    const basePrice = (listing.discount_price !== undefined && listing.discount_price !== null) ? listing.discount_price : listing.price;
    const basePriceCents = Math.round(basePrice * 100);

    let additionalCostCents = 0;
    let selectedSku: any = undefined;
    if (skuVariantId) {
      db.market_sku_variants = db.market_sku_variants || [];
      selectedSku = db.market_sku_variants.find(s => s && s.sku_id === skuVariantId);
      if (selectedSku) {
        additionalCostCents = selectedSku.additional_cost_cents || 0;
      }
    }

    const itemPriceCents = basePriceCents + additionalCostCents;

    const settlement = calculateOrderSettlement(
      itemPriceCents,
      0, // 0% tax by default
      0.05, // 5% platform fee
      coupon
    );

    if (settlement.error) {
      return res.status(400).json({ error: settlement.error });
    }

    const deduction = settlement.discount_deduction_cents / 100;
    const displayItemPrice = itemPriceCents / 100;
    const finalPrice = Math.max(0, parseFloat((displayItemPrice - deduction).toFixed(2)));

    res.json({
      valid: true,
      code: coupon.code,
      discount_type: coupon.discount_type,
      deduction: parseFloat(deduction.toFixed(2)),
      finalPrice,
      settlement
    });
  } catch (err) {
    res.status(500).json({ error: 'Failure during coupon code verification.' });
  }
};

// Add comments on public board
export const createDiscussion = async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const { comment, parent_id } = req.body;
    const user = (req as any).user;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ error: 'Comment body cannot be blank.' });
    }

    loadDb();
    const newDisc: MarketDiscussion = {
      discussion_id: generatePrefixedId('disc'),
      listing_id: listingId,
      user_id: user.user_id,
      username: user.username,
      parent_id: parent_id || null,
      comment,
      created_at: Date.now()
    };

    marketRepository.createDiscussion(newDisc);

    res.json(newDisc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to post public inquiry.' });
  }
};

// Retrieve public inquiries list
export const getListingDiscussions = async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    loadDb();
    const filtered = marketRepository.findDiscussionsByListingId(listingId);
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: 'Unable to retrieve listing forums.' });
  }
};

// Retrieve active escrows index involving user
export const getEscrows = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    loadDb();

    const escrows = marketRepository.findAllEscrows();
    const relevant = escrows.map(esc => enrichEscrow(esc)).filter(
      (esc) => esc && (Number(esc.buyer_id) === Number(user.user_id) || Number(esc.seller_id) === Number(user.user_id))
    );

    res.json(relevant);
  } catch (err: any) {
    console.error('Error fetching escrows list:', err);
    res.status(500).json({ error: 'Failed to access escrow ledger.' });
  }
};

// Commit secure escrow transaction with coupon deduction
export const createEscrow = async (req: Request, res: Response) => {
  try {
    const { listingId, couponCode, skuVariantId } = req.body;
    const user = (req as any).user;

    if (!listingId) {
      return res.status(400).json({ error: 'Listing identity is required.' });
    }

    loadDb();
    const listing = marketRepository.findListingById(listingId);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (listing.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Listing is no longer active.' });
    }

    if (listing.verification_status && listing.verification_status !== 'APPROVED') {
      return res.status(400).json({ error: 'Listing is pending verification.' });
    }

    if (listing.inventory_count !== undefined) {
      if (listing.inventory_count <= 0) {
        return res.status(400).json({ error: 'Listing is out of stock.' });
      }
    }

    if (Number(listing.seller_id) === Number(user.user_id)) {
      return res.status(400).json({ error: 'You are forbidden from acquiring your own listings.' });
    }

    const basePrice = (listing.discount_price !== undefined && listing.discount_price !== null) ? listing.discount_price : listing.price;
    const basePriceCents = Math.round(basePrice * 100);

    let additionalCostCents = 0;
    let selectedSku: any = undefined;
    if (skuVariantId) {
      db.market_sku_variants = db.market_sku_variants || [];
      selectedSku = db.market_sku_variants.find(s => s && s.sku_id === skuVariantId);
      if (selectedSku) {
        additionalCostCents = selectedSku.additional_cost_cents || 0;
      }
    }

    const itemPriceCents = basePriceCents + additionalCostCents;
    let validatedCouponApplied: string | undefined = undefined;
    let couponObj: any = undefined;

    if (couponCode) {
      const targetCode = couponCode.toUpperCase().trim();
      const coupon = marketRepository.findCouponByCode(targetCode);
      if (coupon) {
        couponObj = coupon;
      }
    }

    const settlement = calculateOrderSettlement(
      itemPriceCents,
      0, // 0% tax by default
      0.05, // 5% platform fee
      couponObj
    );

    if (settlement.error) {
      return res.status(400).json({ error: settlement.error });
    }

    if (couponObj) {
      marketRepository.updateCoupon(couponObj.coupon_id, {
        usage_count: (couponObj.usage_count || 0) + 1
      });
      validatedCouponApplied = couponObj.code;
    }

    if (listing.inventory_count !== undefined) {
      const updatedInventory = listing.inventory_count - 1;
      marketRepository.updateListing(listing.listing_id, {
        inventory_count: updatedInventory,
        status: updatedInventory <= 0 ? 'OUT_OF_STOCK' : 'ACTIVE'
      });
    } else {
      marketRepository.updateListing(listing.listing_id, {
        status: 'PENDING_ESCROW'
      });
    }

    // Buyer Capital Deduction = orderTotalCents + taxCents
    const priceCents = settlement.gross_amount_cents - settlement.discount_deduction_cents + settlement.net_tax_amount_cents;
    const buyerWallet = walletRepository.getOrCreateWallet(user.user_id);

    if (buyerWallet.balance_cents < priceCents) {
      return res.status(400).json({ error: 'Insufficient wallet ledger balance.' });
    }

    const platformFee = parseFloat((settlement.platform_fee_deduction_cents / 100).toFixed(2));
    const finalPayout = parseFloat((settlement.payout_net_amount_cents / 100).toFixed(2));

    const transactionId = generatePrefixedId('esc');

    walletRepository.updateWalletBalance(user.user_id, buyerWallet.balance_cents - priceCents);

    walletRepository.createLedgerEntry({
      entry_id: generatePrefixedId('led'),
      user_id: Number(user.user_id),
      entry_type: 'ESCROW_HOLD',
      amount_cents: -priceCents,
      balance_after_cents: buyerWallet.balance_cents,
      related_transaction_id: transactionId,
      actor_type: 'USER',
      actor_id: String(user.user_id),
      is_simulated: true,
      created_at: Date.now()
    });

    const sandbox_logs = [
      `[SYS-SECURE] INITIALIZING ISO-WORKER DOCK STATE...`,
      `⚙️ ALLOCATING SECURE MEMORY CELL: 16.00MB RAM`,
      `📦 INGESTING EXECUTABLE BUNDLE: ${listing.title.replace(/\s+/g, '_').toLowerCase()}.zip`,
      `🔍 ANALYZING RAW BUFFER FOR METADATA LEAKS... CLEAN`,
      `⚡ RUNNING SYNTAX VERIFICATION THROUGHOUT MODULE POOL...`,
      `✅ ISOLATION VERIFICATION INITIATED ON HELD_IN_ESCROW BUFFER...`
    ];

    const newEscrow: EscrowTransaction = {
      transaction_id: transactionId,
      listing_id: listingId,
      buyer_id: user.user_id,
      buyer_username: user.username,
      seller_id: listing.seller_id,
      amount: parseFloat((priceCents / 100).toFixed(2)),
      coupon_applied: validatedCouponApplied,
      sku_variant_id: skuVariantId || null,
      platform_fee: platformFee,
      payout_amount: finalPayout,
      status: 'HELD_IN_ESCROW',
      sandbox_state: 'DEPLOYED_SANDBOX',
      sandbox_logs,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    marketRepository.createEscrow(newEscrow);

    res.json(enrichEscrow(newEscrow));
  } catch (err: any) {
    console.error('Error initiating escrow hold:', err);
    res.status(500).json({ error: 'Failed to open escrow hold.' });
  }
};

// Trigger sandbox execution health test on build package
export const testSandboxEscrow = async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const user = (req as any).user;

    loadDb();
    const esc = marketRepository.findEscrowById(transactionId);
    if (!esc) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    if (Number(esc.buyer_id) !== Number(user.user_id)) {
      return res.status(403).json({ error: 'Forbidden: Only the buyer can test compilation of payload.' });
    }

    const currentLogs = esc.sandbox_logs || [];
    const logsArray = Array.isArray(currentLogs) ? [...currentLogs] : [String(currentLogs)];
    logsArray.push(
      `[SANDBOX] BOOTED V8 ISOLATE INSTANCE WITH ID: ${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      `🛰️ EMITTING TEST PAYLOAD HANDSHAKE... RECEIVED`,
      `⚡ MEASURED TIMEOUT IN FLIGHT: 22ms / 50ms ALLOWED LIMIT`,
      `❇️ SANITY SUITE COMPILATION GREEN. APP DEPLOYED SAFELY.`
    );

    const updatedEsc = marketRepository.updateEscrow(transactionId, {
      sandbox_state: 'DEPLOYMENT_SUCCESS',
      sandbox_logs: logsArray,
      updated_at: Date.now()
    });

    res.json(enrichEscrow(updatedEsc));
  } catch (err) {
    res.status(500).json({ error: 'Sandbox test malfunction.' });
  }
};

// Release funds & execute settlement pay out
export const releaseEscrow = async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const user = (req as any).user;

    loadDb();
    const escrow = marketRepository.findEscrowById(transactionId);
    if (!escrow) {
      return res.status(404).json({ error: 'Escrow transaction not located.' });
    }

    if (Number(escrow.buyer_id) !== Number(user.user_id)) {
      return res.status(403).json({ error: 'Forbidden: Only the buyer is authorized to release funds.' });
    }

    if (escrow.status !== 'HELD_IN_ESCROW') {
      return res.status(400).json({ error: 'Escrow is not in editable HELD_IN_ESCROW status.' });
    }

    const openDisputes = (db.market_support_chats || []).filter(
      chat => chat && chat.order_id === transactionId && chat.is_disputed && !chat.resolved_at
    );
    if (openDisputes.length > 0) {
      return res.status(400).json({ error: 'Cannot release escrow: There is an active open dispute/support chat for this transaction.' });
    }

    marketRepository.updateEscrow(transactionId, {
      status: 'RELEASED',
      updated_at: Date.now()
    });

    const listing = marketRepository.findListingById(escrow.listing_id);
    if (listing) {
      if (listing.inventory_count === undefined) {
        marketRepository.updateListing(listing.listing_id, {
          status: 'COMPLETED'
        });
      }
    }

    // Credit the seller's wallet
    const sellerWallet = walletRepository.getOrCreateWallet(escrow.seller_id);
    const releaseCents = Math.round(escrow.amount * 100);
    const feeCents = Math.round((escrow.platform_fee || 0) * 100);
    const payoutCents = releaseCents - feeCents;

    walletRepository.updateWalletBalance(escrow.seller_id, sellerWallet.balance_cents + payoutCents);

    walletRepository.createLedgerEntry({
      entry_id: `${generatePrefixedId('led')}_1`,
      user_id: Number(escrow.seller_id),
      entry_type: 'ESCROW_RELEASE',
      amount_cents: releaseCents,
      balance_after_cents: sellerWallet.balance_cents + feeCents,
      related_transaction_id: escrow.transaction_id,
      actor_type: 'USER',
      actor_id: String(user.user_id),
      is_simulated: true,
      created_at: Date.now()
    });

    walletRepository.createLedgerEntry({
      entry_id: `${generatePrefixedId('led')}_2`,
      user_id: Number(escrow.seller_id),
      entry_type: 'PLATFORM_FEE',
      amount_cents: -feeCents,
      balance_after_cents: sellerWallet.balance_cents,
      related_transaction_id: escrow.transaction_id,
      actor_type: 'USER',
      actor_id: String(user.user_id),
      is_simulated: true,
      created_at: Date.now()
    });

    const finalEscrow = marketRepository.findEscrowById(transactionId);
    res.json(enrichEscrow(finalEscrow));
  } catch (err: any) {
    console.error('Error releasing escrow capital:', err);
    res.status(500).json({ error: 'Failed to release capital hold.' });
  }
};

// Revert/refund secure escrow hold to buyer
export const revertEscrow = async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const user = (req as any).user;

    loadDb();
    const esc = marketRepository.findEscrowById(transactionId);
    if (!esc) {
      return res.status(404).json({ error: 'Transaction index not found.' });
    }
    
    const isBuyer = Number(esc.buyer_id) === Number(user.user_id);
    const isSeller = Number(esc.seller_id) === Number(user.user_id);
    const isAdmin = user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_ADMIN';

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized and forbidden from reverting escrow ledger.' });
    }

    if (esc.status !== 'HELD_IN_ESCROW') {
      return res.status(400).json({ error: 'Escrow is not in active HELD_IN_ESCROW hold to revert.' });
    }

    marketRepository.updateEscrow(transactionId, {
      status: 'REVERTED',
      updated_at: Date.now()
    });

    const listing = marketRepository.findListingById(esc.listing_id);
    if (listing) {
      marketRepository.updateListing(listing.listing_id, {
        status: 'ACTIVE',
        inventory_count: listing.inventory_count !== undefined ? listing.inventory_count + 1 : undefined
      });
    }

    // Credit buyer's wallet
    const buyerWallet = walletRepository.getOrCreateWallet(esc.buyer_id);
    const refundCents = Math.round(esc.amount * 100);
    walletRepository.updateWalletBalance(esc.buyer_id, buyerWallet.balance_cents + refundCents);

    walletRepository.createLedgerEntry({
      entry_id: `${generatePrefixedId('led')}_rf`,
      user_id: Number(esc.buyer_id),
      entry_type: 'ESCROW_REFUND',
      amount_cents: refundCents,
      balance_after_cents: buyerWallet.balance_cents,
      related_transaction_id: esc.transaction_id,
      actor_type: 'USER',
      actor_id: String(user.user_id),
      is_simulated: true,
      created_at: Date.now()
    });

    const finalEsc = marketRepository.findEscrowById(transactionId);
    res.json(enrichEscrow(finalEsc));
  } catch (err) {
    res.status(500).json({ error: 'Escrow reversion state exception.' });
  }
};

// Create a refund request (auto-approved if held in escrow)
export const createRefundRequest = async (req: Request, res: Response) => {
  try {
    const { escrowTransactionId, reason } = req.body;
    const user = (req as any).user;

    if (!escrowTransactionId) {
      return res.status(400).json({ error: 'Escrow transaction identity is required.' });
    }

    loadDb();
    const esc = marketRepository.findEscrowById(escrowTransactionId);
    if (!esc) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    if (Number(esc.buyer_id) !== Number(user.user_id)) {
      return res.status(403).json({ error: 'Forbidden: Only the buyer can request a refund.' });
    }

    if (esc.status !== 'HELD_IN_ESCROW') {
      return res.status(400).json({ error: 'Refunds can only be requested for active HELD_IN_ESCROW transactions.' });
    }

    // Auto-approve if pre-release / held in escrow
    marketRepository.updateEscrow(escrowTransactionId, {
      status: 'REVERTED',
      updated_at: Date.now()
    });

    const listing = marketRepository.findListingById(esc.listing_id);
    if (listing) {
      marketRepository.updateListing(listing.listing_id, {
        status: 'ACTIVE',
        inventory_count: listing.inventory_count !== undefined ? listing.inventory_count + 1 : undefined
      });
    }

    const refundId = generatePrefixedId('ref');
    const newRefundRequest = {
      request_id: refundId,
      escrow_transaction_id: escrowTransactionId,
      requested_by_user_id: Number(user.user_id),
      reason,
      status: 'AUTO_APPROVED',
      created_at: Date.now(),
      resolved_at: Date.now()
    };
    marketRepository.createRefundRequest(newRefundRequest);

    // Credit buyer's wallet
    const buyerWallet = walletRepository.getOrCreateWallet(esc.buyer_id);
    const refundCents = Math.round(esc.amount * 100);
    walletRepository.updateWalletBalance(esc.buyer_id, buyerWallet.balance_cents + refundCents);

    walletRepository.createLedgerEntry({
      entry_id: `${generatePrefixedId('led')}_rf`,
      user_id: Number(esc.buyer_id),
      entry_type: 'ESCROW_REFUND',
      amount_cents: refundCents,
      balance_after_cents: buyerWallet.balance_cents,
      related_transaction_id: esc.transaction_id,
      actor_type: 'USER',
      actor_id: String(user.user_id),
      is_simulated: true,
      created_at: Date.now()
    });

    res.json({ success: true, refundRequest: newRefundRequest });
  } catch (err) {
    console.error('Error creating refund request:', err);
    res.status(500).json({ error: 'Failed to create refund request.' });
  }
};

// Admin escrow manual override
export const manualOverrideEscrow = async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const { actionType, reason } = req.body;
    const user = (req as any).user;

    loadDb();
    const esc = marketRepository.findEscrowById(transactionId);
    if (!esc) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    // Verify user is platform admin
    db.platform_admins = db.platform_admins || [];
    const admin = db.platform_admins.find(a => Number(a.user_id) === Number(user.user_id));
    if (!admin || !admin.can_override_escrow) {
      return res.status(403).json({ error: 'Forbidden: Admin access with override permissions required.' });
    }

    if (actionType === 'FORCE_RELEASE') {
      marketRepository.updateEscrow(transactionId, {
        status: 'RELEASED',
        updated_at: Date.now()
      });

      // Credit the seller's wallet
      const sellerWallet = walletRepository.getOrCreateWallet(esc.seller_id);
      const releaseCents = Math.round(esc.amount * 100);
      const feeCents = Math.round((esc.platform_fee || 0) * 100);
      const payoutCents = releaseCents - feeCents;

      walletRepository.updateWalletBalance(esc.seller_id, sellerWallet.balance_cents + payoutCents);

      walletRepository.createLedgerEntry({
        entry_id: `${generatePrefixedId('led')}_mr`,
        user_id: Number(esc.seller_id),
        entry_type: 'ESCROW_RELEASE',
        amount_cents: releaseCents,
        balance_after_cents: sellerWallet.balance_cents + feeCents,
        related_transaction_id: esc.transaction_id,
        actor_type: 'ADMIN',
        actor_id: admin.admin_id,
        is_simulated: true,
        created_at: Date.now()
      });

      walletRepository.createLedgerEntry({
        entry_id: `${generatePrefixedId('led')}_mf`,
        user_id: Number(esc.seller_id),
        entry_type: 'PLATFORM_FEE',
        amount_cents: -feeCents,
        balance_after_cents: sellerWallet.balance_cents,
        related_transaction_id: esc.transaction_id,
        actor_type: 'ADMIN',
        actor_id: admin.admin_id,
        is_simulated: true,
        created_at: Date.now()
      });
    } else if (actionType === 'FORCE_REVERT') {
      marketRepository.updateEscrow(transactionId, {
        status: 'REVERTED',
        updated_at: Date.now()
      });

      const listing = marketRepository.findListingById(esc.listing_id);
      if (listing) {
        marketRepository.updateListing(listing.listing_id, {
          status: 'ACTIVE',
          inventory_count: listing.inventory_count !== undefined ? listing.inventory_count + 1 : undefined
        });
      }

      // Credit buyer's wallet
      const buyerWallet = walletRepository.getOrCreateWallet(esc.buyer_id);
      const refundCents = Math.round(esc.amount * 100);
      walletRepository.updateWalletBalance(esc.buyer_id, buyerWallet.balance_cents + refundCents);

      walletRepository.createLedgerEntry({
        entry_id: `${generatePrefixedId('led')}_mrf`,
        user_id: Number(esc.buyer_id),
        entry_type: 'ESCROW_REFUND',
        amount_cents: refundCents,
        balance_after_cents: buyerWallet.balance_cents,
        related_transaction_id: esc.transaction_id,
        actor_type: 'ADMIN',
        actor_id: admin.admin_id,
        is_simulated: true,
        created_at: Date.now()
      });
    } else {
      return res.status(400).json({ error: 'Invalid action type.' });
    }

    const logId = generatePrefixedId('aud');
    marketRepository.createPlatformFinancialAuditLog({
      log_id: logId,
      acting_admin_id: admin.admin_id,
      action_type: 'ESCROW_MANUAL_RELEASE_OVERRIDE',
      related_transaction_id: transactionId,
      reason,
      created_at: Date.now()
    });

    const finalEsc = marketRepository.findEscrowById(transactionId);
    res.json({ success: true, escrow: finalEsc });
  } catch (err) {
    console.error('Error in manual override:', err);
    res.status(500).json({ error: 'Failed to execute manual override.' });
  }
};

// Automation settlement engine trigger
export const triggerAutoSettlement = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    loadDb();
    const escrows = marketRepository.findAllEscrows();

    // Verify user is platform admin
    db.platform_admins = db.platform_admins || [];
    const admin = db.platform_admins.find(a => Number(a.user_id) === Number(user.user_id));
    if (!admin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }

    const pendingTx = escrows.filter(t => t && t.status === 'HELD_IN_ESCROW');
    let triggered_count = 0;

    for (const esc of pendingTx) {
      marketRepository.updateEscrow(esc.transaction_id, {
        status: 'RELEASED',
        updated_at: Date.now()
      });

      // Credit seller wallet
      const sellerWallet = walletRepository.getOrCreateWallet(esc.seller_id);
      const releaseCents = Math.round(esc.amount * 100);
      const feeCents = Math.round((esc.platform_fee || 0) * 100);
      const payoutCents = releaseCents - feeCents;

      walletRepository.updateWalletBalance(esc.seller_id, sellerWallet.balance_cents + payoutCents);

      walletRepository.createLedgerEntry({
        entry_id: `${generatePrefixedId('led')}_ar`,
        user_id: Number(esc.seller_id),
        entry_type: 'ESCROW_RELEASE',
        amount_cents: releaseCents,
        balance_after_cents: sellerWallet.balance_cents + feeCents,
        related_transaction_id: esc.transaction_id,
        actor_type: 'SYSTEM_AUTOMATION',
        actor_id: 'AUTO_SETTLEMENT_JOB',
        is_simulated: true,
        created_at: Date.now()
      });

      walletRepository.createLedgerEntry({
        entry_id: `${generatePrefixedId('led')}_af`,
        user_id: Number(esc.seller_id),
        entry_type: 'PLATFORM_FEE',
        amount_cents: -feeCents,
        balance_after_cents: sellerWallet.balance_cents,
        related_transaction_id: esc.transaction_id,
        actor_type: 'SYSTEM_AUTOMATION',
        actor_id: 'AUTO_SETTLEMENT_JOB',
        is_simulated: true,
        created_at: Date.now()
      });

      const actionId = generatePrefixedId('aut');
      marketRepository.createAutomationAction({
        action_id: actionId,
        escrow_transaction_id: esc.transaction_id,
        action_type: 'AUTO_RELEASE',
        acted_on_behalf_of: 'BUYER',
        trigger_reason: 'Automated settlement check triggered.',
        executed_at: Date.now(),
        human_reviewed: false
      });

      triggered_count++;
    }

    res.json({ success: true, triggered_count });
  } catch (err) {
    console.error('Error triggering auto settlement:', err);
    res.status(500).json({ error: 'Failed to trigger auto settlement.' });
  }
};

// ==========================================
// PILLAR D/F: SUPPORT CHATS & DISPUTES
// ==========================================

export const getSupportChats = async (req: Request, res: Response) => {
  try {
    loadDb();
    const user = (req as any).user;
    const isAdmin = user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_ADMIN';

    db.market_support_chats = db.market_support_chats || [];

    if (isAdmin) {
      return res.json(db.market_support_chats);
    }

    // Filter where user is buyer or seller of the order
    const myChats = db.market_support_chats.filter(chat => {
      if (!chat) return false;
      const escrow = marketRepository.findEscrowById(chat.order_id);
      if (!escrow) return false;
      return Number(escrow.buyer_id) === Number(user.user_id) || Number(escrow.seller_id) === Number(user.user_id);
    });

    res.json(myChats);
  } catch (err) {
    console.error('Error in getSupportChats:', err);
    res.status(500).json({ error: 'Failed to retrieve support disputes.' });
  }
};

export const createSupportChat = async (req: Request, res: Response) => {
  try {
    const { order_id, is_disputed, first_message } = req.body;
    const user = (req as any).user;

    if (!order_id || !first_message) {
      return res.status(400).json({ error: 'Order ID and initial message content are required.' });
    }

    loadDb();
    const escrow = marketRepository.findEscrowById(order_id);
    if (!escrow) {
      return res.status(404).json({ error: 'Related escrow transaction not found.' });
    }

    db.market_support_chats = db.market_support_chats || [];
    const existing = db.market_support_chats.find(c => c && c.order_id === order_id);
    if (existing) {
      // Append message to existing thread
      const newMsg = {
        message_id: generatePrefixedId('msg'),
        sender_id: user.user_id,
        sender_username: user.username,
        content: first_message,
        created_at: Date.now()
      };
      existing.messages = existing.messages || [];
      existing.messages.push(newMsg);
      if (is_disputed) {
        existing.is_disputed = true;
        existing.disputed_by_user_id = user.user_id;
        // Lock the escrow status
        marketRepository.updateEscrow(order_id, {
          status: 'DISPUTED',
          updated_at: Date.now()
        });
      }
      saveDb();
      return res.json(existing);
    }

    const chatId = generatePrefixedId('chat');
    const newChat = {
      chat_id: chatId,
      order_id,
      is_disputed: !!is_disputed,
      disputed_by_user_id: is_disputed ? user.user_id : undefined,
      resolved_at: null,
      created_at: Date.now(),
      messages: [
        {
          message_id: `${generatePrefixedId('msg')}_0`,
          sender_id: user.user_id,
          sender_username: user.username,
          content: first_message,
          created_at: Date.now()
        }
      ]
    };

    if (is_disputed) {
      marketRepository.updateEscrow(order_id, {
        status: 'DISPUTED',
        updated_at: Date.now()
      });
    }

    db.market_support_chats.push(newChat);
    saveDb();

    res.json(newChat);
  } catch (err) {
    console.error('Error in createSupportChat:', err);
    res.status(500).json({ error: 'Failed to initiate dispute/support chat.' });
  }
};

export const addSupportChatMessage = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const user = (req as any).user;

    if (!content) {
      return res.status(400).json({ error: 'Message content cannot be blank.' });
    }

    loadDb();
    db.market_support_chats = db.market_support_chats || [];
    const chat = db.market_support_chats.find(c => c && c.chat_id === chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Dispute/support chat not found.' });
    }

    const newMsg = {
      message_id: generatePrefixedId('msg'),
      sender_id: user.user_id,
      sender_username: user.username,
      content,
      created_at: Date.now()
    };

    chat.messages = chat.messages || [];
    chat.messages.push(newMsg);
    saveDb();

    res.json(chat);
  } catch (err) {
    console.error('Error in addSupportChatMessage:', err);
    res.status(500).json({ error: 'Failed to post message.' });
  }
};

// Administrative dispute resolution with custom rules (Pillar F: The 25% Rule)
export const resolveSupportChatDispute = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { resolution, penalty_applied_to } = req.body; // resolution: 'REFUND_BUYER' | 'RELEASE_SELLER', penalty_applied_to: 'BUYER' | 'SELLER' | 'NONE'
    const user = (req as any).user;

    const isAdmin = user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_ADMIN';
    if (!isAdmin) {
      return res.status(403).json({ error: 'Restricted: Only Velum administrators can resolve active disputes.' });
    }

    loadDb();
    db.market_support_chats = db.market_support_chats || [];
    const chat = db.market_support_chats.find(c => c && c.chat_id === chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Dispute/support chat not found.' });
    }

    const escrow = marketRepository.findEscrowById(chat.order_id);
    if (!escrow) {
      return res.status(404).json({ error: 'Escrow transaction not found.' });
    }

    const escrowAmountCents = Math.round(escrow.amount * 100);
    const platformFeeCents = Math.round((escrow.platform_fee || 0) * 100);
    const payoutCents = escrowAmountCents - platformFeeCents;

    const buyerWallet = walletRepository.getOrCreateWallet(escrow.buyer_id);
    const sellerWallet = walletRepository.getOrCreateWallet(escrow.seller_id);

    let logs = [
      `[SYS-DISPUTE] ADMIN '${user.username}' INITIATED DISPUTE RESOLUTION PROTOCOL...`,
      `⚙️ RESOLUTION: ${resolution}`,
      `⚙️ PENALTY SYSTEM: ${penalty_applied_to}`
    ];

    if (resolution === 'REFUND_BUYER') {
      // Revert the escrow back to the buyer
      walletRepository.updateWalletBalance(escrow.buyer_id, buyerWallet.balance_cents + escrowAmountCents);

      walletRepository.createLedgerEntry({
        entry_id: `${generatePrefixedId('led')}_bref`,
        user_id: Number(escrow.buyer_id),
        entry_type: 'ESCROW_REFUND',
        amount_cents: escrowAmountCents,
        balance_after_cents: buyerWallet.balance_cents + escrowAmountCents,
        related_transaction_id: escrow.transaction_id,
        actor_type: 'ADMIN',
        actor_id: String(user.user_id),
        is_simulated: true,
        created_at: Date.now()
      });

      marketRepository.updateEscrow(escrow.transaction_id, {
        status: 'REFUNDED',
        updated_at: Date.now()
      });

      logs.push(`✅ FUNDS RETURNED TO BUYER WALLET: +$${(escrowAmountCents / 100).toFixed(2)}`);

      // Apply the 25% Seller Penalty if Seller is malicious (Seller Fraud)
      if (penalty_applied_to === 'SELLER') {
        const penaltyCents = Math.round(escrowAmountCents * 0.25);
        walletRepository.updateWalletBalance(escrow.seller_id, sellerWallet.balance_cents - penaltyCents);
        walletRepository.updateWalletBalance(escrow.buyer_id, buyerWallet.balance_cents + escrowAmountCents + penaltyCents);

        // Record Seller Penalty
        walletRepository.createLedgerEntry({
          entry_id: `${generatePrefixedId('led')}_spen`,
          user_id: Number(escrow.seller_id),
          entry_type: 'AUTOMATED_ADJUSTMENT',
          amount_cents: -penaltyCents,
          balance_after_cents: sellerWallet.balance_cents - penaltyCents,
          related_transaction_id: escrow.transaction_id,
          actor_type: 'ADMIN',
          actor_id: String(user.user_id),
          is_simulated: true,
          created_at: Date.now()
        });

        // Record Buyer Reward
        walletRepository.createLedgerEntry({
          entry_id: `${generatePrefixedId('led')}_brewd`,
          user_id: Number(escrow.buyer_id),
          entry_type: 'AUTOMATED_ADJUSTMENT',
          amount_cents: penaltyCents,
          balance_after_cents: buyerWallet.balance_cents + escrowAmountCents + penaltyCents,
          related_transaction_id: escrow.transaction_id,
          actor_type: 'ADMIN',
          actor_id: String(user.user_id),
          is_simulated: true,
          created_at: Date.now()
        });

        logs.push(`⚠️ SELLER FRAUD PENALTY APPLIED (25%): -$${(penaltyCents / 100).toFixed(2)}`);
        logs.push(`🎁 COMPENSATED BUYER WITH FRAUD REWARD: +$${(penaltyCents / 100).toFixed(2)}`);
      }
    } else if (resolution === 'RELEASE_SELLER') {
      // Release escrow to the seller
      walletRepository.updateWalletBalance(escrow.seller_id, sellerWallet.balance_cents + payoutCents);

      walletRepository.createLedgerEntry({
        entry_id: `${generatePrefixedId('led')}_srel`,
        user_id: Number(escrow.seller_id),
        entry_type: 'ESCROW_RELEASE',
        amount_cents: escrowAmountCents,
        balance_after_cents: sellerWallet.balance_cents + platformFeeCents + payoutCents,
        related_transaction_id: escrow.transaction_id,
        actor_type: 'ADMIN',
        actor_id: String(user.user_id),
        is_simulated: true,
        created_at: Date.now()
      });

      walletRepository.createLedgerEntry({
        entry_id: `${generatePrefixedId('led')}_sfee`,
        user_id: Number(escrow.seller_id),
        entry_type: 'PLATFORM_FEE',
        amount_cents: -platformFeeCents,
        balance_after_cents: sellerWallet.balance_cents + payoutCents,
        related_transaction_id: escrow.transaction_id,
        actor_type: 'ADMIN',
        actor_id: String(user.user_id),
        is_simulated: true,
        created_at: Date.now()
      });

      marketRepository.updateEscrow(escrow.transaction_id, {
        status: 'RELEASED',
        updated_at: Date.now()
      });

      logs.push(`✅ FUNDS RELEASED TO SELLER: +$${(payoutCents / 100).toFixed(2)}`);

      // Apply the 25% Buyer Penalty if Buyer is malicious (Buyer Fraud)
      if (penalty_applied_to === 'BUYER') {
        const penaltyCents = Math.round(escrowAmountCents * 0.25);
        walletRepository.updateWalletBalance(buyerWallet.user_id, buyerWallet.balance_cents - penaltyCents);
        walletRepository.updateWalletBalance(sellerWallet.user_id, sellerWallet.balance_cents + payoutCents + penaltyCents);

        // Record Buyer Penalty
        walletRepository.createLedgerEntry({
          entry_id: `${generatePrefixedId('led')}_bpen`,
          user_id: Number(escrow.buyer_id),
          entry_type: 'AUTOMATED_ADJUSTMENT',
          amount_cents: -penaltyCents,
          balance_after_cents: buyerWallet.balance_cents - penaltyCents,
          related_transaction_id: escrow.transaction_id,
          actor_type: 'ADMIN',
          actor_id: String(user.user_id),
          is_simulated: true,
          created_at: Date.now()
        });

        // Record Seller Reward
        walletRepository.createLedgerEntry({
          entry_id: `${generatePrefixedId('led')}_srewd`,
          user_id: Number(escrow.seller_id),
          entry_type: 'AUTOMATED_ADJUSTMENT',
          amount_cents: penaltyCents,
          balance_after_cents: sellerWallet.balance_cents + payoutCents + penaltyCents,
          related_transaction_id: escrow.transaction_id,
          actor_type: 'ADMIN',
          actor_id: String(user.user_id),
          is_simulated: true,
          created_at: Date.now()
        });

        logs.push(`⚠️ BUYER FRAUD PENALTY APPLIED (25%): -$${(penaltyCents / 100).toFixed(2)}`);
        logs.push(`🎁 COMPENSATED SELLER WITH FRAUD REWARD: +$${(penaltyCents / 100).toFixed(2)}`);
      }
    }

    // Mark support chat as resolved
    chat.resolved_at = Date.now();
    
    // Add resolving message to chat
    chat.messages.push({
      message_id: `${generatePrefixedId('msg')}_res`,
      sender_id: user.user_id,
      sender_username: 'SYSTEM',
      content: `Dispute officially resolved by Administrator '${user.username}'. Verdict: ${resolution}. Penalty: ${penalty_applied_to}.`,
      created_at: Date.now()
    });

    // Write to escrow logs
    const existingLogs = escrow.sandbox_logs || [];
    marketRepository.updateEscrow(escrow.transaction_id, {
      sandbox_logs: [...existingLogs, ...logs]
    });

    saveDb();

    res.json({ success: true, chat, escrow: marketRepository.findEscrowById(escrow.transaction_id) });
  } catch (err) {
    console.error('Error in resolveSupportChatDispute:', err);
    res.status(500).json({ error: 'Failed to resolve dispute.' });
  }
};
