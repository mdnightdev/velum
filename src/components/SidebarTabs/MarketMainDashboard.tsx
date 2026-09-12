import React, { useState, useEffect, useCallback } from 'react';
import { MarketListing, EscrowTransaction } from '../../types';
import { ShoppingBag, Search, SlidersHorizontal, Plus } from 'lucide-react';

import { MarketListingsView } from '../Market/MarketListingsView';
import { MarketEscrowsView } from '../Market/MarketEscrowsView';
import { ListingCreator } from '../Market/ListingCreator';
import { CouponCreator } from '../Market/CouponCreator';
import { CheckoutFlow } from '../Market/CheckoutFlow';
import { ListingInspector } from '../Market/ListingInspector';
import { ShoppingCartDrawer } from '../Market/ShoppingCartDrawer';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { getSessionId } from '../../utils/auth';

interface MarketMainDashboardProps {
  currentUserId: number;
  currentUserRole: string;
  isDark?: boolean;
}

const MARKET_CATEGORIES = ['All', 'General', 'Software', 'Services', 'Digital', 'Other'];

function normalizeListing(raw: Record<string, unknown>): MarketListing {
  const priceRaw = raw.price;
  const price =
    typeof priceRaw === 'number'
      ? priceRaw
      : parseFloat(String(priceRaw ?? '0')) || 0;
  return {
    listing_id: String(raw.listing_id ?? raw.id ?? ''),
    seller_id: Number(raw.seller_id ?? raw.sellerId ?? 0),
    seller_username: (raw.seller_username as string) || undefined,
    title: String(raw.title || ''),
    description: (raw.description as string) || undefined,
    price,
    currency: String(raw.currency || 'EUR').toUpperCase(),
    category: String(raw.category || 'General'),
    discount_price:
      raw.discount_price != null
        ? Number(raw.discount_price)
        : raw.discountPrice != null
          ? Number(raw.discountPrice)
          : null,
    status: String(raw.status || 'ACTIVE'),
    verification_status: (raw.verification_status ||
      raw.verificationStatus ||
      (raw.status === 'PENDING_REVIEW' || raw.status === 'REJECTED' ? raw.status : undefined)) as
      | 'APPROVED'
      | 'PENDING_REVIEW'
      | 'REJECTED'
      | string
      | undefined,
    inventory_count:
      raw.inventory_count != null
        ? Number(raw.inventory_count)
        : raw.stock != null
          ? Number(raw.stock)
          : undefined,
    created_at: (raw.created_at || raw.createdAt || new Date().toISOString()) as string | number,
    average_rating: raw.average_rating != null ? Number(raw.average_rating) : undefined,
    review_count: raw.review_count != null ? Number(raw.review_count) : undefined,
  };
}

function normalizeEscrow(raw: Record<string, unknown>): EscrowTransaction {
  const amountRaw = raw.amount;
  const amount =
    typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw ?? '0')) || 0;
  return {
    transaction_id: String(raw.transaction_id ?? raw.id ?? ''),
    listing_id: String(raw.listing_id ?? raw.listingId ?? ''),
    listing_title: (raw.listing_title || raw.listingTitle) as string | undefined,
    buyer_id: Number(raw.buyer_id ?? raw.buyerId ?? 0),
    buyer_username: (raw.buyer_username || raw.buyerUsername) as string | undefined,
    seller_id: Number(raw.seller_id ?? raw.sellerId ?? 0),
    seller_username: (raw.seller_username || raw.sellerUsername) as string | undefined,
    amount,
    currency: String(raw.currency || 'EUR').toUpperCase(),
    payment_currency: raw.payment_currency
      ? String(raw.payment_currency).toUpperCase()
      : raw.paymentCurrency
        ? String(raw.paymentCurrency).toUpperCase()
        : undefined,
    payment_amount:
      raw.payment_amount != null
        ? Number(raw.payment_amount)
        : raw.paymentAmount != null
          ? Number(raw.paymentAmount)
          : undefined,
    status: String(raw.status || 'HELD'),
    platform_fee: raw.platform_fee != null ? Number(raw.platform_fee) : undefined,
    payout_amount: raw.payout_amount != null ? Number(raw.payout_amount) : undefined,
    created_at: (raw.created_at || raw.createdAt || new Date().toISOString()) as string | number,
    updated_at: (raw.updated_at || raw.updatedAt) as string | number | undefined,
  };
}

export default function MarketMainDashboard({
  currentUserId,
  currentUserRole,
  isDark = true
}: MarketMainDashboardProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'browse' | 'orders' | 'inventory'>('browse');
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [escrows, setEscrows] = useState<EscrowTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // V2 UI Overhaul State Variables
  const [mode, setMode] = useState<'buyer' | 'seller'>('buyer');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortOption, setSortOption] = useState<'price_asc' | 'price_desc' | 'newest'>('newest');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [showCouponCreator, setShowCouponCreator] = useState(false);
  const [checkoutListing, setCheckoutListing] = useState<MarketListing | null>(null);
  const [checkoutVariant, setCheckoutVariant] = useState<any | null>(null);
  const [selectedInspectListing, setSelectedInspectListing] = useState<MarketListing | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const { addToCart, cartCount } = useCart();

  const fetchSessionId = () => getSessionId();

  const loadMarket = useCallback(async () => {
    try {
      const sId = fetchSessionId();
      const headers = { 'Authorization': `Bearer ${sId}` };
      const [listingsRes, escrowsRes] = await Promise.all([
        fetch('/v2/marketplace/listings', { headers }),
        fetch('/v2/marketplace/escrows', { headers })
      ]);
      if (listingsRes.ok) {
        const lData = await listingsRes.json();
        const rawList = Array.isArray(lData)
          ? lData
          : lData && Array.isArray(lData.listings)
            ? lData.listings
            : [];
        setListings(rawList.map((row: Record<string, unknown>) => normalizeListing(row)));
      } else {
        setListings([]);
      }
      if (escrowsRes.ok) {
        const eData = await escrowsRes.json();
        const rawEscrows = Array.isArray(eData)
          ? eData
          : eData && Array.isArray(eData.escrows)
            ? eData.escrows
            : [];
        setEscrows(rawEscrows.map((row: Record<string, unknown>) => normalizeEscrow(row)));
      } else {
        setEscrows([]);
      }
    } catch (err) {
      console.warn('Sync issue in marketplace loading:', err);
      setListings([]);
      setEscrows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarket();
    // Reduce polling frequency per REFACTOR_PLAN guidelines
    const interval = setInterval(loadMarket, 30000);
    return () => clearInterval(interval);
  }, [loadMarket]);

  const handleSandboxTest = async (transactionId: string) => {
    try {
      const sId = fetchSessionId();
      await fetch(`/v2/marketplace/escrows/${transactionId}/test-sandbox`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      loadMarket();
    } catch (err) {
      console.warn("Sandbox execution failed");
    }
  };

  const handleReleaseEscrow = async (transactionId: string) => {
    try {
      const sId = fetchSessionId();
      await fetch(`/v2/marketplace/escrows/${transactionId}/release`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      loadMarket();
    } catch (err) {
      console.warn("Release failed");
    }
  };

  const handleRevertEscrow = async (transactionId: string) => {
    try {
      const sId = fetchSessionId();
      await fetch(`/v2/marketplace/escrows/${transactionId}/revert`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      loadMarket();
    } catch (err) {
      console.warn("Revert failed");
    }
  };

  // Filter by listing.category (humble labels — no tech jargon buckets)
  const getListingCategory = (listing: MarketListing) => listing.category || 'General';

  // Filter & Sort Logic
  const safeListings = Array.isArray(listings) ? listings : [];
  const filteredListings = safeListings
    .filter((listing) => {
      if (mode === 'seller') {
        // Seller mode: only show listings owned by the logged-in user
        return Number(listing.seller_id) === currentUserId;
      } else {
        // Buyer mode: show active and verified listings (or user's own)
        return listing.status === 'ACTIVE' && (
          listing.verification_status === 'APPROVED' || 
          !listing.verification_status || 
          Number(listing.seller_id) === currentUserId
        );
      }
    })
    .filter((listing) => {
      if (selectedCategory === 'All') return true;
      return getListingCategory(listing) === selectedCategory;
    })
    .filter((listing) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        listing.title.toLowerCase().includes(q) ||
        (listing.description || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const priceA = a.discount_price !== undefined && a.discount_price !== null ? a.discount_price : a.price;
      const priceB = b.discount_price !== undefined && b.discount_price !== null ? b.discount_price : b.price;

      if (sortOption === 'price_asc') {
        return priceA - priceB;
      } else if (sortOption === 'price_desc') {
        return priceB - priceA;
      } else {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      }
    });

  return (
    <div id="market_dashboard" className="flex-1 bg-transparent p-0 w-full text-text-primary">
      {/* Top Header Segment */}
      <div className="flex items-center justify-between gap-2 border-b border-velum-600 p-3 shrink-0">
        <div className="flex items-center gap-2">
          {/* Toggle Mode Switch */}
          <div className="flex items-center gap-1 bg-velum-800 p-1 rounded-lg border border-velum-600">
            <button
              onClick={() => {
                setMode('buyer');
                setShowCreate(false);
              }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                mode === 'buyer'
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'text-text-secondary hover:text-text-primary border border-transparent'
              }`}
            >
              {t('market.buyer_mode', 'Buyer')}
            </button>
            <button
              onClick={() => {
                setMode('seller');
              }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                mode === 'seller'
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'text-text-secondary hover:text-text-primary border border-transparent'
              }`}
            >
              {t('market.seller_mode', 'Seller')}
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {(currentUserRole === 'CLI_ADMIN' || currentUserRole === 'LOGIN_ADMIN' || currentUserRole === 'SUPPORT_ADMIN') && (
            <button
              onClick={() => setShowCouponCreator(!showCouponCreator)}
              className="px-2.5 py-1.5 border border-velum-600 hover:border-accent/40 bg-velum-800 rounded-lg text-xs font-medium text-accent transition cursor-pointer"
            >
              Coupons
            </button>
          )}

          {mode === 'buyer' && (
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-1.5 border border-velum-600 hover:border-accent/40 bg-velum-800 rounded-lg text-text-primary transition cursor-pointer flex items-center justify-center"
              title="Shopping Cart"
            >
              <ShoppingBag className="w-4 h-4 text-accent" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-accent text-black text-xs font-bold h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full leading-none">
                  {cartCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {showCouponCreator && (
        <CouponCreator
          fetchSessionId={fetchSessionId}
          onCancel={() => setShowCouponCreator(false)}
          onSuccess={() => {
            setShowCouponCreator(false);
            loadMarket();
          }}
        />
      )}

      {/* Seller Mode Header/Creator Row */}
      {mode === 'seller' && (
        <div className="bg-velum-800 border border-velum-600 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
          <div>
            <h4 className="text-xs font-semibold text-text-primary">Your listings</h4>
            <p className="text-xs text-text-secondary mt-0.5">
              Manage items and open orders.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="w-full md:w-auto px-4 py-2 bg-accent hover:bg-accent-hover text-black rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showCreate ? 'Close Form' : 'New Listing'}</span>
          </button>
        </div>
      )}

      {showCreate && mode === 'seller' && (
        <div>
          <ListingCreator
            fetchSessionId={fetchSessionId}
            onCancel={() => setShowCreate(false)}
            onSuccess={() => {
              setShowCreate(false);
              loadMarket();
            }}
          />
        </div>
      )}

      {/* Custom Search Bar & Filter Rail */}
      {mode === 'buyer' && (
        <div className="space-y-2.5 shrink-0">
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-text-disabled absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search listings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-velum-750 border border-velum-600 focus:border-accent/40 rounded-lg text-xs text-text-primary placeholder-text-disabled outline-none transition-all"
              />
            </div>

            {/* Custom Sort Dropdown */}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 border border-velum-600 hover:border-accent/40 bg-velum-750 rounded-lg text-xs font-medium text-text-primary transition-all cursor-pointer whitespace-nowrap"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="hidden sm:inline">
                  {sortOption === 'price_asc' && 'Price: Low to High'}
                  {sortOption === 'price_desc' && 'Price: High to Low'}
                  {sortOption === 'newest' && 'Newest'}
                </span>
                <span className="text-xs text-text-secondary">▼</span>
              </button>
              
              {isSortDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-20" 
                    onClick={() => setIsSortDropdownOpen(false)}
                  />
                  <div className="bg-velum-800 border border-velum-600 p-1 max-h-60 overflow-y-auto rounded-lg shadow-xl absolute right-0 mt-1 z-30 min-w-[160px] flex flex-col space-y-0.5">
                    <button
                      onClick={() => {
                        setSortOption('newest');
                        setIsSortDropdownOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 text-left text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        sortOption === 'newest' ? 'bg-accent/15 text-accent' : 'text-text-primary hover:bg-velum-750'
                      }`}
                    >
                      Newest Arrivals
                    </button>
                    <button
                      onClick={() => {
                        setSortOption('price_asc');
                        setIsSortDropdownOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 text-left text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        sortOption === 'price_asc' ? 'bg-accent/15 text-accent' : 'text-text-primary hover:bg-velum-750'
                      }`}
                    >
                      Price: Low to High
                    </button>
                    <button
                      onClick={() => {
                        setSortOption('price_desc');
                        setIsSortDropdownOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 text-left text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        sortOption === 'price_desc' ? 'bg-accent/15 text-accent' : 'text-text-primary hover:bg-velum-750'
                      }`}
                    >
                      Price: High to Low
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Interactive Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none border-b border-velum-600">
            {MARKET_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap border ${
                  selectedCategory === cat
                    ? 'bg-accent/15 border-accent/30 text-accent'
                    : 'bg-transparent border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Listings Grid */}
      <MarketListingsView 
        listings={filteredListings}
        loading={loading}
        currentUserId={currentUserId}
        onSelectListing={(listing) => setSelectedInspectListing(listing)}
        onBuyListing={(listing) => setCheckoutListing(listing)}
      />

      {selectedInspectListing && (
        <ListingInspector
          listing={selectedInspectListing}
          currentUserId={currentUserId}
          onClose={() => setSelectedInspectListing(null)}
          onBuy={(listing, variant) => {
            setSelectedInspectListing(null);
            setCheckoutListing(listing);
            setCheckoutVariant(variant || null);
          }}
          onAddToCart={addToCart}
          fetchSessionId={fetchSessionId}
        />
      )}

      {/* Escrow System Panel */}
      <MarketEscrowsView 
        escrows={escrows}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onSandboxTest={handleSandboxTest}
        onReleaseEscrow={handleReleaseEscrow}
        onRevertEscrow={handleRevertEscrow}
      />

      {checkoutListing && (
        <CheckoutFlow 
          listing={checkoutListing}
          chosenVariant={checkoutVariant}
          fetchSessionId={fetchSessionId}
          onCancel={() => {
            setCheckoutListing(null);
            setCheckoutVariant(null);
          }}
          onSuccess={() => {
            setCheckoutListing(null);
            setCheckoutVariant(null);
            loadMarket();
          }}
        />
      )}

      <ShoppingCartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        fetchSessionId={fetchSessionId}
        onCheckoutSuccess={loadMarket}
      />
    </div>
  );
}
