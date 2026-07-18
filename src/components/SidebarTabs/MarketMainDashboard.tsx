import React, { useState, useEffect, useCallback } from 'react';
import { MarketListing, EscrowTransaction } from '../../types';
import { ShoppingBag, Search, SlidersHorizontal, Plus, Sparkles, Terminal, Code, ShieldCheck, Database, Cpu } from 'lucide-react';

import { MarketListingsView } from '../Market/MarketListingsView';
import { MarketEscrowsView } from '../Market/MarketEscrowsView';
import { ListingCreator } from '../Market/ListingCreator';
import { CouponCreator } from '../Market/CouponCreator';
import { CheckoutFlow } from '../Market/CheckoutFlow';
import { ListingInspector } from '../Market/ListingInspector';
import { ShoppingCartDrawer } from '../Market/ShoppingCartDrawer';
import { useCart } from '../../context/CartContext';

interface MarketMainDashboardProps {
  currentUserId: number;
  currentUserRole: string;
  isDark?: boolean;
}

const TECH_CATEGORIES = [
  'All',
  'Automation Scripts',
  'Developer Utilities',
  'Source Modules',
  'Security Audits',
  'Data Pipelines'
];

export default function MarketMainDashboard({
  currentUserId,
  currentUserRole,
  isDark = true
}: MarketMainDashboardProps) {
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

  const fetchSessionId = () => sessionStorage.getItem('velum-sessionId') || '';

  const loadMarket = useCallback(async () => {
    try {
      const sId = fetchSessionId();
      const headers = { 'Authorization': `Bearer ${sId}` };
      const [listingsRes, escrowsRes] = await Promise.all([
        fetch('/api/marketplace/listings', { headers }),
        fetch('/api/marketplace/escrows', { headers })
      ]);
      if (listingsRes.ok) setListings(await listingsRes.json());
      if (escrowsRes.ok) setEscrows(await escrowsRes.json());
    } catch (err) {
      console.warn('Sync issue in marketplace loading:', err);
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
      await fetch(`/api/marketplace/escrows/${transactionId}/test-sandbox`, {
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
      await fetch(`/api/marketplace/escrows/${transactionId}/release`, {
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
      await fetch(`/api/marketplace/escrows/${transactionId}/revert`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      loadMarket();
    } catch (err) {
      console.warn("Revert failed");
    }
  };

  // Helper to determine category of a listing dynamically (consistent with MarketListingsView)
  const getListingCategory = (listing: MarketListing) => {
    const text = (listing.title + ' ' + (listing.description || '')).toLowerCase();
    if (text.includes('script') || text.includes('automation') || text.includes('cron') || text.includes('job') || text.includes('action')) {
      return 'Automation Scripts';
    }
    if (text.includes('audit') || text.includes('security') || text.includes('scan') || text.includes('protect') || text.includes('firewall')) {
      return 'Security Audits';
    }
    if (text.includes('pipeline') || text.includes('data') || text.includes('sync') || text.includes('db') || text.includes('etl') || text.includes('query')) {
      return 'Data Pipelines';
    }
    if (text.includes('module') || text.includes('lib') || text.includes('package') || text.includes('source') || text.includes('core')) {
      return 'Source Modules';
    }
    return 'Developer Utilities';
  };

  // Filter & Sort Logic
  const filteredListings = listings
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
    <div id="market_dashboard" className="flex-1 bg-transparent p-6 lg:p-8 space-y-7 text-text-primary">
      {/* Top Header Segment: Workspace toggle mode, cart, and admin functions */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 border-b border-white-5 pb-5 shrink-0">
        {/* Toggle Mode Switch */}
        <div className="flex items-center gap-1.5 bg-black-40 p-1.5 rounded-2xl border border-white-5 self-start">
          <button
            onClick={() => {
              setMode('buyer');
              setShowCreate(false);
            }}
            className={`px-4 py-2 rounded-xl text-[10px] font-mono uppercase tracking-widest font-black transition-all cursor-pointer ${
              mode === 'buyer'
                ? 'bg-accent/15 text-white border border-accent/20 shadow-md'
                : 'text-text-secondary hover:text-white border border-transparent'
            }`}
          >
            Buyer Mode
          </button>
          <button
            onClick={() => {
              setMode('seller');
            }}
            className={`px-4 py-2 rounded-xl text-[10px] font-mono uppercase tracking-widest font-black transition-all cursor-pointer ${
              mode === 'seller'
                ? 'bg-accent/15 text-white border border-accent/20 shadow-md'
                : 'text-text-secondary hover:text-white border border-transparent'
            }`}
          >
            Seller Mode
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 justify-end">
          {(currentUserRole === 'CLI_ADMIN' || currentUserRole === 'LOGIN_ADMIN' || currentUserRole === 'SUPPORT_ADMIN') && (
            <button
              onClick={() => setShowCouponCreator(!showCouponCreator)}
              className="px-3.5 py-2 border border-white-5 hover:border-accent/20 bg-text-primary/[0.01] hover:bg-accent/5 rounded-xl text-[10px] font-bold uppercase text-accent font-sans tracking-wide transition cursor-pointer"
            >
              Admin Coupons
            </button>
          )}

          {mode === 'buyer' && (
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 border border-white-5 hover:border-accent/20 bg-text-primary/[0.01] hover:bg-accent/5 rounded-xl text-white transition cursor-pointer flex items-center justify-center"
              title="Shopping Cart"
            >
              <ShoppingBag className="w-4 h-4 text-accent" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-accent text-velum-900 text-[8px] font-mono font-black h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full leading-none shadow-lg">
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
        <div className="bg-velum-850/60 border border-white-5 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in duration-150 shrink-0">
          <div className="space-y-1 text-center md:text-left">
            <h4 className="text-xs font-mono uppercase tracking-widest text-accent font-black">Seller Dashboard</h4>
            <p className="text-[10px] text-text-secondary leading-relaxed font-medium">
              Manage your published tech utilities, automation tools, and pending escrow contracts.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="w-full md:w-auto px-5 py-2.5 bg-accent hover:bg-accent-hover text-velum-900 rounded-xl text-[10px] font-sans font-black uppercase tracking-widest transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showCreate ? 'Close Form' : 'New Listing'}</span>
          </button>
        </div>
      )}

      {showCreate && mode === 'seller' && (
        <div className="animate-in fade-in duration-200">
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

      {/* Custom Search Bar & Filter Rail (S3-free & Glass Sorting dropdown) */}
      {mode === 'buyer' && (
        <div className="space-y-4 shrink-0">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-text-disabled absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tech listings, scripts, utility tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-velum-850 border border-white-5 focus:border-accent/40 rounded-xl text-xs text-white placeholder-text-disabled font-sans font-medium outline-none transition-all duration-150"
              />
            </div>

            {/* Custom Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="w-full md:w-auto flex items-center justify-between gap-4 px-4 py-2.5 border border-white-5 hover:border-accent/30 bg-velum-850 rounded-xl text-xs font-mono font-bold text-white transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-accent" />
                  <span>
                    {sortOption === 'price_asc' && 'Price: Low to High'}
                    {sortOption === 'price_desc' && 'Price: High to Low'}
                    {sortOption === 'newest' && 'Newest Arrivals'}
                  </span>
                </div>
                <span className="text-[9px] text-accent font-black">▼</span>
              </button>
              
              {isSortDropdownOpen && (
                <>
                  {/* Overlay to catch clicks and close */}
                  <div 
                    className="fixed inset-0 z-20" 
                    onClick={() => setIsSortDropdownOpen(false)}
                  />
                  <div className="glass-panel p-1.5 max-h-60 overflow-y-auto rounded-lg shadow-xl absolute right-0 mt-2 z-30 min-w-[190px] border border-white-10 flex flex-col space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                      onClick={() => {
                        setSortOption('newest');
                        setIsSortDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-[11px] font-sans font-semibold rounded-lg transition-colors ${
                        sortOption === 'newest' ? 'bg-accent/15 text-white' : 'text-text-secondary hover:bg-white-5 hover:text-white'
                      }`}
                    >
                      Newest Arrivals
                    </button>
                    <button
                      onClick={() => {
                        setSortOption('price_asc');
                        setIsSortDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-[11px] font-sans font-semibold rounded-lg transition-colors ${
                        sortOption === 'price_asc' ? 'bg-accent/15 text-white' : 'text-text-secondary hover:bg-white-5 hover:text-white'
                      }`}
                    >
                      Price: Low to High
                    </button>
                    <button
                      onClick={() => {
                        setSortOption('price_desc');
                        setIsSortDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-[11px] font-sans font-semibold rounded-lg transition-colors ${
                        sortOption === 'price_desc' ? 'bg-accent/15 text-white' : 'text-text-secondary hover:bg-white-5 hover:text-white'
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
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none border-b border-white-5">
            {TECH_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest font-black transition-all cursor-pointer whitespace-nowrap border ${
                  selectedCategory === cat
                    ? 'bg-accent/10 border-accent/30 text-white'
                    : 'bg-transparent border-transparent text-text-secondary hover:text-white'
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
