import { DiscountType, TierRule } from '../../src/types';

export interface CouponContext {
  discount_type: DiscountType;
  value_cents_or_pct: number;
  tier_rules?: TierRule[];
  minimum_order_value_cents: number;
  active: boolean;
  expiration_date: number; // epoch ms
  usage_limit: number;
  usage_count: number;
}

export interface SettlementResult {
  gross_amount_cents: number;
  discount_deduction_cents: number;
  net_tax_amount_cents: number;
  platform_fee_deduction_cents: number;
  payout_net_amount_cents: number;
  error?: string;
}

export function calculateOrderSettlement(
  grossAmountCents: number,
  taxRate: number,
  platformFeeRate: number,
  coupon?: CouponContext,
  nowMs: number = Date.now()
): SettlementResult {
  const zeroResult = (error: string): SettlementResult => ({
    gross_amount_cents: grossAmountCents,
    discount_deduction_cents: 0,
    net_tax_amount_cents: 0,
    platform_fee_deduction_cents: 0,
    payout_net_amount_cents: 0,
    error,
  });

  let discountCents = 0;

  if (coupon) {
    if (!coupon.active) return zeroResult('Coupon is inactive.');
    if (nowMs > coupon.expiration_date) return zeroResult('Coupon has expired.');
    if (coupon.usage_count >= coupon.usage_limit) return zeroResult('Coupon usage limit reached.');
    if (grossAmountCents < coupon.minimum_order_value_cents) {
      return zeroResult('Minimum order threshold unsatisfied.');
    }

    switch (coupon.discount_type) {
      case 'PERCENTAGE':
        discountCents = Math.floor(grossAmountCents * (coupon.value_cents_or_pct / 100));
        break;
      case 'FIXED':
        discountCents = coupon.value_cents_or_pct;
        break;
      case 'TIERED': {
        if (!coupon.tier_rules?.length) return zeroResult('Tiered coupon missing tier rules.');
        const applicable = [...coupon.tier_rules]
          .filter(t => grossAmountCents >= t.min_cents)
          .sort((a, b) => b.min_cents - a.min_cents)[0];
        discountCents = applicable ? applicable.deduction_cents : 0;
        break;
      }
    }
  }

  const orderTotalCents = Math.max(0, grossAmountCents - discountCents);
  const taxCents = Math.floor(orderTotalCents * taxRate);
  const totalWithTaxCents = orderTotalCents + taxCents;
  const platformFeeCents = Math.floor(totalWithTaxCents * platformFeeRate);
  const sellerPayoutCents = totalWithTaxCents - platformFeeCents;

  return {
    gross_amount_cents: grossAmountCents,
    discount_deduction_cents: discountCents,
    net_tax_amount_cents: taxCents,
    platform_fee_deduction_cents: platformFeeCents,
    payout_net_amount_cents: sellerPayoutCents,
  };
}
