import React, { useState, useEffect } from 'react';
import { MarketListing, MarketDiscussion, MarketReview, MarketAssetMedia, MarketSkuVariant } from '../../types';
import { Star, MessageSquare, AlertCircle, X, Check, ShoppingBag, ShieldAlert, Send, Sparkles, ShieldCheck } from 'lucide-react';

interface ListingInspectorProps {
  listing: MarketListing;
  currentUserId: number;
  onClose: () => void;
  onBuy: (listing: MarketListing, chosenVariant?: MarketSkuVariant) => void;
  onAddToCart?: (listing: MarketListing, chosenVariant: MarketSkuVariant | null) => void;
  fetchSessionId: () => string;
}

export function ListingInspector({
  listing,
  currentUserId,
  onClose,
  onBuy,
  onAddToCart,
  fetchSessionId
}: ListingInspectorProps) {
  const [discussions, setDiscussions] = useState<MarketDiscussion[]>([]);
  const [reviews, setReviews] = useState<MarketReview[]>([]);
  const [media, setMedia] = useState<MarketAssetMedia[]>([]);
  const [selectedSku, setSelectedSku] = useState<MarketSkuVariant | undefined>(undefined);
  const [addedToCartSuccess, setAddedToCartSuccess] = useState(false);
  
  const [loadingDiscussions, setLoadingDiscussions] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Form states
  const [discussionComment, setDiscussionComment] = useState('');
  const [submittingDiscussion, setSubmittingDiscussion] = useState(false);
  const [discussionError, setDiscussionError] = useState('');

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Active tab state inside inspector
  const [activeTab, setActiveTab] = useState<'details' | 'discussion' | 'reviews'>('details');

  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editPrice, setEditPrice] = useState(String(listing.price));
  const [editDiscountAmount, setEditDiscountAmount] = useState(
    listing.discount_price ? String(listing.price - listing.discount_price) : ''
  );
  const [updatingPrice, setUpdatingPrice] = useState(false);
  const [editPriceError, setEditPriceError] = useState('');

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingPrice(true);
    setEditPriceError('');

    try {
      const sId = fetchSessionId();
      const baseVal = parseFloat(editPrice) || 0;
      const discountVal = editDiscountAmount ? parseFloat(editDiscountAmount) : 0;
      const finalDiscountPrice = editDiscountAmount ? (baseVal - discountVal) : null;

      const res = await fetch(`/api/marketplace/listings/${listing.listing_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          price: baseVal,
          discount_price: finalDiscountPrice
        })
      });

      if (res.ok) {
        setIsEditingPrice(false);
        listing.price = baseVal;
        listing.discount_price = finalDiscountPrice || undefined;
      } else {
        const data = await res.json();
        setEditPriceError(data.error || 'Failed to update price.');
      }
    } catch (err) {
      setEditPriceError('Failed to update price.');
    } finally {
      setUpdatingPrice(false);
    }
  };

  const isOwner = Number(listing.seller_id) === currentUserId;
  const hasActiveSale = listing.discount_price !== undefined && listing.discount_price !== null;
  const activeDisplayPrice = hasActiveSale ? listing.discount_price! : listing.price;

  useEffect(() => {
    fetchDiscussions();
    fetchReviews();
    fetchMedia();
  }, [listing.listing_id]);

  const fetchDiscussions = async () => {
    setLoadingDiscussions(true);
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/marketplace/listings/${listing.listing_id}/discussions`, {
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDiscussions(data);
      }
    } catch (err) {
      console.warn('Failed to load discussions', err);
    } finally {
      setLoadingDiscussions(false);
    }
  };

  const fetchReviews = async () => {
    setLoadingReviews(true);
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/marketplace/listings/${listing.listing_id}/reviews`, {
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (err) {
      console.warn('Failed to load reviews', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const fetchMedia = async () => {
    setLoadingMedia(true);
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/marketplace/listings/${listing.listing_id}/media`, {
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMedia(data);
      }
    } catch (err) {
      console.warn('Failed to load media', err);
    } finally {
      setLoadingMedia(false);
    }
  };

  const handlePostDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discussionComment.trim()) return;
    setSubmittingDiscussion(true);
    setDiscussionError('');

    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/marketplace/listings/${listing.listing_id}/discussions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comment: discussionComment.trim() })
      });

      if (res.ok) {
        setDiscussionComment('');
        fetchDiscussions();
      } else {
        const data = await res.json();
        setDiscussionError(data.error || 'Failed to submit discussion.');
      }
    } catch (err) {
      setDiscussionError('Network error submitting comment.');
    } finally {
      setSubmittingDiscussion(false);
    }
  };

  const handlePostReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;
    setSubmittingReview(true);
    setReviewError('');
    setReviewSuccess(false);

    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/marketplace/listings/${listing.listing_id}/reviews`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment.trim()
        })
      });

      if (res.ok) {
        setReviewComment('');
        setReviewSuccess(true);
        fetchReviews();
        // Clear success message after 3 seconds
        setTimeout(() => setReviewSuccess(false), 4000);
      } else {
        const data = await res.json();
        setReviewError(data.error || 'Failed to publish review.');
      }
    } catch (err) {
      setReviewError('Network error submitting review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Check if current user has already reviewed
  const userHasReviewed = reviews.some(r => Number(r.buyer_id) === currentUserId);

  // Render stars
  const renderStars = (count: number, interactive = false, onSelect?: (r: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            onClick={() => interactive && onSelect && onSelect(star)}
            className={`w-4 h-4 ${
              star <= count 
                ? 'text-accent fill-accent' 
                : 'text-text-disabled/40'
            } ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
          />
        ))}
      </div>
    );
  };

  const bannerUrl = media.find(m => m.is_banner)?.url || (media.length > 0 ? media[0].url : null);
  const additionalCost = selectedSku ? (selectedSku.additional_cost_cents / 100) : 0;
  const currentTotalDisplayPrice = activeDisplayPrice + additionalCost;

  return (
    <div className="fixed inset-0 z-40 bg-velum-900/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-velum-800 border border-white-5 w-full max-w-2xl h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Banner/Header Segment */}
        <div className="relative h-44 shrink-0 bg-black-60 border-b border-white-5 overflow-hidden">
          {bannerUrl ? (
            <img 
              src={bannerUrl} 
              alt={listing.title} 
              className="w-full h-full object-cover opacity-80" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-velum-850 to-velum-900 text-center px-4">
              <Sparkles className="w-8 h-8 text-accent/40 mb-2" />
              <div className="text-[10px] font-sans tracking-widest text-text-secondary uppercase">Product Details</div>
            </div>
          )}
          
          {/* Close button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/40 hover:bg-black/70 border border-white-10 text-white rounded-full p-1.5 transition-colors cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Floated title & pricing overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-velum-800 to-transparent p-5 pt-12 flex justify-between items-end gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-mono tracking-widest uppercase bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-md leading-none">
                  Listing
                </span>
                {isOwner && (
                  <span className="text-[8px] font-mono tracking-widest uppercase bg-emerald-950 text-emerald-400 border border-emerald-800/30 px-2 py-0.5 rounded-md leading-none">
                    Your Asset
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-sans font-black text-white leading-tight drop-shadow-md">
                {listing.title}
              </h3>
            </div>

            <div className="text-right shrink-0">
              {hasActiveSale && !selectedSku && (
                <span className="text-[10px] line-through text-text-disabled block font-mono">
                  ${(listing.price ?? 0).toFixed(2)}
                </span>
              )}
              <span className="text-sm sm:text-base font-mono font-black text-accent block">
                ${(currentTotalDisplayPrice ?? 0).toFixed(2)}
              </span>
              {selectedSku && (
                <span className="text-[8px] font-mono text-text-secondary block">
                  Incl. {selectedSku.attribute_value.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white-5 bg-velum-850 px-4">
          {[
            { id: 'details', label: 'Overview' },
            { id: 'discussion', label: `Public Inquiries (${discussions.length})` },
            { id: 'reviews', label: `Verified Reviews (${reviews.length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-[10px] font-mono uppercase tracking-wider font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-none space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'details' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="space-y-2">
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-text-disabled font-black">
                  Asset Details
                </h4>
                <p className="text-xs text-text-primary leading-relaxed font-sans font-medium whitespace-pre-line bg-velum-850/40 p-4 rounded-xl border border-white-5">
                  {listing.description || 'No description provided.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-velum-850/50 border border-white-5 p-4 rounded-2xl space-y-1">
                  <span className="text-[9px] font-mono text-text-disabled uppercase">Seller Identity</span>
                  <div className="text-xs font-bold text-white">{listing.seller_username}</div>
                </div>

                <div className="bg-velum-850/50 border border-white-5 p-4 rounded-2xl space-y-1">
                  <span className="text-[9px] font-mono text-text-disabled uppercase">Verification Status</span>
                  <div className="text-xs font-bold text-white uppercase">{listing.verification_status || 'APPROVED'}</div>
                  <span className="text-[8px] font-mono text-text-secondary">Status: {listing.status}</span>
                </div>
              </div>

              {isOwner && (
                <div className="bg-velum-850/50 border border-white-5 p-4 rounded-2xl space-y-3 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono font-bold text-accent uppercase tracking-wider">Update Price</span>
                    <button
                      type="button"
                      onClick={() => setIsEditingPrice(!isEditingPrice)}
                      className="text-[9px] uppercase font-mono text-text-secondary hover:text-white cursor-pointer"
                    >
                      {isEditingPrice ? 'Cancel' : 'Edit'}
                    </button>
                  </div>
                  {isEditingPrice ? (
                    <form onSubmit={handleUpdatePrice} className="space-y-3 pt-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8px] uppercase tracking-wider font-mono text-text-secondary">Base Price ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-full bg-black/50 border border-white-5 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] uppercase tracking-wider font-mono text-text-secondary">Discount ($ off)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editDiscountAmount}
                            onChange={(e) => setEditDiscountAmount(e.target.value)}
                            className="w-full bg-black/50 border border-white-5 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          />
                        </div>
                      </div>
                      {editPriceError && (
                        <div className="text-[9px] font-mono text-status-dnd">{editPriceError}</div>
                      )}
                      <button
                        type="submit"
                        disabled={updatingPrice}
                        className="w-full py-2 bg-accent hover:bg-accent-hover text-velum-900 text-[9px] font-mono uppercase font-black tracking-widest rounded-lg transition cursor-pointer"
                      >
                        {updatingPrice ? 'Updating...' : 'Save Price'}
                      </button>
                    </form>
                  ) : (
                    <div className="text-xs text-text-secondary">
                      Current Price: <span className="text-white font-bold">${listing.price.toFixed(2)}</span>
                      {listing.discount_price !== undefined && listing.discount_price !== null && (
                        <span> (Discounted: <span className="text-accent font-bold">${listing.discount_price.toFixed(2)}</span>)</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {listing.sku_variants && listing.sku_variants.length > 0 && (
                <div className="space-y-3 border border-white-5 bg-velum-850/50 p-4 rounded-2xl text-left">
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-text-disabled font-black">
                    Select Option
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => setSelectedSku(undefined)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                        selectedSku === undefined
                          ? 'bg-accent/10 border-accent text-white shadow'
                          : 'bg-black/20 border-white-5 hover:border-white-10 text-text-secondary'
                      }`}
                    >
                      <div className="text-[10px] font-mono uppercase tracking-wide font-black">Default Version</div>
                      <div className="text-xs font-bold mt-1 text-white">Standard Core Package</div>
                      <div className="text-[9px] font-mono mt-1 text-accent font-black">No additional charge</div>
                    </div>

                    {(listing.sku_variants || []).map((variant: MarketSkuVariant) => (
                      <div
                        key={variant.sku_id}
                        onClick={() => variant.inventory_count > 0 && setSelectedSku(variant)}
                        className={`p-3 rounded-xl border transition-all relative ${
                          variant.inventory_count <= 0 
                            ? 'opacity-40 bg-black/45 border-white-5 cursor-not-allowed text-text-disabled' 
                            : 'cursor-pointer text-left'
                        } ${
                          selectedSku?.sku_id === variant.sku_id
                            ? 'bg-accent/10 border-accent text-white shadow'
                            : 'bg-black/20 border-white-5 hover:border-white-10 text-text-secondary'
                        }`}
                      >
                        {variant.inventory_count <= 0 && (
                          <span className="absolute top-2 right-2 text-[8px] font-mono uppercase tracking-widest bg-red-900/50 text-red-400 border border-red-800/20 px-1 py-0.5 rounded leading-none">
                            Out of Stock
                          </span>
                        )}
                        <div className="text-[10px] font-mono uppercase tracking-wide font-black">
                          {variant.attribute_name.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs font-bold mt-1 text-white">
                          {variant.attribute_value.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[9px] font-mono mt-1 text-accent font-black">
                          +${(variant.additional_cost_cents / 100).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rating summary card */}
              <div className="bg-velum-850/75 border border-white-5 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1.5 text-center sm:text-left">
                  <span className="text-[9px] font-mono text-text-secondary uppercase tracking-widest font-bold">Seller Rating</span>
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <span className="text-xl font-mono font-black text-white">
                      {listing.average_rating && listing.average_rating > 0 ? listing.average_rating.toFixed(1) : '0.0'}
                    </span>
                    {renderStars(listing.average_rating || 0)}
                  </div>
                </div>
                <div className="text-[10px] font-sans text-text-secondary border-t sm:border-t-0 sm:border-l border-white-5 pt-3 sm:pt-0 sm:pl-5 max-w-xs leading-relaxed text-center sm:text-left">
                  Reviews are verified and submitted by actual buyers.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DISCUSSION FORUM */}
          {activeTab === 'discussion' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Form */}
              <form onSubmit={handlePostDiscussion} className="space-y-3 bg-velum-850 p-4 rounded-2xl border border-white-5">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
                    Post a Public Inquiry
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={discussionComment}
                    onChange={(e) => setDiscussionComment(e.target.value)}
                    className="flex-1 bg-black/40 border border-white-5 rounded-xl px-4 py-2 text-xs text-white placeholder-text-disabled focus:border-accent focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={submittingDiscussion || !discussionComment.trim()}
                    className="px-4 bg-accent hover:bg-accent-hover disabled:opacity-50 text-velum-900 text-xs font-bold uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    {submittingDiscussion ? 'Sending...' : <Send className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {discussionError && (
                  <div className="text-[9px] font-mono text-status-dnd flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{discussionError}</span>
                  </div>
                )}
              </form>

              {/* Discussions List */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-text-disabled font-black">
                  Inquiries Feed ({discussions.length})
                </h4>

                {loadingDiscussions ? (
                  <div className="text-[10px] font-mono text-text-secondary animate-pulse">Loading discussion forum...</div>
                ) : discussions.length === 0 ? (
                  <div className="text-[10px] font-mono text-text-disabled text-center py-6 bg-velum-850/20 border border-white-5 rounded-xl">
                    No active discussions. Be the first to ask!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {discussions.map((disc) => (
                      <div key={disc.discussion_id} className="bg-velum-850/50 border border-white-5 p-4 rounded-2xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-sans font-bold text-white">
                            {disc.username}
                          </span>
                          <span className="text-[8px] font-mono text-text-disabled">
                            {new Date(disc.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs font-sans text-text-secondary leading-relaxed font-medium">
                          {disc.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: VERIFIED REVIEWS */}
          {activeTab === 'reviews' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Form (purchase verification is gated on server) */}
              {!userHasReviewed && !isOwner && (
                <form onSubmit={handlePostReview} className="space-y-4 bg-velum-850 p-5 rounded-2xl border border-emerald-950/40">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
                      Publish a Verified Purchase Review
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                    <div className="space-y-1">
                      <label className="block text-[8px] uppercase font-mono text-text-secondary">Rating Score</label>
                      {renderStars(reviewRating, true, setReviewRating)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="block text-[8px] uppercase font-mono text-text-secondary">Comment</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          className="flex-1 bg-black/40 border border-white-5 rounded-xl px-4 py-2 text-xs text-white placeholder-text-disabled focus:border-emerald-500 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={submittingReview || !reviewComment.trim()}
                          className="px-4 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-bold uppercase rounded-xl transition cursor-pointer"
                        >
                          {submittingReview ? 'Saving...' : 'Submit'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {reviewSuccess && (
                    <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-900/30">
                      <Check className="w-3.5 h-3.5" />
                      <span>Review submitted successfully!</span>
                    </div>
                  )}

                  {reviewError && (
                    <div className="text-[10px] font-mono text-status-dnd flex items-start gap-1.5 bg-status-dnd/10 p-3 rounded-xl border border-status-dnd/20">
                      <ShieldAlert className="w-4 h-4 text-status-dnd shrink-0 mt-0.5" />
                      <div>
                        <div className="font-extrabold uppercase text-[9px] tracking-wide">Reputation Gate Error</div>
                        <div className="text-[9px] text-text-secondary leading-relaxed mt-0.5">{reviewError}</div>
                      </div>
                    </div>
                  )}
                </form>
              )}

              {/* Reviews List */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-text-disabled font-black">
                  Verified Reviews Feed ({reviews.length})
                </h4>

                {loadingReviews ? (
                  <div className="text-[10px] font-mono text-text-secondary animate-pulse">Loading review ledger...</div>
                ) : reviews.length === 0 ? (
                  <div className="text-[10px] font-mono text-text-disabled text-center py-6 bg-velum-850/20 border border-white-5 rounded-xl">
                    No reviews published yet. Be the first to acquire and rate!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((rev) => (
                      <div key={rev.review_id} className="bg-velum-850/50 border border-white-5 p-4 rounded-2xl space-y-3">
                        <div className="flex justify-between items-start gap-3">
                          <div className="space-y-1">
                            <span className="text-[10px] font-sans font-bold text-white block">
                              {rev.buyer_username || 'Verified Buyer'}
                            </span>
                            {renderStars(rev.rating)}
                          </div>
                          <span className="text-[8px] font-mono text-text-disabled">
                            {new Date(rev.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs font-sans text-text-secondary leading-relaxed font-medium">
                          {rev.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-white-5 bg-velum-850/50 flex flex-col sm:flex-row gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-velum-700 hover:bg-velum-600 border border-white-5 text-white text-[10px] font-mono uppercase font-black tracking-widest rounded-xl transition cursor-pointer"
          >
            Close Inspector
          </button>
          
          {listing.status === 'ACTIVE' && (() => {
            const isOutOfStock = (selectedSku ? (selectedSku.inventory_count ?? 0) : (listing.inventory_count ?? 999)) <= 0;
            return (
              <>
                {onAddToCart && (
                  <button
                    onClick={() => {
                      if (isOutOfStock) return;
                      onAddToCart(listing, selectedSku || null);
                      setAddedToCartSuccess(true);
                      setTimeout(() => setAddedToCartSuccess(false), 2000);
                    }}
                    disabled={isOwner || isOutOfStock}
                    className={`flex-1 py-3 text-[10px] font-sans font-black uppercase tracking-widest rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      isOwner
                        ? 'bg-velum-900 text-text-disabled border border-white-5 cursor-not-allowed'
                        : isOutOfStock
                          ? 'bg-red-950/40 text-red-400 border border-red-900/30 cursor-not-allowed'
                          : addedToCartSuccess
                            ? 'bg-emerald-900 border border-emerald-500/40 text-emerald-400'
                            : 'bg-velum-800 border border-white-10 text-white hover:bg-velum-750'
                    }`}
                  >
                    {isOutOfStock ? (
                      <span>Out of Stock</span>
                    ) : addedToCartSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Added!</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4 text-accent" />
                        <span>Add to Cart</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => {
                    if (isOutOfStock) return;
                    onBuy(listing, selectedSku);
                  }}
                  disabled={isOwner || isOutOfStock}
                  className={`flex-1 py-3 text-[10px] font-sans font-black uppercase tracking-widest rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    isOwner
                      ? 'bg-velum-900 text-text-disabled border border-white-5 cursor-not-allowed'
                      : isOutOfStock
                        ? 'bg-red-950/40 text-red-400 border border-red-900/30 cursor-not-allowed'
                        : 'bg-accent hover:bg-accent-hover text-velum-900 shadow-md'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{isOwner ? 'Your Own Asset' : isOutOfStock ? 'Sold Out' : 'Buy Now'}</span>
                </button>
              </>
            );
          })()}
        </div>

      </div>
    </div>
  );
}
