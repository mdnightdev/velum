import React, { useState, useEffect, useCallback } from 'react';
import { MarketListing, EscrowTransaction } from '../../types';
import { Plus } from 'lucide-react';

import { MarketListingsView } from '../Market/MarketListingsView';
import { MarketEscrowsView } from '../Market/MarketEscrowsView';
import { ListingCreator } from '../Market/ListingCreator';
import { CouponCreator } from '../Market/CouponCreator';
import { CheckoutFlow } from '../Market/CheckoutFlow';
import { ListingInspector } from '../Market/ListingInspector';

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
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [escrows, setEscrows] = useState<EscrowTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [showCouponCreator, setShowCouponCreator] = useState(false);
  const [checkoutListing, setCheckoutListing] = useState<MarketListing | null>(null);
  const [checkoutVariant, setCheckoutVariant] = useState<any | null>(null);
  const [selectedInspectListing, setSelectedInspectListing] = useState<MarketListing | null>(null);

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

  return (
    <div id="market_dashboard" className="flex-1 bg-transparent p-6 lg:p-8 space-y-7 text-text-primary">
      <div className="flex justify-end mb-2">
        <div className="flex gap-2 shrink-0">
          {(currentUserRole === 'CLI_ADMIN' || currentUserRole === 'LOGIN_ADMIN' || currentUserRole === 'SUPPORT_ADMIN') && (
            <button
              onClick={() => setShowCouponCreator(!showCouponCreator)}
              className="px-3.5 py-1.5 border border-white-5 hover:border-accent/20 bg-text-primary/[0.01] hover:bg-accent/5 rounded-xl text-[10px] font-bold uppercase text-accent font-sans tracking-wide transition cursor-pointer"
            >
              Admin Coupons
            </button>
          )}
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-velum-900 text-[10px] font-extrabold uppercase py-2 px-4 rounded-xl transition cursor-pointer font-sans tracking-wider"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showCreate ? 'Close Form' : 'New Listing'}</span>
          </button>
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

      {showCreate && (
        <ListingCreator
          fetchSessionId={fetchSessionId}
          onCancel={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            loadMarket();
          }}
        />
      )}

      <MarketListingsView 
        listings={listings}
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
          fetchSessionId={fetchSessionId}
        />
      )}

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
    </div>
  );
}
