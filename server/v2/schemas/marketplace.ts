import { z } from 'zod';

export const createListingSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(128, 'Title cannot exceed 128 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(4096, 'Description too long'),
  price: z.number().positive('Price must be greater than zero'),
  category: z.string().min(1, 'Category is required'),
  tags: z.array(z.string()).optional().default([]),
  images: z.array(z.string().url('Invalid image URL')).optional().default([]),
  stock: z.number().int().nonnegative('Stock cannot be negative').default(1),
  digitalDelivery: z.boolean().default(false),
  digitalPayload: z.string().optional()
});

export const updateListingSchema = createListingSchema.partial();

export const addToCartSchema = z.object({
  listingId: z.string().min(1, 'Listing ID is required'),
  quantity: z.number().int().positive('Quantity must be at least 1').default(1)
});

export const applyCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required').trim().toUpperCase()
});

export const checkoutSchema = z.object({
  cartItems: z.array(
    z.object({
      listingId: z.string().min(1),
      quantity: z.number().int().positive()
    })
  ).min(1, 'Cart cannot be empty'),
  shippingAddress: z.string().optional(),
  couponCode: z.string().optional()
});

export const escrowActionSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
  action: z.enum(['RELEASE', 'DISPUTE', 'REFUND']),
  reason: z.string().max(1024).optional()
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type EscrowActionInput = z.infer<typeof escrowActionSchema>;
