import React, { createContext, useContext, useState, useEffect } from 'react';
import { MarketListing, MarketSkuVariant } from '../types';

export interface CartItem {
  id: string; // generated as listingId_variantId or listingId_default
  listing: MarketListing;
  selectedVariant: MarketSkuVariant | null;
  quantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (listing: MarketListing, selectedVariant: MarketSkuVariant | null, quantity?: number) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  platformFeeEstimation: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('velum-cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('velum-cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (listing: MarketListing, selectedVariant: MarketSkuVariant | null, quantity = 1) => {
    const variantId = selectedVariant ? selectedVariant.variant_id || selectedVariant.sku_id : 'default';
    const itemId = `${listing.listing_id}_${variantId}`;
    const maxStock = selectedVariant 
      ? (selectedVariant.inventory_count ?? 999) 
      : (listing.inventory_count ?? 999);

    setCartItems((prevItems) => {
      const existingIndex = prevItems.findIndex((item) => item.id === itemId);
      if (existingIndex > -1) {
        const updated = [...prevItems];
        const newQty = Math.min(updated[existingIndex].quantity + quantity, maxStock);
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty
        };
        return updated;
      } else {
        const initialQty = Math.min(quantity, maxStock);
        if (initialQty <= 0) return prevItems;
        return [
          ...prevItems,
          {
            id: itemId,
            listing,
            selectedVariant,
            quantity: initialQty
          }
        ];
      }
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCartItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === cartItemId) {
          const maxStock = item.selectedVariant 
            ? (item.selectedVariant.inventory_count ?? 999) 
            : (item.listing.inventory_count ?? 999);
          const newQty = Math.min(quantity, maxStock);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const cartSubtotal = cartItems.reduce((acc, item) => {
    const basePrice = item.listing.discount_price !== undefined && item.listing.discount_price !== null
      ? item.listing.discount_price
      : item.listing.price;
    const additionalCost = item.selectedVariant ? item.selectedVariant.additional_cost_cents / 100 : 0;
    return acc + (basePrice + additionalCost) * item.quantity;
  }, 0);

  const platformFeeEstimation = cartSubtotal * 0.05;
  const totalPrice = cartSubtotal + platformFeeEstimation;

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartCount,
      cartSubtotal,
      platformFeeEstimation,
      totalPrice
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
