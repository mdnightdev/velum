import React, { useState } from 'react';
import { MarketListing } from '../../types';
import { Check, AlertTriangle, X } from 'lucide-react';
import { formatListingPrice } from './MarketListingsView';

interface CheckoutFlowProps {
  listing: MarketListing;
  chosenVariant?: any;
  onCancel: () => void;
  onSuccess: () => void;
  fetchSessionId: () => string;
}

export function CheckoutFlow({ listing, chosenVariant, onCancel, onSuccess, fetchSessionId }: CheckoutFlowProps) {
  const listingCurrency = (listing.currency || 'EUR').toUpperCase();
  const [payCurrency, setPayCurrency] = useState(listingCurrency === 'VLM' ? 'VLM' : 'EUR');
  const [checkoutError, setCheckoutError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const additionalCost = chosenVariant ? chosenVariant.additional_cost_cents / 100 : 0;
  const activePrice =
    (listing.discount_price !== undefined && listing.discount_price !== null
      ? listing.discount_price
      : listing.price) + additionalCost;

  const handleConfirmCheckoutAndEscrow = async () => {
    setCheckoutError('');
    setSubmitting(true);
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/v2/marketplace/listings/${listing.listing_id}/purchase`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sId}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payCurrency }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        setCheckoutError(data.error || 'Purchase failed.');
      }
    } catch {
      setCheckoutError('Network error during checkout.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4">
      <div className="bg-velum-800 border border-velum-600 p-5 sm:p-6 rounded-xl w-full max-w-md space-y-4 shadow-2xl relative">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-text-secondary hover:text-text-primary cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1 pr-8">
          <span className="text-xs font-medium text-text-secondary">Checkout</span>
          <h3 className="text-sm font-semibold text-text-primary">{listing.title}</h3>
        </div>

        <div className="space-y-2 border-t border-velum-600 pt-4 text-xs">
          <div className="flex justify-between text-text-secondary">
            <span>Price</span>
            <span className="font-mono text-text-primary">
              {formatListingPrice(activePrice, listingCurrency)}
            </span>
          </div>
          <div className="space-y-1.5">
            <span className="text-text-secondary block">Pay with</span>
            <div className="flex gap-2">
              {(['EUR', 'VLM'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPayCurrency(c)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                    payCurrency === c
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-velum-600 bg-velum-750 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            {payCurrency !== listingCurrency && (
              <p className="text-[11px] text-text-secondary">
                Listing is in {listingCurrency}; you will pay in {payCurrency} at the spot rate.
              </p>
            )}
          </div>
        </div>

        {checkoutError && (
          <div className="text-xs text-status-dnd flex items-center gap-1.5 bg-status-dnd/10 border border-status-dnd/30 p-2.5 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{checkoutError}</span>
          </div>
        )}

        <button
          onClick={handleConfirmCheckoutAndEscrow}
          disabled={submitting}
          className="w-full py-2.5 bg-accent hover:bg-accent-hover text-black text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          <span>{submitting ? 'Working…' : 'Confirm purchase'}</span>
        </button>
      </div>
    </div>
  );
}
