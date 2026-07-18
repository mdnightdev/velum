import React, { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { X, Trash2, Plus, Minus, ShoppingBag, ShieldCheck, AlertTriangle, Check } from 'lucide-react';

interface ShoppingCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  fetchSessionId: () => string;
  onCheckoutSuccess?: () => void;
}

export function ShoppingCartDrawer({ isOpen, onClose, fetchSessionId, onCheckoutSuccess }: ShoppingCartDrawerProps) {
  const {
    cartItems,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartCount,
    cartSubtotal,
    platformFeeEstimation,
    totalPrice
  } = useCart();

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [checkoutErrorMsg, setCheckoutErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    setCheckoutErrorMsg('');
    try {
      const sId = fetchSessionId();
      // Step 2 will fully build the backend batch-checkout route.
      // For Step 1, we simulate checkout or call the endpoint with fallback behavior.
      const res = await fetch('/api/marketplace/cart/checkout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: cartItems.map(item => ({
            listingId: item.listing.listing_id,
            skuVariantId: item.selectedVariant?.variant_id || null,
            quantity: item.quantity
          }))
        })
      });

      if (res.ok) {
        setCheckoutStatus('success');
        setTimeout(() => {
          clearCart();
          setCheckoutStatus('idle');
          setIsCheckingOut(false);
          onClose();
          if (onCheckoutSuccess) onCheckoutSuccess();
        }, 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setCheckoutStatus('error');
        setCheckoutErrorMsg(errData.error || 'Checkout process failed.');
        setIsCheckingOut(false);
      }
    } catch (err) {
      setCheckoutStatus('error');
      setCheckoutErrorMsg('Network communication error during checkout.');
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-velum-900/80 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        {/* Panel */}
        <div className="w-screen max-w-md bg-velum-850 border-l border-white-5 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
          
          {/* Header */}
          <div className="p-6 border-b border-white-5 flex items-center justify-between bg-velum-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-accent/10 rounded-xl">
                <ShoppingBag className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-sans font-black text-white uppercase tracking-wider">
                  Shopping Cart
                </h3>
                <p className="text-[10px] font-mono text-text-secondary mt-0.5">
                  {cartCount} {cartCount === 1 ? 'item' : 'items'}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-white-5 rounded-lg text-text-secondary hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Cart Items Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-none">
            {checkoutStatus === 'success' ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 p-4 animate-in fade-in duration-200">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-sans">Checkout Approved</h4>
                <p className="text-xs text-text-secondary leading-relaxed max-w-xs font-sans font-medium">
                  Multi-item purchase successfully established. Syncing ledgers...
                </p>
              </div>
            ) : cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 p-4">
                <ShoppingBag className="w-10 h-10 text-text-disabled/40" />
                <h4 className="text-xs font-mono uppercase tracking-wider font-bold text-text-secondary">Your Cart is Empty</h4>
                <p className="text-[10px] text-text-disabled leading-relaxed max-w-xs font-sans font-medium">
                  Explore available software assets and add them to your cart.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {cartItems.map((item) => {
                  const basePrice = item.listing.discount_price !== undefined && item.listing.discount_price !== null
                    ? item.listing.discount_price
                    : item.listing.price;
                  const additionalCost = item.selectedVariant ? item.selectedVariant.additional_cost_cents / 100 : 0;
                  const itemUnitPrice = basePrice + additionalCost;

                  return (
                    <div 
                      key={item.id} 
                      className="bg-velum-800/40 border border-white-5 rounded-2xl p-4 flex gap-4 hover:border-white-10 transition-all"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs font-bold text-white line-clamp-1 leading-snug">
                            {item.listing.title}
                          </h4>
                          <span className="text-xs font-mono font-bold text-accent shrink-0">
                            ${(itemUnitPrice * item.quantity).toFixed(2)}
                          </span>
                        </div>

                        {item.selectedVariant && (
                          <div className="text-[9px] font-mono text-text-secondary bg-black/20 px-2 py-1 rounded-md border border-white-5 w-fit">
                            Option: <span className="text-white font-bold">{item.selectedVariant.attribute_value.replace(/_/g, ' ')}</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-white-5">
                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2.5 bg-black/40 rounded-xl p-1 border border-white-5">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="p-1 hover:bg-white-5 rounded-lg text-text-secondary hover:text-white transition cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-mono font-bold text-white px-1 shrink-0 min-w-[12px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="p-1 hover:bg-white-5 rounded-lg text-text-secondary hover:text-white transition cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Trash button */}
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1.5 hover:bg-rose-500/10 text-text-disabled hover:text-rose-400 border border-transparent hover:border-rose-500/10 rounded-xl transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Area */}
          {cartItems.length > 0 && checkoutStatus !== 'success' && (
            <div className="p-6 border-t border-white-5 bg-velum-800 space-y-4">
              {checkoutStatus === 'error' && (
                <div className="text-[10px] font-mono text-status-dnd flex items-start gap-1.5 bg-status-dnd/10 p-3 rounded-xl border border-status-dnd/20">
                  <AlertTriangle className="w-4 h-4 text-status-dnd shrink-0 mt-0.5" />
                  <div>
                    <div className="font-extrabold uppercase text-[9px] tracking-wide">Checkout Issue</div>
                    <div className="text-[9px] text-text-secondary leading-relaxed mt-0.5">{checkoutErrorMsg}</div>
                  </div>
                </div>
              )}

              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between text-text-secondary">
                  <span>Basket Subtotal:</span>
                  <span>${cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Est. Platform Fee (5%):</span>
                  <span>+${platformFeeEstimation.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white font-extrabold text-sm border-t border-white-5 pt-3">
                  <span className="font-sans uppercase tracking-wider text-xs">Estimated Total:</span>
                  <span className="text-accent">${totalPrice.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={clearCart}
                  disabled={isCheckingOut}
                  className="py-3 border border-white-5 bg-velum-700 hover:bg-velum-600 hover:text-white text-text-secondary text-[10px] font-mono uppercase font-black tracking-widest rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Clear Cart
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="py-3 bg-accent hover:bg-accent-hover text-velum-900 text-[10px] font-sans font-black uppercase tracking-widest rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{isCheckingOut ? 'Processing...' : 'Checkout'}</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
