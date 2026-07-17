import React from 'react';
import { MarketListing } from '../../types';
import { ShoppingBag, Star } from 'lucide-react';

interface MarketListingsViewProps {
  listings: MarketListing[];
  loading: boolean;
  currentUserId: number;
  onSelectListing: (listing: MarketListing) => void;
  onBuyListing: (listing: MarketListing) => void;
}

export function MarketListingsView({
  listings,
  loading,
  currentUserId,
  onSelectListing,
  onBuyListing
}: MarketListingsViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShoppingBag className="w-4 h-4 text-accent" />
        <h3 className="text-xs font-mono font-black uppercase tracking-wider text-white">
          Listings ({listings.length})
        </h3>
      </div>

      {loading ? (
        <div className="text-[10px] text-text-secondary font-mono animate-pulse">
          Loading...
        </div>
      ) : listings.length === 0 ? (
        <div className="text-[10px] text-text-secondary font-mono bg-text-primary/[0.01] border border-white-5 p-6 rounded-2xl text-center">
          No active listings. Create one to begin.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {listings.map((listing) => {
            const isOwner = Number(listing.seller_id) === currentUserId;
            const hasActiveSale = listing.discount_price !== undefined && listing.discount_price !== null;
            const activeDisplayPrice = hasActiveSale ? listing.discount_price! : listing.price;

            return (
              <div 
                key={listing.listing_id} 
                onClick={() => onSelectListing(listing)}
                className="bg-velum-850/75 hover:bg-velum-850 border border-white-5 hover:border-accent/15 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl transition-all hover:scale-[1.01] duration-150 cursor-pointer group relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-3">
                    <div className="space-y-1">
                      {listing.verification_status === 'PENDING_REVIEW' && (
                        <span className="text-[8px] font-mono tracking-widest uppercase bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded-md leading-none">
                          Pending Review
                        </span>
                      )}
                      {listing.verification_status === 'REJECTED' && (
                        <span className="text-[8px] font-mono tracking-widest uppercase bg-rose-400/10 text-rose-400 border border-rose-400/20 px-2 py-0.5 rounded-md leading-none">
                          Rejected
                        </span>
                      )}
                      {(!listing.verification_status || listing.verification_status === 'APPROVED') && (
                        <span className="text-[8px] font-mono tracking-widest uppercase bg-text-primary/[0.02] text-accent/80 border border-accent/5 px-2 py-0.5 rounded-md leading-none">
                          Available
                        </span>
                      )}
                      <h4 className="text-xs font-sans font-extrabold text-text-primary group-hover:text-white transition line-clamp-1 mt-1">
                        {listing.title}
                      </h4>
                    </div>

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
                      <span className="font-bold text-text-primary">
                        {listing.average_rating && listing.average_rating > 0 ? listing.average_rating : 'No ratings'}
                      </span>
                      {listing.review_count !== undefined && listing.review_count > 0 && (
                        <span className="text-text-disabled">({listing.review_count})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span>@{listing.seller_username}</span>
                      {isOwner && <span className="text-status-away font-extrabold tracking-wide uppercase text-[7.5px]">(Your Asset)</span>}
                    </div>
                  </div>
                </div>

                {listing.status === 'ACTIVE' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (listing.verification_status === 'APPROVED' || !listing.verification_status) {
                        onBuyListing(listing);
                      }
                    }}
                    disabled={isOwner || listing.verification_status === 'PENDING_REVIEW' || listing.verification_status === 'REJECTED'}
                    className={`w-full py-2 rounded-xl text-[9px] uppercase font-sans font-black tracking-widest transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer ${
                      isOwner
                        ? 'bg-velum-900 text-text-disabled border border-white-5 cursor-not-allowed'
                        : listing.verification_status === 'PENDING_REVIEW'
                        ? 'bg-amber-400/5 text-amber-400 border border-amber-400/20 cursor-not-allowed'
                        : listing.verification_status === 'REJECTED'
                        ? 'bg-rose-400/5 text-rose-400 border border-rose-400/20 cursor-not-allowed'
                        : 'bg-text-primary/[0.03] hover:bg-accent hover:text-velum-900 border border-white-5 hover:border-accent text-white'
                    }`}
                  >
                    <span>
                      {isOwner 
                        ? 'Owned' 
                        : listing.verification_status === 'PENDING_REVIEW' 
                        ? 'Pending Review' 
                        : listing.verification_status === 'REJECTED' 
                        ? 'Rejected' 
                        : 'Purchase'}
                    </span>
                  </button>
                ) : (
                  <div className="w-full text-center py-2 text-[9px] font-mono font-black text-text-disabled border border-white-5 bg-velum-900 rounded-xl uppercase tracking-widest">
                    {listing.status}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
