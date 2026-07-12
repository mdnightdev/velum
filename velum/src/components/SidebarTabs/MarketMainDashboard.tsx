import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, ShieldCheck, Clock, ShieldAlert, Plus, 
  Star, MessageSquare, Tag, Terminal, Play, RotateCcw,
  X, Check, AlertTriangle, Shield, Heart, ArrowRight
} from 'lucide-react';
import { 
  MarketListing, 
  EscrowTransaction, 
  MarketAssetMedia, 
  MarketReview, 
  MarketCoupon, 
  MarketDiscussion 
} from '../../types';
import EscrowTransactionCard from '../EscrowTransactionCard';

interface MarketMainDashboardProps {
  currentUserId: number;
  currentUserRole: string;
  isDark?: boolean;
}

export default function MarketMainDashboard({
  currentUserId,
  currentUserRole,
  isDark = true
}: MarketMainDashboardProps) {
  // State layers
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [escrows, setEscrows] = useState<EscrowTransaction[]>([]);
  const [selectedListing, setSelectedListing] = useState<MarketListing | null>(null);

  // Listing creation form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Inspector States
  const [listingMedia, setListingMedia] = useState<MarketAssetMedia[]>([]);
  const [listingReviews, setListingReviews] = useState<MarketReview[]>([]);
  const [listingDiscussions, setListingDiscussions] = useState<MarketDiscussion[]>([]);

  // Post Review & Question states
  const [newRating, setNewRating] = useState<number>(5);
  const [newReviewComment, setNewReviewComment] = useState('');
  const [newQuestionComment, setNewQuestionComment] = useState('');
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [replyComment, setReplyComment] = useState('');

  // Coupon promo state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');

  // Admin coupon form state
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponType, setNewCouponType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [newCouponValue, setNewCouponValue] = useState('');
  const [newCouponLimit, setNewCouponLimit] = useState('50');
  const [showCouponCreator, setShowCouponCreator] = useState(false);
  const [coupons, setCoupons] = useState<MarketCoupon[]>([]);

  // Page interaction states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutListing, setCheckoutListing] = useState<MarketListing | null>(null);

  const fetchSessionId = () => sessionStorage.getItem('velum-sessionId') || '';

  const loadMarket = async () => {
    try {
      const sId = fetchSessionId();
      const headers = { 'Authorization': `Bearer ${sId}` };
      const [listingsRes, escrowsRes, couponsRes] = await Promise.all([
        fetch('/api/marketplace/listings', { headers }),
        fetch('/api/marketplace/escrows', { headers }),
        fetch('/api/marketplace/coupons', { headers })
      ]);

      if (listingsRes.ok) {
        setListings(await listingsRes.json());
      }
      if (escrowsRes.ok) {
        setEscrows(await escrowsRes.json());
      }
      if (couponsRes.ok) {
        setCoupons(await couponsRes.json());
      }
    } catch (err) {
      console.warn('Sync issue in marketplace loading:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarket();
    const interval = setInterval(loadMarket, 8000);
    return () => clearInterval(interval);
  }, []);

  // Detailed view sync (fetch reviews, media, discussions)
  const syncInspectDetails = async (listingId: string) => {
    try {
      const sId = fetchSessionId();
      const headers = { 'Authorization': `Bearer ${sId}` };
      const [mediaRes, reviewsRes, discussionsRes] = await Promise.all([
        fetch(`/api/marketplace/listings/${listingId}/media`, { headers }),
        fetch(`/api/marketplace/listings/${listingId}/reviews`, { headers }),
        fetch(`/api/marketplace/listings/${listingId}/discussions`, { headers })
      ]);

      if (mediaRes.ok) setListingMedia(await mediaRes.json());
      if (reviewsRes.ok) setListingReviews(await reviewsRes.json());
      if (discussionsRes.ok) setListingDiscussions(await discussionsRes.json());
    } catch (err) {
      console.warn('Inspection details error:', err);
    }
  };

  // Inspect selection handler
  useEffect(() => {
    if (selectedListing) {
      syncInspectDetails(selectedListing.listing_id);
      const subInterval = setInterval(() => {
        syncInspectDetails(selectedListing.listing_id);
      }, 5000);
      return () => clearInterval(subInterval);
    }
  }, [selectedListing]);

  // Create Storefront Listing Action
  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price) return;
    setIsSubmitting(true);

    try {
      const sId = fetchSessionId();
      const res = await fetch('/api/marketplace/listings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          description,
          price: parseFloat(price),
          discount_price: discountPrice ? parseFloat(discountPrice) : undefined
        })
      });

      if (res.ok) {
        const created: MarketListing = await res.json();
        
        // Optionally upload initial media banner link
        if (mediaUrl.trim()) {
          await fetch(`/api/marketplace/listings/${created.listing_id}/media`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${sId}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url: mediaUrl,
              is_banner: true,
              display_order: 1,
              file_size: 409600, // 400KB simulated
              aspect_ratio: '16:9'
            })
          });
        }

        setTitle('');
        setDescription('');
        setPrice('');
        setDiscountPrice('');
        setMediaUrl('');
        setShowCreate(false);
        loadMarket();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create listing');
      }
    } catch (err) {
      alert('Network handshake exception while creating listing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create coupons (Admin-Only Action)
  const handleCreateAdminCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode || !newCouponValue) return;

    try {
      const sId = fetchSessionId();
      const res = await fetch('/api/marketplace/coupons', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: newCouponCode,
          discount_type: newCouponType,
          value: parseFloat(newCouponValue),
          expiration_days: 7,
          usage_limit: parseInt(newCouponLimit) || 100
        })
      });

      if (res.ok) {
        setNewCouponCode('');
        setNewCouponValue('');
        setShowCouponCreator(false);
        loadMarket();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to allocate coupon code');
      }
    } catch (e) {
      alert('Database conflict while writing discount code.');
    }
  };

  // Validate applied coupon
  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !checkoutListing) return;
    setCouponError('');
    try {
      const sId = fetchSessionId();
      const res = await fetch('/api/marketplace/coupons/validate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: couponCode,
          listing_id: checkoutListing.listing_id
        })
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        setAppliedCoupon(data);
      } else {
        setCouponError(data.error || 'Invalid or expired discount code.');
        setAppliedCoupon(null);
      }
    } catch (e) {
      setCouponError('Network error checking coupon validity.');
    }
  };

  // Checkout submit -> Create escrow holding transaction
  const handleConfirmCheckoutAndEscrow = async () => {
    if (!checkoutListing) return;
    try {
      const sId = fetchSessionId();
      const res = await fetch('/api/marketplace/escrows', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          listingId: checkoutListing.listing_id,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined
        })
      });

      if (res.ok) {
        setCheckoutListing(null);
        setAppliedCoupon(null);
        setCouponCode('');
        loadMarket();
        alert('Secure hold initialized safely. Funds locked in escrow container.');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to initiate escrow contract.');
      }
    } catch (err) {
      alert('Escrow initialization failure.');
    }
  };

  // Run secure sandbox health test simulation (Pillar F)
  const handleRunSandboxTest = async (transactionId: string) => {
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/marketplace/escrows/${transactionId}/test-sandbox`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        loadMarket();
      }
    } catch (e) {
      alert('Network error compiling isolated sandbox build.');
    }
  };

  // Release Escrow funds to seller after complete verify
  const handleReleaseEscrow = async (transactionId: string) => {
    if (!confirm('Release locked capital to the publisher? This transaction clears escrow permanently.')) return;
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/marketplace/escrows/${transactionId}/release`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        loadMarket();
        alert('Verification complete. Capital deployed to developer account.');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to release capital from hold.');
      }
    } catch (e) {
      alert('Platform clearing error.');
    }
  };

  // Revert/Refunding escrow funds
  const handleRevertEscrow = async (transactionId: string) => {
    if (!confirm('Are you secure in canceling this deployment task? Backed capital is returned entirely.')) return;
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/marketplace/escrows/${transactionId}/revert`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        loadMarket();
        alert('Escrow reverted successfully. Capital returned to buy pool balance.');
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to revert escrow.');
      }
    } catch (e) {
      alert('Reversion pipeline issue.');
    }
  };

  // Publish a review (Pillar B reputation)
  const handlePostReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing || !newReviewComment.trim()) return;

    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/marketplace/listings/${selectedListing.listing_id}/reviews`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rating: newRating,
          comment: newReviewComment
        })
      });

      if (res.ok) {
        setNewReviewComment('');
        setNewRating(5);
        syncInspectDetails(selectedListing.listing_id);
        loadMarket();
        alert('Verified buyer review posted successfully to reputation index.');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to submit review. Ensure you purchased this asset first.');
      }
    } catch (err) {
      alert('Handshake failure while uploading rating.');
    }
  };

  // Flag review
  const handleFlagReview = async (reviewId: string) => {
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/marketplace/reviews/${reviewId}/report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'Inappropriate or non-functional rating.' })
      });
      if (res.ok) {
        alert('Review flagged for administrative screening.');
        if (selectedListing) syncInspectDetails(selectedListing.listing_id);
      }
    } catch (e) {
      alert('Audit report pipeline failure.');
    }
  };

  // Post Pre-sale public forum inquiry
  const handlePostQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing || !newQuestionComment.trim()) return;

    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/marketplace/listings/${selectedListing.listing_id}/discussions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          comment: newQuestionComment,
          parent_id: null
        })
      });

      if (res.ok) {
        setNewQuestionComment('');
        syncInspectDetails(selectedListing.listing_id);
      }
    } catch (err) {
      alert('Discussion board posting error.');
    }
  };

  // Thread reply
  const handlePostReply = async (parentId: string) => {
    if (!selectedListing || !replyComment.trim()) return;

    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/marketplace/listings/${selectedListing.listing_id}/discussions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          comment: replyComment,
          parent_id: parentId
        })
      });

      if (res.ok) {
        setReplyComment('');
        setReplyParentId(null);
        syncInspectDetails(selectedListing.listing_id);
      }
    } catch (err) {
      alert('Inquiry thread response failure.');
    }
  };

  return (
    <div id="market_dashboard" className="flex-1 overflow-y-auto bg-velum-900 p-6 lg:p-8 space-y-7 text-text-primary">
      
      {/* MODULE HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white-5 pb-5 gap-4">
        <div>
          <span className="text-[9px] font-mono font-black text-accent tracking-widest uppercase block">VELUM COMMERCIAL PROTOCOL</span>
          <h1 className="text-xl font-sans font-black tracking-tight text-white mt-1">
            Autonomous Digital Marketplace
          </h1>
          <p className="text-[10px] text-text-secondary font-mono mt-1">
            SECURE DECLUSTERED P2P ESCROW CLEARINGHOUSE
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          {/* Coupon Code allocation triggers */}
          {(currentUserRole === 'CLI_ADMIN' || currentUserRole === 'LOGIN_ADMIN' || currentUserRole === 'SUPPORT_ADMIN') && (
            <button
              onClick={() => setShowCouponCreator(!showCouponCreator)}
              className="px-3.5 py-1.5 border border-white-5 hover:border-accent/20 bg-text-primary/[0.01] hover:bg-accent/5 rounded-xl text-[10px] font-bold uppercase text-accent font-sans tracking-wide transition cursor-pointer"
            >
              🎟️ Admin Coupon Hub
            </button>
          )}

          <button
            id="toggle_create_listing_btn"
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-velum-900 text-[10px] font-extrabold uppercase py-2 px-4 rounded-xl transition cursor-pointer font-sans tracking-wider"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showCreate ? 'Close Form' : 'Advertise Asset'}</span>
          </button>
        </div>
      </div>

      {/* COUPON CREATOR POPUP */}
      {showCouponCreator && (
        <form onSubmit={handleCreateAdminCoupon} className="bg-velum-850 border border-accent/20 p-5 rounded-xl space-y-4 max-w-xl">
          <div className="flex justify-between items-center pb-2 border-b border-white-5">
            <span className="text-[10px] font-mono font-bold text-accent uppercase">ALLOCATE DYNAMIC CAMPAIGN COUPON</span>
            <button type="button" onClick={() => setShowCouponCreator(false)} className="text-text-secondary hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[8.5px] uppercase tracking-wider font-bold text-text-secondary font-mono">PROMO KEY CODE</label>
              <input
                type="text"
                required
                value={newCouponCode}
                onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                placeholder="E.G. SILICON50"
                className="w-full bg-black/40 border border-white-5 rounded-xl px-3.5 py-2 text-xs text-white focus:border-accent focus:outline-none font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[8.5px] uppercase tracking-wider font-bold text-text-secondary font-mono">DEDUCTION FORMAT</label>
              <select
                value={newCouponType}
                onChange={(e) => setNewCouponType(e.target.value as any)}
                className="w-full bg-black/40 border border-white-5 rounded-xl px-3.5 py-2 text-xs text-white focus:border-accent focus:outline-none"
              >
                <option value="PERCENTAGE">PERCENTAGE RATE OFF</option>
                <option value="FIXED">FIXED AMOUNT (USD)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[8.5px] uppercase tracking-wider font-bold text-text-secondary font-mono">DEDUCTION VALUE</label>
              <input
                type="number"
                step="0.01"
                required
                value={newCouponValue}
                onChange={(e) => setNewCouponValue(e.target.value)}
                placeholder="E.g. 15 for 15% or 5 for $5.00"
                className="w-full bg-black/40 border border-white-5 rounded-xl px-3.5 py-2 text-xs text-white focus:border-accent focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[8.5px] uppercase tracking-wider font-bold text-text-secondary font-mono">USAGE CONSTRAINT LIMIT</label>
              <input
                type="number"
                required
                value={newCouponLimit}
                onChange={(e) => setNewCouponLimit(e.target.value)}
                placeholder="100"
                className="w-full bg-black/40 border border-white-5 rounded-xl px-3.5 py-2 text-xs text-white focus:border-accent focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-accent hover:bg-accent-hover text-velum-900 text-[10px] font-sans font-bold uppercase rounded-xl tracking-wider cursor-pointer"
          >
            Deploy Campaign Key Code Code
          </button>
        </form>
      )}

      {/* NEW LISTING ADVERTISING FORM */}
      {showCreate && (
        <form onSubmit={handleCreateListing} className="bg-velum-850 border border-white-5 rounded-2xl p-5 space-y-4 max-w-2xl animate-in fade-in slide-in-from-top-3 duration-250">
          <div className="flex justify-between items-center pb-2 border-b border-white-5">
            <span className="text-[10px] font-mono font-bold text-accent uppercase tracking-wider">Publish Autonomous Micro-Asset Storefront</span>
            <button type="button" onClick={() => setShowCreate(false)} className="text-text-disabled hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-[8.5px] uppercase tracking-wider font-bold text-text-secondary font-mono">ASSET / PRODUCT HEADER TITLE</label>
              <input
                id="market_create_title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E.g., Automated Encryption Key Escrow Daemon"
                className="w-full bg-black/40 border border-white-5 rounded-xl px-3.5 py-2 text-xs text-white focus:border-accent focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[8.5px] uppercase tracking-wider font-bold text-text-secondary font-mono">BASE PRICE ($ USD)</label>
              <input
                id="market_create_price"
                type="number"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="49.99"
                className="w-full bg-black/40 border border-white-5 rounded-xl px-3.5 py-2 text-xs text-white focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[8.5px] uppercase tracking-wider font-bold text-text-secondary font-mono">OPTIONAL ACTIVE DISCOUNTED PRICE ($ USD)</label>
              <input
                type="number"
                step="0.01"
                value={discountPrice}
                onChange={(e) => setDiscountPrice(e.target.value)}
                placeholder="E.g. 29.99 (Leave blank if inactive)"
                className="w-full bg-black/40 border border-white-5 rounded-xl px-3.5 py-2 text-xs text-white focus:border-accent focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[8.5px] uppercase tracking-wider font-bold text-text-secondary font-mono">STOREFRONT IMAGE BANNER URL</label>
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="HTTPS link to asset screenshot/render"
                className="w-full bg-black/40 border border-white-5 rounded-xl px-3.5 py-2 text-xs text-white focus:border-accent focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[8.5px] uppercase tracking-wider font-bold text-text-secondary font-mono">SPECIFICATION TECHNICAL DOCUMENTATION</label>
            <textarea
              id="market_create_desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State precise developer specifications, dependencies, and integration procedures."
              rows={4}
              className="w-full bg-black/40 border border-white-5 rounded-xl px-3.5 py-2 text-xs text-white focus:border-accent focus:outline-none resize-none font-sans"
            />
          </div>

          <button
            id="market_submit_listing_btn"
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-accent hover:bg-accent-hover text-velum-900 text-[10px] font-sans font-bold uppercase rounded-xl tracking-widest transition cursor-pointer"
          >
            {isSubmitting ? 'Publishing Secure Links...' : 'COMPRESS AND PUBLISH STOREFRONT LISTING'}
          </button>
        </form>
      )}

      {/* ESCROW CLEARING PIE RANGE / PANEL ACCORDIONS */}
      {escrows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-status-online animate-pulse"></div>
            <h3 className="text-xs font-mono font-black tracking-wider text-emerald-400 uppercase">
              🔐 ACTIVE COMPARTMENT ESCROW HOLDS ({escrows.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {escrows.map((escrow) => (
              <EscrowTransactionCard
                key={escrow.transaction_id}
                escrow={escrow}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                handleRunSandboxTest={handleRunSandboxTest}
                handleReleaseEscrow={handleReleaseEscrow}
                handleRevertEscrow={handleRevertEscrow}
              />
            ))}
          </div>
        </div>
      )}

      {/* DYNAMIC CHECKOUT DRAWER / POPUP */}
      {checkoutListing && (
        <div className="fixed inset-0 bg-black-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-velum-850 border border-white-5 p-6 rounded-2xl max-w-md w-full space-y-5 animate-in fade-in zoom-in-95 duration-150 text-text-primary">
            <div className="flex justify-between items-center pb-2 border-b border-white-5">
              <span className="text-[10px] font-mono font-bold text-accent uppercase tracking-widest flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-accent" />
                <span>Escrow Clearing Desk</span>
              </span>
              <button onClick={() => { setCheckoutListing(null); setAppliedCoupon(null); setCouponCode(''); }} className="text-text-secondary hover:text-white">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <span className="text-[8.5px] font-mono text-text-secondary block uppercase font-bold">ASSET PACKAGE DESIGNATION</span>
              <h3 className="text-sm font-sans font-bold text-white leading-tight">{checkoutListing.title}</h3>
              <div className="text-[10px] text-text-primary bg-text-primary/[0.01] p-3 rounded-lg border border-white-5 space-y-1 font-mono">
                <div>Seller ID: #{checkoutListing.seller_id}</div>
                <div>Format: Modular Container Archive</div>
              </div>
            </div>

            {/* Campaign Coupon Field (Pillar C) */}
            <div className="space-y-2">
              <label className="block text-[8.5px] uppercase tracking-wider font-bold text-text-secondary font-mono">CAMPAIGN DISCOUNT PROMO CODE</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="VELUM15"
                  className="flex-1 bg-black/40 border border-white-5 rounded-xl px-3.5 py-1.5 text-xs text-white focus:outline-none focus:border-accent font-mono placeholder:text-text-disabled"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-black text-[10px] font-bold uppercase rounded-xl transition cursor-pointer font-mono"
                >
                  Verify Coupon
                </button>
              </div>
              {appliedCoupon && (
                <div className="text-[9.5px] font-mono text-emerald-400 flex items-center gap-1 bg-status-online/20 p-2 rounded-lg border border-emerald-900/20">
                  <Check className="w-3.5 h-3.5" />
                  <span>Coupon Verified: Applied discount of ${appliedCoupon.deduction.toFixed(2)}</span>
                </div>
              )}
              {couponError && (
                <div className="text-[9.5px] font-mono text-red-400 flex items-center gap-1 bg-status-dnd/20 p-2 rounded-lg border border-red-900/20 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{couponError}</span>
                </div>
              )}
            </div>

            {/* Platform calculations and Settlement review */}
            <div className="space-y-2 border-t border-white-5 pt-4 font-mono text-[10.5px]">
              <div className="flex justify-between text-text-secondary">
                <span>Original Asset Sum:</span>
                <span>${((checkoutListing?.discount_price !== undefined ? checkoutListing?.discount_price : checkoutListing?.price) || 0).toFixed(2)}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-accent">
                  <span>Coupon Deduction:</span>
                  <span>-${appliedCoupon.deduction.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-text-secondary text-[9.5px]">
                <span>Platform Commission (5%):</span>
                <span>
                  ${((appliedCoupon ? appliedCoupon.finalPrice : ((checkoutListing?.discount_price !== undefined ? checkoutListing?.discount_price : checkoutListing?.price) || 0)) * 0.05).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-white font-black text-xs border-t border-white-5 pt-2">
                <span>TOTAL COMMITMENT CAP:</span>
                <span className="text-emerald-400">
                  ${(appliedCoupon ? appliedCoupon.finalPrice : ((checkoutListing?.discount_price !== undefined ? checkoutListing?.discount_price : checkoutListing?.price) || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={handleConfirmCheckoutAndEscrow}
              className="w-full py-3 bg-accent hover:bg-accent-hover text-velum-900 text-[10px] font-sans font-black uppercase tracking-widest rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4.5 h-4.5 text-zinc-950" />
              <span>LOCK CAPITAL IN ESCROW HOLD</span>
            </button>
          </div>
        </div>
      )}

      {/* CORE MARKETPLACE STOREFRONT GALLERY (Pillar A) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-mono font-black uppercase tracking-wider text-white">
              🏪 DIRECTORY STOREFRONT INDEXING ({listings.length})
            </h3>
          </div>
        </div>

        {loading ? (
          <div className="text-[10px] text-text-secondary font-mono animate-pulse">Scanning decentralized storefront register database...</div>
        ) : listings.length === 0 ? (
          <div className="text-[10px] text-text-secondary font-mono bg-text-primary/[0.01] border border-white-5 p-6 rounded-2xl text-center">No active listings located in this corridor. Advertise one using the dashboard controls above.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map((listing) => {
              const isOwner = Number(listing.seller_id) === currentUserId;
              const hasActiveSale = listing.discount_price !== undefined;
              const activeDisplayPrice = hasActiveSale ? listing.discount_price! : listing.price;

              return (
                <div 
                  key={listing.listing_id} 
                  onClick={() => setSelectedListing(listing)}
                  className="bg-velum-850/75 hover:bg-velum-850 border border-white-5 hover:border-accent/15 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl transition-all hover:scale-[1.01] duration-150 cursor-pointer group relative overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-1">
                        <span className="text-[8px] font-mono tracking-widest uppercase bg-text-primary/[0.02] text-accent/80 border border-accent/5 px-2 py-0.5 rounded-md leading-none">
                          ACTIVE SKU MODULE
                        </span>
                        <h4 className="text-xs font-sans font-extrabold text-text-primary group-hover:text-white transition line-clamp-1 mt-1">
                          {listing.title}
                        </h4>
                      </div>

                      {/* Display Pricing */}
                      <div className="text-right shrink-0">
                        {hasActiveSale && (
                          <span className="text-[9px] line-through text-text-disabled block font-mono">
                            ${(listing.price ?? 0).toFixed(2)}
                          </span>
                        )}
                        <span className="text-xs font-mono font-black text-accent">
                          ${(activeDisplayPrice ?? 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {listing.description && (
                      <p className="text-[10px] text-text-secondary leading-relaxed line-clamp-2 font-sans font-medium">
                        {listing.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[9px] font-mono text-text-disabled border-t border-white-5 pt-2.5">
                      <div className="flex items-center gap-1">
                        <Star className={`w-3 h-3 ${listing.average_rating && listing.average_rating > 0 ? 'text-accent fill-accent' : 'text-text-disabled'}`} />
                        <span className="font-bold text-text-primary">{listing.average_rating && listing.average_rating > 0 ? listing.average_rating : 'No ratings'}</span>
                        {listing.review_count !== undefined && listing.review_count > 0 && (
                          <span className="text-text-disabled">({listing.review_count})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>@{listing.seller_username}</span>
                        {isOwner && <span className="text-status-away font-extrabold font-mono uppercase text-[7.5px] tracking-wide">(Your Asset)</span>}
                      </div>
                    </div>
                  </div>

                  {listing.status === 'ACTIVE' ? (
                    <button
                      id={`buy_btn_${listing.listing_id}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCheckoutListing(listing);
                      }}
                      disabled={isOwner}
                      className={`w-full py-2 rounded-xl text-[9px] uppercase font-sans font-black tracking-widest transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer ${
                        isOwner
                          ? 'bg-velum-900 text-text-disabled border border-white-5 cursor-not-allowed'
                          : 'bg-accent hover:bg-accent-hover text-black hover:shadow-lg'
                      }`}
                    >
                      <span>Inquire & Acquire</span>
                      <ArrowRight className="w-3 h-3 ml-0.5" />
                    </button>
                  ) : (
                    <div className="text-center text-[9px] font-mono font-bold bg-velum-900/50 py-2 border border-white-5 rounded-xl text-text-secondary uppercase tracking-widest select-none">
                      {listing.status}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CORE PRODUCT INSPECTOR DETAIL SIDE DRAWER OVERLAY */}
      {selectedListing && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-45 flex justify-end">
          <div className="w-full max-w-2xl bg-velum-850 border-l border-white-5 h-full overflow-y-auto p-6 md:p-4 space-y-7 animate-in slide-in-from-right duration-250 flex flex-col justify-between text-text-primary">
            
            <div className="space-y-6">
              {/* Drawer Top Navigation bar */}
              <div className="flex justify-between items-center border-b border-white-5 pb-4">
                <div>
                  <span className="text-[8.5px] font-mono font-bold text-accent uppercase tracking-widest">Storefront Inspector Desk</span>
                  <p className="text-[9px] font-mono text-text-secondary mt-0.5 uppercase">UNIFIED SOCIAL MARKET RECORD LINK</p>
                </div>
                <button 
                  onClick={() => setSelectedListing(null)} 
                  className="w-8 h-8 rounded-full border border-white-5 flex items-center justify-center text-text-secondary hover:text-white hover:bg-text-primary/[0.02] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Title & Creator credentials */}
              <div className="space-y-2">
                <div className="flex flex-wrap justify-between items-start gap-4">
                  <h2 className="text-lg font-sans font-black tracking-tight text-white leading-snug max-w-md">{selectedListing.title}</h2>
                  <div className="text-right">
                    <span className="text-[10px] text-text-secondary block font-mono uppercase">Asset Cost</span>
                    <span className="text-lg font-mono font-black text-accent">${(selectedListing.price ?? 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[10.5px] font-mono text-text-secondary bg-text-primary/[0.01] p-3 rounded-xl border border-white-5">
                  <span>Developer: <strong className="text-white font-sans font-bold">@{selectedListing.seller_username || 'Creator'}</strong></span>
                  <span className="text-text-disabled">|</span>
                  <span>Listing ID: <strong className="text-text-primary">{selectedListing.listing_id.slice(0, 16)}</strong></span>
                  <span className="text-text-disabled">|</span>
                  <span>State: <strong className="text-accent font-bold uppercase">{selectedListing.status}</strong></span>
                </div>
              </div>

              {/* Pillar A: Media Gallery Banner display */}
              {listingMedia && listingMedia.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase tracking-widest">STOREFRONT PRODUCT MEDIA GALLERY</span>
                  <div className="border border-white-5 rounded-2xl overflow-hidden aspect-video relative bg-black/40">
                    <img 
                      src={listingMedia[0].url} 
                      alt="Storefront promotional" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black-60 font-mono text-[8px] text-text-primary">
                      Aspect Ratio: {listingMedia[0].aspect_ratio || 'N/A'} | File Size: {listingMedia[0].file_size ? `${(listingMedia[0].file_size / 1024).toFixed(0)}KB` : 'N/A'}
                    </div>
                  </div>
                </div>
              )}

              {/* Documentation segment */}
              {selectedListing.description && (
                <div className="space-y-1.5">
                  <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase tracking-widest">TECHNICAL SPECIFICATIONS / DESCRIPTION</span>
                  <p className="text-[10.5px] text-text-primary font-sans leading-relaxed bg-black/25 rounded-2xl p-4 border border-white-5">
                    {selectedListing.description}
                  </p>
                </div>
              )}

              {/* Pillar B: Social Trust Reputation Ratings & Reviews */}
              <div className="space-y-4 border-t border-white-5 pt-5">
                <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase tracking-widest block">REPUTATION INDEX & VERIFIED RATINGS</span>
                
                {/* Aggregate Star Header */}
                <div className="flex items-center gap-3 bg-accent/5 border border-accent/10 p-3.5 rounded-2xl">
                  <div className="text-center bg-black/40 border border-white-5 rounded-xl px-4 py-2 shrink-0">
                    <span className="text-xl font-mono font-black text-accent block leading-none">{selectedListing.average_rating || 'N/A'}</span>
                    <span className="text-[8px] font-mono text-text-secondary block mt-1 uppercase">Rating Score</span>
                  </div>
                  <div>
                    <h5 className="text-[11px] font-sans font-bold text-white uppercase tracking-wide">VERIFIED BUYER REPUTATION ENGINE</h5>
                    <p className="text-[9.5px] text-text-secondary leading-normal mt-0.5">
                      Ratings are highly vetted. Authors can only review packages after completing transactional checks via full escrow release.
                    </p>
                  </div>
                </div>

                {/* Review logs stream */}
                <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1">
                  {listingReviews.length === 0 ? (
                    <div className="text-[10px] text-text-disabled font-mono italic">No published reviews for this asset located in ledger.</div>
                  ) : (
                    listingReviews.map((rev) => (
                      <div key={rev.review_id} className="bg-black/20 border border-white-5 p-3.5 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-sans font-extrabold text-text-primary">@{rev.buyer_username}</span>
                            <span className="text-text-disabled">|</span>
                            <span className="text-[8px] font-mono text-text-secondary">Verified Client</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <div className="flex text-accent">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={`w-2.5 h-2.5 ${i < rev.rating ? 'fill-accent' : 'opacity-20'}`} />
                              ))}
                            </div>
                            <button 
                              onClick={() => handleFlagReview(rev.review_id)}
                              className="text-text-disabled hover:text-red-400 font-mono text-[8.5px] uppercase hover:underline leading-none"
                              title="Flag review for screening"
                            >
                              🚩 Report Abuse
                            </button>
                          </div>
                        </div>

                        <p className="text-[10px] text-text-primary font-sans leading-relaxed italic pr-1">
                          "{rev.comment}"
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Verified rating submit form */}
                <form onSubmit={handlePostReview} className="bg-black/45 border border-white-5 p-4 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-mono font-bold text-text-secondary uppercase">SUBMIT REPUTATION REPORT</span>
                    <div className="flex items-center gap-1 leading-none">
                      <span className="text-[9px] font-mono text-text-secondary mr-1 uppercase">Rating:</span>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewRating(star)}
                          className="p-0.5 cursor-pointer hover:scale-110 transition"
                        >
                          <Star className={`w-3.5 h-3.5 ${star <= newRating ? 'text-accent fill-accent' : 'text-text-disabled'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={newReviewComment}
                      onChange={(e) => setNewReviewComment(e.target.value)}
                      placeholder="Comment on your experience with this isolate package..."
                      className="flex-1 bg-black-60 border border-white-5 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-accent"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-accent hover:bg-accent-hover text-black text-[9px] font-sans font-black uppercase rounded-xl tracking-wider transition cursor-pointer"
                    >
                      Post Review
                    </button>
                  </div>
                </form>
              </div>

              {/* Pillar D: Threaded pre-sale public inquiry boards */}
              <div className="space-y-4 border-t border-white-5 pt-5">
                <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase tracking-widest block">PUBLIC PRE-SALE INQUIRY FORUM</span>

                <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                  {listingDiscussions.filter(d => !d.parent_id).length === 0 ? (
                    <div className="text-[10px] text-text-disabled font-mono italic">No pre-sale inquiries posted as of yet.</div>
                  ) : (
                    listingDiscussions.filter(d => !d.parent_id).map((parent) => {
                      const replies = listingDiscussions.filter(r => r.parent_id === parent.discussion_id);
                      return (
                        <div key={parent.discussion_id} className="bg-black/20 border border-white-5 p-4 rounded-2xl space-y-3">
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[9px] font-mono text-accent">
                              <span>@{parent.username} asked:</span>
                              <span className="text-text-disabled">{new Date(parent.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-[10.5px] text-text-primary mt-1">{parent.comment}</p>
                          </div>

                          {/* Thread replies display */}
                          {replies.length > 0 && (
                            <div className="ml-4 border-l border-velum-600/40 pl-4 space-y-2.5 pt-1">
                              {replies.map((rep) => (
                                <div key={rep.discussion_id} className="bg-text-primary/[0.01] p-2.5 rounded-lg border border-white-5 space-y-0.5">
                                  <div className="flex justify-between text-[8px] font-mono text-text-secondary">
                                    <span>@{rep.username} ({Number(selectedListing.seller_id) === Number(rep.user_id) ? 'Developer Response' : 'Reply'}):</span>
                                  </div>
                                  <p className="text-[10px] text-text-primary mt-0.5">{rep.comment}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Inline thread reply composer */}
                          {replyParentId === parent.discussion_id ? (
                            <div className="ml-4 flex gap-2 pt-1 animate-in slide-in-from-top-1 duration-150">
                              <input
                                type="text"
                                value={replyComment}
                                onChange={(e) => setReplyComment(e.target.value)}
                                placeholder="Write response in threads..."
                                className="flex-1 bg-black-60 border border-white-5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                              />
                              <button
                                type="button"
                                onClick={() => handlePostReply(parent.discussion_id)}
                                className="px-3 bg-velum-800 hover:bg-zinc-700 text-[9px] text-accent uppercase font-bold rounded-xl transition cursor-pointer"
                              >
                                Reply
                              </button>
                              <button 
                                type="button" 
                                onClick={() => setReplyParentId(null)} 
                                className="px-2 text-text-secondary hover:text-white"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyParentId(parent.discussion_id);
                                  setReplyComment('');
                                }}
                                className="text-[8.5px] font-mono text-text-secondary hover:text-accent uppercase hover:underline cursor-pointer"
                              >
                                💬 Reply to thread
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Primary board composer */}
                <form onSubmit={handlePostQuestion} className="bg-black/45 border border-white-5 p-4 rounded-2xl space-y-3">
                  <span className="text-[9px] font-mono font-bold text-text-secondary uppercase">ASK PRE-SALE / COMPATIBILITY QUESTION</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={newQuestionComment}
                      onChange={(e) => setNewQuestionComment(e.target.value)}
                      placeholder="Ask the developer regarding code structure, dependencies, or escrow..."
                      className="flex-1 bg-black-60 border border-accent/5 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-accent"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-accent hover:bg-accent-hover text-black text-[9px] font-sans font-black uppercase rounded-xl tracking-wider transition cursor-pointer"
                    >
                      Post Question
                    </button>
                  </div>
                </form>
              </div>

            </div>

            {/* Inspect modal footer checkout triggers */}
            <div className="border-t border-white-5 pt-5 flex gap-3 mt-6">
              {selectedListing.status === 'ACTIVE' ? (
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutListing(selectedListing);
                    setSelectedListing(null);
                  }}
                  disabled={Number(selectedListing.seller_id) === currentUserId}
                  className={`flex-1 py-3.5 rounded-xl text-[10px] uppercase font-sans font-black tracking-widest transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 ${
                    Number(selectedListing.seller_id) === currentUserId
                      ? 'bg-velum-900 text-text-disabled cursor-not-allowed border border-white-5'
                      : 'bg-accent hover:bg-accent-hover text-black shadow-lg shadow-accent-10'
                  }`}
                >
                  <span>Acquire Asset & Initiate Secure Holding Escrow</span>
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </button>
              ) : (
                <div className="flex-1 text-center text-[10px] font-mono font-black bg-velum-900/50 py-3.5 border border-white-5 rounded-xl text-text-disabled uppercase tracking-widest">
                  LISTING HAS COMMITTED IN {selectedListing.status} STATE
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
