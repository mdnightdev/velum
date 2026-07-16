import { db, saveDb } from '../db.js';
import { marketRepository } from '../db/marketRepository.js';
import { walletRepository } from '../db/walletRepository.js';
import { generateTrcCode } from '../utils/trc.js';
import { generatePrefixedId } from '../utils/ulid.js';
import { getLockForUser } from '../utils/lockManager.js';
import { EscrowTransaction } from '../../src/types.js';
import { calculateOrderSettlement } from '../utils/marketEngine.js';

export interface EscrowActionResult {
  success: boolean;
  error?: string;
  escrow?: EscrowTransaction;
  chat?: any;
}

export async function processCreateEscrow(
  listingId: string,
  buyerId: number,
  buyerUsername: string,
  couponCode?: string,
  skuVariantId?: string
): Promise<EscrowActionResult> {
  const buyerLock = getLockForUser(buyerId);
  return await buyerLock.run(async () => {
    const listing = marketRepository.findListingById(listingId);
    if (!listing) return { success: false, error: 'Listing not found.' };
    if (listing.status !== 'ACTIVE') return { success: false, error: 'Listing is no longer active.' };
    if (listing.verification_status && listing.verification_status !== 'APPROVED') return { success: false, error: 'Listing is pending verification.' };
    if (listing.inventory_count !== undefined && listing.inventory_count <= 0) return { success: false, error: 'Listing is out of stock.' };
    if (Number(listing.seller_id) === Number(buyerId)) return { success: false, error: 'You are forbidden from acquiring your own listings.' };

    const basePrice = (listing.discount_price !== undefined && listing.discount_price !== null) ? listing.discount_price : listing.price;
    const basePriceCents = Math.round(basePrice * 100);
    
    let additionalCostCents = 0;
    let selectedSku: any = undefined;
    if (skuVariantId) {
      db.market_sku_variants = db.market_sku_variants || [];
      selectedSku = db.market_sku_variants.find(s => s && s.sku_id === skuVariantId);
      if (selectedSku) {
        additionalCostCents = selectedSku.additional_cost_cents || 0;
      }
    }

    const itemPriceCents = basePriceCents + additionalCostCents;

    let validatedCouponApplied: string | undefined = undefined;
    let couponObj: any = undefined;
    if (couponCode) {
      const targetCode = couponCode.toUpperCase().trim();
      const coupon = marketRepository.findCouponByCode(targetCode);
      if (coupon) couponObj = coupon;
    }

    const settlement = calculateOrderSettlement(itemPriceCents, 0, 0.05, couponObj);
    if (settlement.error) return { success: false, error: settlement.error };

    if (couponObj) {
      marketRepository.updateCoupon(couponObj.coupon_id, {
        usage_count: (couponObj.usage_count || 0) + 1
      });
      validatedCouponApplied = couponObj.code;
    }

    if (listing.inventory_count !== undefined) {
      const updatedInventory = listing.inventory_count - 1;
      marketRepository.updateListing(listing.listing_id, {
        inventory_count: updatedInventory,
        status: updatedInventory <= 0 ? 'OUT_OF_STOCK' : 'ACTIVE'
      });
    } else {
      marketRepository.updateListing(listing.listing_id, {
        status: 'PENDING_ESCROW'
      });
    }

    const priceCents = settlement.gross_amount_cents - settlement.discount_deduction_cents + settlement.net_tax_amount_cents;
    const buyerWallet = walletRepository.getOrCreateWallet(buyerId);
    if (buyerWallet.balance_cents < priceCents) {
      return { success: false, error: 'Insufficient wallet ledger balance.' };
    }

    const platformFee = parseFloat((settlement.platform_fee_deduction_cents / 100).toFixed(2));
    const finalPayout = parseFloat((settlement.payout_net_amount_cents / 100).toFixed(2));
    const transactionId = generateTrcCode('hold', 'AST48');

    walletRepository.updateWalletBalance(buyerId, buyerWallet.balance_cents - priceCents);
    walletRepository.createLedgerEntry({
      entry_id: generateTrcCode('hold', 'AST48'),
      user_id: Number(buyerId),
      entry_type: 'ESCROW_HOLD',
      amount_cents: -priceCents,
      balance_after_cents: buyerWallet.balance_cents - priceCents,
      related_transaction_id: transactionId,
      actor_type: 'USER',
      actor_id: String(buyerId),
      is_simulated: true,
      created_at: Date.now()
    });

    const sandbox_logs = [
      `[SYS-SECURE] INITIALIZING ISO-WORKER DOCK STATE...`,
      ` ALLOCATING SECURE MEMORY CELL: 16.00MB RAM`,
      ` INGESTING EXECUTABLE BUNDLE: ${listing.title.replace(/\s+/g, '_').toLowerCase()}.zip`,
      ` ANALYZING RAW BUFFER FOR METADATA LEAKS... CLEAN`,
      ` RUNNING SYNTAX VERIFICATION THROUGHOUT MODULE POOL...`,
      ` ISOLATION VERIFICATION INITIATED ON HELD_IN_ESCROW BUFFER...`
    ];

    const newEscrow: EscrowTransaction = {
      transaction_id: transactionId,
      listing_id: listing.listing_id,
      buyer_id: buyerId,
      buyer_username: buyerUsername,
      seller_id: listing.seller_id,
      amount: parseFloat((priceCents / 100).toFixed(2)),
      coupon_applied: validatedCouponApplied,
      sku_variant_id: skuVariantId || null,
      platform_fee: platformFee,
      payout_amount: finalPayout,
      status: 'HELD_IN_ESCROW',
      sandbox_state: 'DEPLOYED_SANDBOX',
      sandbox_logs,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    marketRepository.createEscrow(newEscrow);
    return { success: true, escrow: newEscrow };
  });
}

export async function processReleaseEscrow(transactionId: string, actorId: number, adminOverride: boolean = false): Promise<EscrowActionResult> {
  const escrow = marketRepository.findEscrowById(transactionId);
  if (!escrow) return { success: false, error: 'Escrow transaction not located.' };

  const buyerId = Number(escrow.buyer_id);
  const sellerId = Number(escrow.seller_id);
  const [firstId, secondId] = buyerId < sellerId ? [buyerId, sellerId] : [sellerId, buyerId];
  
  const firstLock = getLockForUser(firstId);
  const secondLock = getLockForUser(secondId);

  return await firstLock.run(async () => {
    return await secondLock.run(async () => {
      if (!adminOverride && Number(escrow.buyer_id) !== Number(actorId)) {
        return { success: false, error: 'Forbidden: Only the buyer is authorized to release funds.' };
      }

      if (escrow.status !== 'HELD_IN_ESCROW') {
        return { success: false, error: 'Escrow is not in editable HELD_IN_ESCROW status.' };
      }

      const openDisputes = (db.market_support_chats || []).filter(
        chat => chat && chat.order_id === transactionId && chat.is_disputed && !chat.resolved_at
      );

      if (openDisputes.length > 0) {
        return { success: false, error: 'Cannot release escrow: There is an active open dispute/support chat for this transaction.' };
      }

      marketRepository.updateEscrow(transactionId, {
        status: 'RELEASED',
        updated_at: Date.now()
      });

      const listing = marketRepository.findListingById(escrow.listing_id);
      if (listing && listing.inventory_count === undefined) {
        marketRepository.updateListing(listing.listing_id, { status: 'COMPLETED' });
      }

      const sellerWallet = walletRepository.getOrCreateWallet(sellerId);
      const releaseCents = Math.round(escrow.amount * 100);
      const feeCents = Math.round((escrow.platform_fee || 0) * 100);
      const payoutCents = releaseCents - feeCents;

      walletRepository.updateWalletBalance(sellerId, sellerWallet.balance_cents + payoutCents);
      walletRepository.createLedgerEntry({
        entry_id: generateTrcCode('release', 'AST48'),
        user_id: sellerId,
        entry_type: 'ESCROW_RELEASE',
        amount_cents: releaseCents,
        balance_after_cents: sellerWallet.balance_cents + releaseCents,
        related_transaction_id: escrow.transaction_id,
        actor_type: adminOverride ? 'ADMIN' : 'USER',
        actor_id: String(actorId),
        is_simulated: true,
        created_at: Date.now()
      });

      walletRepository.createLedgerEntry({
        entry_id: generateTrcCode('release', 'FEE'),
        user_id: sellerId,
        entry_type: 'PLATFORM_FEE',
        amount_cents: -feeCents,
        balance_after_cents: sellerWallet.balance_cents + payoutCents,
        related_transaction_id: escrow.transaction_id,
        actor_type: adminOverride ? 'ADMIN' : 'USER',
        actor_id: String(actorId),
        is_simulated: true,
        created_at: Date.now()
      });

      return { success: true, escrow: marketRepository.findEscrowById(transactionId) };
    });
  });
}

export async function processRevertEscrow(transactionId: string, actorId: number, isAdmin: boolean = false): Promise<EscrowActionResult> {
  const esc = marketRepository.findEscrowById(transactionId);
  if (!esc) return { success: false, error: 'Transaction index not found.' };

  const buyerId = Number(esc.buyer_id);
  const sellerId = Number(esc.seller_id);
  const [firstId, secondId] = buyerId < sellerId ? [buyerId, sellerId] : [sellerId, buyerId];
  
  const firstLock = getLockForUser(firstId);
  const secondLock = getLockForUser(secondId);

  return await firstLock.run(async () => {
    return await secondLock.run(async () => {
      const isBuyer = Number(esc.buyer_id) === Number(actorId);
      const isSeller = Number(esc.seller_id) === Number(actorId);

      if (!isBuyer && !isSeller && !isAdmin) {
        return { success: false, error: 'Unauthorized and forbidden from reverting escrow ledger.' };
      }

      if (esc.status !== 'HELD_IN_ESCROW') {
        return { success: false, error: 'Escrow is not in active HELD_IN_ESCROW hold to revert.' };
      }

      marketRepository.updateEscrow(transactionId, {
        status: 'REVERTED',
        updated_at: Date.now()
      });

      const listing = marketRepository.findListingById(esc.listing_id);
      if (listing) {
        marketRepository.updateListing(listing.listing_id, {
          status: 'ACTIVE',
          inventory_count: listing.inventory_count !== undefined ? listing.inventory_count + 1 : undefined
        });
      }

      const buyerWallet = walletRepository.getOrCreateWallet(esc.buyer_id);
      const refundCents = Math.round(esc.amount * 100);

      walletRepository.updateWalletBalance(esc.buyer_id, buyerWallet.balance_cents + refundCents);
      walletRepository.createLedgerEntry({
        entry_id: generateTrcCode('refund', 'AST48'),
        user_id: esc.buyer_id,
        entry_type: 'ESCROW_REFUND',
        amount_cents: refundCents,
        balance_after_cents: buyerWallet.balance_cents + refundCents,
        related_transaction_id: esc.transaction_id,
        actor_type: isAdmin ? 'ADMIN' : 'USER',
        actor_id: String(actorId),
        is_simulated: true,
        created_at: Date.now()
      });

      return { success: true, escrow: marketRepository.findEscrowById(transactionId) };
    });
  });
}

export async function processResolveDispute(
  chatId: string,
  resolution: string,
  penalty_applied_to: string,
  adminId: number,
  adminUsername: string
): Promise<EscrowActionResult> {
  db.market_support_chats = db.market_support_chats || [];
  const chat = db.market_support_chats.find(c => c && c.chat_id === chatId);
  if (!chat) return { success: false, error: 'Dispute/support chat not found.' };

  const escrow = marketRepository.findEscrowById(chat.order_id);
  if (!escrow) return { success: false, error: 'Escrow transaction not found.' };

  const buyerId = Number(escrow.buyer_id);
  const sellerId = Number(escrow.seller_id);
  const [firstId, secondId] = buyerId < sellerId ? [buyerId, sellerId] : [sellerId, buyerId];
  
  const firstLock = getLockForUser(firstId);
  const secondLock = getLockForUser(secondId);

  return await firstLock.run(async () => {
    return await secondLock.run(async () => {
      const escrowAmountCents = Math.round(escrow.amount * 100);
      const platformFeeCents = Math.round((escrow.platform_fee || 0) * 100);
      const payoutCents = escrowAmountCents - platformFeeCents;

      const buyerWallet = walletRepository.getOrCreateWallet(escrow.buyer_id);
      const sellerWallet = walletRepository.getOrCreateWallet(escrow.seller_id);

      let logs = [
        `[SYS-DISPUTE] ADMIN '${adminUsername}' INITIATED DISPUTE RESOLUTION PROTOCOL...`,
        ` RESOLUTION: ${resolution}`,
        ` PENALTY SYSTEM: ${penalty_applied_to}`
      ];

      if (resolution === 'REFUND_BUYER') {
        walletRepository.updateWalletBalance(escrow.buyer_id, buyerWallet.balance_cents + escrowAmountCents);
        walletRepository.createLedgerEntry({
          entry_id: `${generatePrefixedId('led')}_bref`,
          user_id: buyerId,
          entry_type: 'ESCROW_REFUND',
          amount_cents: escrowAmountCents,
          balance_after_cents: buyerWallet.balance_cents + escrowAmountCents,
          related_transaction_id: escrow.transaction_id,
          actor_type: 'ADMIN',
          actor_id: String(adminId),
          is_simulated: true,
          created_at: Date.now()
        });

        marketRepository.updateEscrow(escrow.transaction_id, {
          status: 'REFUNDED',
          updated_at: Date.now()
        });
        logs.push(` FUNDS RETURNED TO BUYER WALLET: +$${(escrowAmountCents / 100).toFixed(2)}`);

        if (penalty_applied_to === 'SELLER') {
          const penaltyCents = Math.round(escrowAmountCents * 0.25);
          walletRepository.updateWalletBalance(escrow.seller_id, sellerWallet.balance_cents - penaltyCents);
          walletRepository.updateWalletBalance(escrow.buyer_id, buyerWallet.balance_cents + escrowAmountCents + penaltyCents);

          walletRepository.createLedgerEntry({
            entry_id: `${generatePrefixedId('led')}_spen`,
            user_id: sellerId,
            entry_type: 'AUTOMATED_ADJUSTMENT',
            amount_cents: -penaltyCents,
            balance_after_cents: sellerWallet.balance_cents - penaltyCents,
            related_transaction_id: escrow.transaction_id,
            actor_type: 'ADMIN',
            actor_id: String(adminId),
            is_simulated: true,
            created_at: Date.now()
          });

          walletRepository.createLedgerEntry({
            entry_id: `${generatePrefixedId('led')}_brewd`,
            user_id: buyerId,
            entry_type: 'AUTOMATED_ADJUSTMENT',
            amount_cents: penaltyCents,
            balance_after_cents: buyerWallet.balance_cents + escrowAmountCents + penaltyCents,
            related_transaction_id: escrow.transaction_id,
            actor_type: 'ADMIN',
            actor_id: String(adminId),
            is_simulated: true,
            created_at: Date.now()
          });

          logs.push(` SELLER FRAUD PENALTY APPLIED (25%): -$${(penaltyCents / 100).toFixed(2)}`);
          logs.push(` COMPENSATED BUYER WITH FRAUD REWARD: +$${(penaltyCents / 100).toFixed(2)}`);
        }
      } else if (resolution === 'RELEASE_SELLER') {
        walletRepository.updateWalletBalance(escrow.seller_id, sellerWallet.balance_cents + payoutCents);
        walletRepository.createLedgerEntry({
          entry_id: `${generatePrefixedId('led')}_srel`,
          user_id: sellerId,
          entry_type: 'ESCROW_RELEASE',
          amount_cents: escrowAmountCents,
          balance_after_cents: sellerWallet.balance_cents + platformFeeCents + payoutCents,
          related_transaction_id: escrow.transaction_id,
          actor_type: 'ADMIN',
          actor_id: String(adminId),
          is_simulated: true,
          created_at: Date.now()
        });

        walletRepository.createLedgerEntry({
          entry_id: `${generatePrefixedId('led')}_sfee`,
          user_id: sellerId,
          entry_type: 'PLATFORM_FEE',
          amount_cents: -platformFeeCents,
          balance_after_cents: sellerWallet.balance_cents + payoutCents,
          related_transaction_id: escrow.transaction_id,
          actor_type: 'ADMIN',
          actor_id: String(adminId),
          is_simulated: true,
          created_at: Date.now()
        });

        marketRepository.updateEscrow(escrow.transaction_id, {
          status: 'RELEASED',
          updated_at: Date.now()
        });
        logs.push(` FUNDS RELEASED TO SELLER: +$${(payoutCents / 100).toFixed(2)}`);

        if (penalty_applied_to === 'BUYER') {
          const penaltyCents = Math.round(escrowAmountCents * 0.25);
          walletRepository.updateWalletBalance(escrow.buyer_id, buyerWallet.balance_cents - penaltyCents);
          walletRepository.updateWalletBalance(escrow.seller_id, sellerWallet.balance_cents + payoutCents + penaltyCents);

          walletRepository.createLedgerEntry({
            entry_id: `${generatePrefixedId('led')}_bpen`,
            user_id: buyerId,
            entry_type: 'AUTOMATED_ADJUSTMENT',
            amount_cents: -penaltyCents,
            balance_after_cents: buyerWallet.balance_cents - penaltyCents,
            related_transaction_id: escrow.transaction_id,
            actor_type: 'ADMIN',
            actor_id: String(adminId),
            is_simulated: true,
            created_at: Date.now()
          });

          walletRepository.createLedgerEntry({
            entry_id: `${generatePrefixedId('led')}_srewd`,
            user_id: sellerId,
            entry_type: 'AUTOMATED_ADJUSTMENT',
            amount_cents: penaltyCents,
            balance_after_cents: sellerWallet.balance_cents + payoutCents + penaltyCents,
            related_transaction_id: escrow.transaction_id,
            actor_type: 'ADMIN',
            actor_id: String(adminId),
            is_simulated: true,
            created_at: Date.now()
          });

          logs.push(` BUYER FRAUD PENALTY APPLIED (25%): -$${(penaltyCents / 100).toFixed(2)}`);
          logs.push(` COMPENSATED SELLER WITH FRAUD REWARD: +$${(penaltyCents / 100).toFixed(2)}`);
        }
      }

      chat.resolved_at = Date.now();
      chat.messages.push({
        message_id: `${generatePrefixedId('msg')}_res`,
        sender_id: adminId,
        sender_username: 'SYSTEM',
        content: `Dispute officially resolved by Administrator '${adminUsername}'. Verdict: ${resolution}. Penalty: ${penalty_applied_to}.`,
        created_at: Date.now()
      });

      const existingLogs = escrow.sandbox_logs || [];
      marketRepository.updateEscrow(escrow.transaction_id, {
        sandbox_logs: [...existingLogs, ...logs]
      });
      saveDb();

      return { success: true, chat, escrow: marketRepository.findEscrowById(escrow.transaction_id) };
    });
  });
}
