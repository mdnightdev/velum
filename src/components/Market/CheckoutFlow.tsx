import React, { useState } from 'react';
import { MarketListing } from '../../types';
import { ShieldCheck, Check, AlertTriangle, X } from 'lucide-react';

interface CheckoutFlowProps {
  listing: MarketListing;
  chosenVariant?: any;
  onCancel: () => void;
  onSuccess: () => void;
  fetchSessionId: () => string;
}

export function CheckoutFlow({ listing, chosenVariant, onCancel, onSuccess, fetchSessionId }: CheckoutFlowProps) {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');

  const additionalCost = chosenVariant ? (chosenVariant.additional_cost_cents / 100) : 0;
  const activePrice = (listing.discount_price !== undefined && listing.discount_price !== null 
    ? listing.discount_price 
    : listing.price) + additionalCost;

  const handleVerifyCoupon = async () => {
    if (!couponCode) return;
    setCouponError('');
    try {
      const sId = fetchSessionId();
      const res = await fetch('/v2/marketplace/coupons/validate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          listingId: listing.listing_id,
          couponCode: couponCode.trim(),
          skuVariantId: chosenVariant?.variant_id
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAppliedCoupon(data);
      } else {
        const data = await res.json();
        setCouponError(data.error || 'Failed to apply coupon.');
      }
    } catch (err) {
      setCouponError('Network error validating coupon.');
    }
  };

  const handleConfirmCheckoutAndEscrow = async () => {
    setCheckoutError('');
    try {
      const sId = fetchSessionId();
      const payload: any = { 
        listingId: listing.listing_id,
        skuVariantId: chosenVariant?.variant_id
      };
      if (appliedCoupon?.code) {
        payload.couponCode = appliedCoupon.code;
      }
      const res = await fetch('/v2/marketplace/escrows', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        onSuccess();
      } else {
        setCheckoutError("Escrow acquisition failed.");
      }
    } catch (err) {
      setCheckoutError("Network error during checkout.");
    }
  };

  const finalPrice = appliedCoupon ? appliedCoupon.finalPrice : activePrice;
  const platformFee = finalPrice * 0.05;

  return (
    <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4">
      <div className="bg-velum-800 border border-white-5 p-6 sm:p-8 rounded-2xl w-full max-w-md space-y-6 shadow-2xl relative">
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 text-text-secondary hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1">
          <span className="text-[10px] font-mono font-bold text-alert-success uppercase tracking-widest flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Checkout
          </span>
          <h3 className="text-lg font-sans font-black text-white">{listing.title}</h3>
        </div>

        <div className="space-y-3 pt-2">
          <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">
            Apply Promo Code
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="flex-1 bg-black/40 border border-white-5 rounded-xl px-3.5 py-2 text-xs text-white focus:border-alert-success focus:outline-none font-mono"
            />
            <button
              onClick={handleVerifyCoupon}
              className="px-4 bg-velum-700 hover:bg-velum-600 border border-white-5 text-[10px] font-bold text-white uppercase rounded-xl transition cursor-pointer"
            >
              Verify
            </button>
          </div>

          {appliedCoupon && (
            <div className="text-[10px] font-mono text-alert-success flex items-center gap-1 bg-status-online-bg p-2.5 rounded-lg">
              <Check className="w-3.5 h-3.5" />
              <span>Discount applied: -${Number(appliedCoupon.deduction || 0).toFixed(2)}</span>
            </div>
          )}
          {couponError && (
            <div className="text-[10px] font-mono text-status-dnd flex items-center gap-1 bg-status-dnd-bg p-2.5 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{couponError}</span>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-white-5 pt-5 font-mono text-[11px]">
          <div className="flex justify-between text-text-secondary">
            <span>Base Asset Sum:</span>
            <span>${Number(activePrice - additionalCost || 0).toFixed(2)}</span>
          </div>
          {chosenVariant && (
            <div className="flex justify-between text-text-secondary">
              <span>Variant (+{chosenVariant.attribute_value.replace(/_/g, ' ')}):</span>
              <span>+${Number(additionalCost || 0).toFixed(2)}</span>
            </div>
          )}
          {appliedCoupon && (
            <div className="flex justify-between text-alert-success">
              <span>Coupon Deduction:</span>
              <span>-${Number(appliedCoupon.deduction || 0).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-text-secondary">
            <span>Platform Commission (5%):</span>
            <span>${Number(platformFee || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-white font-black text-sm border-t border-white-5 pt-3">
            <span>Total Commitment:</span>
            <span className="text-alert-success">${Number(finalPrice || 0).toFixed(2)}</span>
          </div>
        </div>

        {checkoutError && (
          <div className="text-[10px] font-mono text-status-dnd flex items-center gap-1 bg-status-dnd-bg p-2.5 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{checkoutError}</span>
          </div>
        )}

        <button
          onClick={handleConfirmCheckoutAndEscrow}
          className="w-full py-3.5 bg-alert-success hover:bg-alert-success text-velum-900 text-[11px] font-sans font-black uppercase tracking-widest rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Confirm Purchase</span>
        </button>
      </div>
    </div>
  );
}
