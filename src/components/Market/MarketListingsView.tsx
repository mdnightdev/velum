import React from 'react';
import { MarketListing } from '../../types';
import { ShoppingBag, Star, Terminal, Code, ShieldCheck, Database, Cpu, HelpCircle } from 'lucide-react';

export const getTechCategoryDetails = (listing: MarketListing) => {
  const text = (listing.title + ' ' + (listing.description || '')).toLowerCase();
  if (text.includes('script') || text.includes('automation') || text.includes('cron') || text.includes('job') || text.includes('action')) {
    return {
      name: 'Automation Scripts',
      icon: <Terminal className="w-5 h-5 text-accent" />,
      bg: 'from-accent/5 to-accent/20 border-accent/10',
    };
  }
  if (text.includes('audit') || text.includes('security') || text.includes('scan') || text.includes('protect') || text.includes('firewall')) {
    return {
      name: 'Security Audits',
      icon: <ShieldCheck className="w-5 h-5 text-alert-success" />,
      bg: 'bg-status-online-bg border-transparent',
    };
  }
  if (text.includes('pipeline') || text.includes('data') || text.includes('sync') || text.includes('db') || text.includes('etl') || text.includes('query')) {
    return {
      name: 'Data Pipelines',
      icon: <Database className="w-5 h-5 text-sky-400" />,
      bg: 'from-sky-500/5 to-sky-500/20 border-sky-500/10',
    };
  }
  if (text.includes('module') || text.includes('lib') || text.includes('package') || text.includes('source') || text.includes('core')) {
    return {
      name: 'Source Modules',
      icon: <Cpu className="w-5 h-5 text-indigo-400" />,
      bg: 'from-indigo-500/5 to-indigo-500/20 border-indigo-500/10',
    };
  }
  return {
    name: 'Developer Utilities',
    icon: <Code className="w-5 h-5 text-status-away" />,
    bg: 'bg-status-away-bg border-transparent',
  };
};

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
      {loading ? (
        <div className="text-[10px] text-text-secondary font-mono animate-pulse">
          Loading...
        </div>
      ) : listings.length === 0 ? (
        <div className="text-xs text-text-secondary bg-velum-800 border border-velum-600 p-6 rounded-xl text-center">
          No active listings.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {listings.map((listing, index) => {
            const isOwner = Number(listing.seller_id) === currentUserId;
            const hasActiveSale = listing.discount_price !== undefined && listing.discount_price !== null;
            const activeDisplayPrice = hasActiveSale ? listing.discount_price! : listing.price;
            const cat = getTechCategoryDetails(listing);

            return (
              <div 
                key={listing.listing_id || `listing-${index}`} 
                onClick={() => onSelectListing(listing)}
                className="bg-velum-800 hover:bg-velum-750 border border-velum-600 hover:border-accent/40 rounded-xl p-3.5 flex flex-col justify-between space-y-3 transition-colors cursor-pointer group"
              >
                <div className="space-y-2.5">
                  {/* Category-specific icon card */}
                  <div className={`h-20 rounded-lg bg-gradient-to-br ${cat.bg} border border-velum-600 flex flex-col items-center justify-center relative overflow-hidden shrink-0`}>
                    <div className="absolute top-2 left-2 text-[9px] text-text-secondary font-medium uppercase">
                      {cat.name}
                    </div>
                    {cat.icon}
                  </div>

                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      {listing.verification_status === 'PENDING_REVIEW' && (
                        <span className="text-[9px] uppercase bg-status-away/15 text-status-away px-1.5 py-0.5 rounded leading-none font-medium">
                          Pending
                        </span>
                      )}
                      {listing.verification_status === 'REJECTED' && (
                        <span className="text-[9px] uppercase bg-status-dnd/15 text-status-dnd px-1.5 py-0.5 rounded leading-none font-medium">
                          Rejected
                        </span>
                      )}
                      {(!listing.verification_status || listing.verification_status === 'APPROVED') && (
                        <span className="text-[9px] uppercase bg-status-online/15 text-status-online px-1.5 py-0.5 rounded leading-none font-medium">
                          Available
                        </span>
                      )}
                      <h4 className="text-xs font-semibold text-text-primary group-hover:text-accent transition line-clamp-1 mt-0.5">
                        {listing.title}
                      </h4>
                    </div>

                    <div className="text-right shrink-0">
                      {hasActiveSale && (
                        <span className="text-xs line-through text-text-disabled block font-mono">
                          ${Number(listing.price || 0).toFixed(2)}
                        </span>
                      )}
                      <span className="text-xs font-bold font-mono text-accent">
                        ${Number(activeDisplayPrice || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {listing.description && (
                    <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                      {listing.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-text-secondary border-t border-velum-600 pt-2">
                    <div className="flex items-center gap-1">
                      <Star className={`w-3 h-3 ${listing.average_rating && listing.average_rating > 0 ? 'text-accent fill-accent' : 'text-text-disabled'}`} />
                      <span className="font-medium text-text-primary">
                        {listing.average_rating && listing.average_rating > 0 ? listing.average_rating : 'No ratings'}
                      </span>
                      {listing.review_count !== undefined && listing.review_count > 0 && (
                        <span className="text-text-disabled">({listing.review_count})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span>{listing.seller_username}</span>
                      {isOwner && <span className="text-status-away text-[10px] font-medium">(You)</span>}
                    </div>
                  </div>
                </div>

                {listing.status === 'ACTIVE' ? (() => {
                  const isOutOfStock = listing.inventory_count !== undefined && listing.inventory_count <= 0;
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isOutOfStock) return;
                        if (listing.verification_status === 'APPROVED' || !listing.verification_status) {
                          onBuyListing(listing);
                        }
                      }}
                      disabled={isOwner || isOutOfStock || listing.verification_status === 'PENDING_REVIEW' || listing.verification_status === 'REJECTED'}
                      className={`w-full py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                        isOwner
                          ? 'bg-velum-750 text-text-disabled border border-velum-600 cursor-not-allowed'
                          : isOutOfStock
                            ? 'bg-status-dnd/15 text-status-dnd cursor-not-allowed'
                            : listing.verification_status === 'PENDING_REVIEW'
                            ? 'bg-status-away/15 text-status-away cursor-not-allowed'
                            : listing.verification_status === 'REJECTED'
                            ? 'bg-status-dnd/15 text-status-dnd cursor-not-allowed'
                            : 'bg-accent text-black hover:bg-accent-hover'
                      }`}
                    >
                      <span>
                        {isOwner 
                          ? 'Owned' 
                          : isOutOfStock
                          ? 'Sold out'
                          : listing.verification_status === 'PENDING_REVIEW' 
                          ? 'Pending' 
                          : listing.verification_status === 'REJECTED' 
                          ? 'Rejected' 
                          : 'Buy'}
                      </span>
                    </button>
                  );
                })() : (
                  <div className="w-full text-center py-1.5 text-xs text-text-disabled border border-velum-600 bg-velum-750 rounded-lg">
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
