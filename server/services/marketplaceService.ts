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
    if (listing.verification_status && listing.verification_status !== 'APPROVED') return { success: false, error: 'Listing is under review.' };
    if (listing.inventory_count !== undefined && listing.inventory_count <= 0) return { success: false, error: 'Listing is out of stock.' };
    if (Number(listing.seller_id) === Number(buyerId)) return { success: false, error: 'You cannot purchase your own listing.' };

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

    const feePercent = (db.system_settings?.platform_fee_percent || 5) / 100;
    const taxPercent = (db.system_settings?.tax_rate_percent || 0) / 100;
    const settlement = calculateOrderSettlement(itemPriceCents, taxPercent, feePercent, couponObj);
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
      // Unlimited items: do not lock, keep status ACTIVE
      marketRepository.updateListing(listing.listing_id, {
        status: 'ACTIVE'
      });
    }

    const priceCents = settlement.gross_amount_cents - settlement.discount_deduction_cents + settlement.net_tax_amount_cents;
    const buyerWallet = walletRepository.getOrCreateWalletBalance(buyerId, 'VLM');
    if (buyerWallet.balance_cents < priceCents) {
      return { success: false, error: 'Insufficient funds.' };
    }

    const platformFee = parseFloat((settlement.platform_fee_deduction_cents / 100).toFixed(2));
    const finalPayout = parseFloat((settlement.payout_net_amount_cents / 100).toFixed(2));
    const transactionId = generateTrcCode('hold', 'AST48');

    walletRepository.updateWalletBalanceCents(buyerId, 'VLM', buyerWallet.balance_cents - priceCents);
    walletRepository.createLedgerEntry({
      entry_id: generateTrcCode('hold', 'AST48'),
      user_id: Number(buyerId),
      entry_type: 'ESCROW_HOLD',
      amount_cents: -priceCents,
      balance_after_cents: buyerWallet.balance_cents, // already updated in repository
      related_transaction_id: transactionId,
      actor_type: 'USER',
      actor_id: String(buyerId),
      is_simulated: true,
      created_at: Date.now()
    });

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
      created_at: Date.now(),
      updated_at: Date.now()
    };

    marketRepository.createEscrow(newEscrow);
    return { success: true, escrow: newEscrow };
  });
}

export async function processReleaseEscrow(transactionId: string, actorId: number, adminOverride: boolean = false): Promise<EscrowActionResult> {
  const escrow = marketRepository.findEscrowById(transactionId);
  if (!escrow) return { success: false, error: 'Transaction not found.' };

  const buyerId = Number(escrow.buyer_id);
  const sellerId = Number(escrow.seller_id);
  const [firstId, secondId] = buyerId < sellerId ? [buyerId, sellerId] : [sellerId, buyerId];
  
  const firstLock = getLockForUser(firstId);
  const secondLock = getLockForUser(secondId);

  return await firstLock.run(async () => {
    return await secondLock.run(async () => {
      if (!adminOverride && Number(escrow.buyer_id) !== Number(actorId)) {
        return { success: false, error: 'Only the buyer can release these funds.' };
      }

      if (escrow.status !== 'HELD_IN_ESCROW') {
        return { success: false, error: 'This transaction is already completed.' };
      }

      const openDisputes = (db.market_support_chats || []).filter(
        chat => chat && chat.order_id === transactionId && chat.is_disputed && !chat.resolved_at
      );

      if (openDisputes.length > 0) {
        return { success: false, error: 'Cannot release funds: There is an active dispute for this transaction.' };
      }

      marketRepository.updateEscrow(transactionId, {
        status: 'RELEASED',
        updated_at: Date.now()
      });

      const listing = marketRepository.findListingById(escrow.listing_id);
      if (listing && listing.inventory_count === undefined) {
        marketRepository.updateListing(listing.listing_id, { status: 'ACTIVE' });
      }

      const sellerWallet = walletRepository.getOrCreateWalletBalance(sellerId, 'VLM');
      const releaseCents = Math.round(escrow.amount * 100);
      const feeCents = Math.round((escrow.platform_fee || 0) * 100);
      const payoutCents = releaseCents - feeCents;

      // Escrow release goes to wallet first
      walletRepository.updateWalletBalanceCents(sellerId, 'VLM', sellerWallet.balance_cents + releaseCents);
      walletRepository.createLedgerEntry({
        entry_id: generateTrcCode('release', 'AST48'),
        user_id: sellerId,
        entry_type: 'ESCROW_RELEASE',
        amount_cents: releaseCents,
        balance_after_cents: sellerWallet.balance_cents, // already updated in repository
        related_transaction_id: escrow.transaction_id,
        actor_type: adminOverride ? 'ADMIN' : 'USER',
        actor_id: String(actorId),
        is_simulated: true,
        created_at: Date.now()
      });

      // Platform fee deduction ledger entry
      if (feeCents > 0) {
        walletRepository.updateWalletBalanceCents(sellerId, 'VLM', sellerWallet.balance_cents - feeCents);
        walletRepository.createLedgerEntry({
          entry_id: generateTrcCode('release', 'AST48'),
          user_id: sellerId,
          entry_type: 'PLATFORM_FEE',
          amount_cents: -feeCents,
          balance_after_cents: sellerWallet.balance_cents, // already updated in repository
          related_transaction_id: escrow.transaction_id,
          actor_type: adminOverride ? 'ADMIN' : 'USER',
          actor_id: String(actorId),
          is_simulated: true,
          created_at: Date.now()
        });
      }

      // Send the fee to Velum Central Bank
      if (feeCents > 0) {
        try {
          const { bankStore, getSystemAccount } = await import('./bankStore.js');
          const clr = await getSystemAccount('CENTRAL');
          if (clr) {
            const twdRate = db.system_settings?.twd_usd_rate || 0.031;
            let twdFee = Math.round(feeCents / twdRate); // converting USD to TWD for bank
            const user = db.users?.find(u => Number(u.user_id) === sellerId);
            const pref = user?.preferred_currency || 'USD';
            if (pref !== 'USD' && pref !== 'VLM') {
              const r = db.exchange_rates?.find(x => x.base_currency === pref && x.quote_currency === 'TWD');
              if (r) twdFee = Math.round(feeCents * r.rate);
            }
            await bankStore.updateAccountBalance(clr.account_id, twdFee);
            await bankStore.logTransaction({
              account_id: clr.account_id,
              type: 'deposit',
              amount_cents: twdFee,
              currency_code: 'TWD',
              description: `Escrow platform fee for transaction ${escrow.transaction_id}`,
              status: 'completed'
            });
          }
        } catch (e) {
          console.error("Failed to deposit fee to central bank", e);
        }
      }

      // Auto-withdraw payout to user's first external account if available
      try {
        db.payment_methods = db.payment_methods || [];
        db.external_financial_accounts = db.external_financial_accounts || [];
        const defaultMethod = db.payment_methods.find(m => Number(m.user_id) === sellerId && m.status === 'ACTIVE');
        if (defaultMethod) {
          const extAccount = db.external_financial_accounts.find(a => a.account_token === defaultMethod.external_account_token);
          if (extAccount) {
            // Deduct from wallet
            walletRepository.updateWalletBalanceCents(sellerId, 'VLM', sellerWallet.balance_cents - payoutCents);
            walletRepository.createLedgerEntry({
              entry_id: generateTrcCode('withdrawal', 'WD'),
              user_id: sellerId,
              entry_type: 'WITHDRAWAL',
              amount_cents: -payoutCents,
              balance_after_cents: sellerWallet.balance_cents, // already updated in repository
              related_transaction_id: escrow.transaction_id,
              actor_type: 'SYSTEM',
              actor_id: 'SYSTEM',
              is_simulated: true,
              created_at: Date.now()
            });
            // Add to external account
            extAccount.available_cents += payoutCents;
            // Deduct from Central/Trust bank based on card type
            const bankType = extAccount.account_kind === 'CREDIT_CARD' ? 'CENTRAL' : 'MEMBER';
            const { bankStore, getSystemAccount } = await import('./bankStore.js');
            const clr = await getSystemAccount(bankType);
            if (clr) {
              const twdRate = db.system_settings?.twd_usd_rate || 0.031;
              let twdPayout = Math.round(payoutCents / twdRate);
              await bankStore.updateAccountBalance(clr.account_id, -twdPayout);
              await bankStore.logTransaction({
                account_id: clr.account_id,
                type: 'withdrawal',
                amount_cents: twdPayout,
                currency_code: 'TWD',
                description: `Auto-withdrawal of escrow payout to ${bankType} for user ${sellerId}`,
                status: 'completed'
              });
            }
          }
        }
      } catch (e) {
        console.error("Failed auto-withdrawal", e);
      }

      return { success: true, escrow: marketRepository.findEscrowById(transactionId) };
    });
  });
}

export async function processRevertEscrow(transactionId: string, actorId: number, isAdmin: boolean = false): Promise<EscrowActionResult> {
  const esc = marketRepository.findEscrowById(transactionId);
  if (!esc) return { success: false, error: 'Transaction not found.' };

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
        return { success: false, error: 'Unauthorized to cancel this transaction.' };
      }

      if (esc.status !== 'HELD_IN_ESCROW') {
        return { success: false, error: 'This transaction cannot be cancelled.' };
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

      const buyerWallet = walletRepository.getOrCreateWalletBalance(esc.buyer_id, 'VLM');
      const refundCents = Math.round(esc.amount * 100);

      walletRepository.updateWalletBalanceCents(esc.buyer_id, 'VLM', buyerWallet.balance_cents + refundCents);
      walletRepository.createLedgerEntry({
        entry_id: generateTrcCode('refund', 'AST48'),
        user_id: esc.buyer_id,
        entry_type: 'ESCROW_REFUND',
        amount_cents: refundCents,
        balance_after_cents: buyerWallet.balance_cents, // already updated in repository
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

      const buyerWallet = walletRepository.getOrCreateWalletBalance(escrow.buyer_id, 'VLM');
      const sellerWallet = walletRepository.getOrCreateWalletBalance(escrow.seller_id, 'VLM');

      if (resolution === 'REFUND_BUYER') {
        walletRepository.updateWalletBalanceCents(escrow.buyer_id, 'VLM', buyerWallet.balance_cents + escrowAmountCents);
        walletRepository.createLedgerEntry({
          entry_id: `${generatePrefixedId('led')}_bref`,
          user_id: buyerId,
          entry_type: 'ESCROW_REFUND',
          amount_cents: escrowAmountCents,
          balance_after_cents: buyerWallet.balance_cents, // already updated in repository
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

        if (penalty_applied_to === 'SELLER') {
          const penaltyCents = Math.round(escrowAmountCents * 0.25);
          walletRepository.updateWalletBalanceCents(escrow.seller_id, 'VLM', sellerWallet.balance_cents - penaltyCents);
          walletRepository.updateWalletBalanceCents(escrow.buyer_id, 'VLM', buyerWallet.balance_cents + penaltyCents);

          walletRepository.createLedgerEntry({
            entry_id: generateTrcCode('penalty', 'SELLER'),
            user_id: sellerId,
            entry_type: 'AUTOMATED_ADJUSTMENT',
            amount_cents: -penaltyCents,
            balance_after_cents: sellerWallet.balance_cents, // already updated in repository
            related_transaction_id: escrow.transaction_id,
            actor_type: 'ADMIN',
            actor_id: String(adminId),
            is_simulated: true,
            created_at: Date.now()
          });

          walletRepository.createLedgerEntry({
            entry_id: generateTrcCode('refund', 'AST48'),
            user_id: buyerId,
            entry_type: 'AUTOMATED_ADJUSTMENT',
            amount_cents: penaltyCents,
            balance_after_cents: buyerWallet.balance_cents, // already updated in repository
            related_transaction_id: escrow.transaction_id,
            actor_type: 'ADMIN',
            actor_id: String(adminId),
            is_simulated: true,
            created_at: Date.now()
          });
        }
      } else if (resolution === 'RELEASE_SELLER') {
        walletRepository.updateWalletBalanceCents(escrow.seller_id, 'VLM', sellerWallet.balance_cents + payoutCents);
        walletRepository.createLedgerEntry({
          entry_id: generateTrcCode('release', 'AST48'),
          user_id: sellerId,
          entry_type: 'ESCROW_RELEASE',
          amount_cents: escrowAmountCents,
          balance_after_cents: sellerWallet.balance_cents + platformFeeCents, // matches gross total
          related_transaction_id: escrow.transaction_id,
          actor_type: 'ADMIN',
          actor_id: String(adminId),
          is_simulated: true,
          created_at: Date.now()
        });

        walletRepository.createLedgerEntry({
          entry_id: generateTrcCode('release', 'FEE'),
          user_id: sellerId,
          entry_type: 'PLATFORM_FEE',
          amount_cents: -platformFeeCents,
          balance_after_cents: sellerWallet.balance_cents, // matches net total
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

        if (penalty_applied_to === 'BUYER') {
          const penaltyCents = Math.round(escrowAmountCents * 0.25);
          walletRepository.updateWalletBalanceCents(escrow.buyer_id, 'VLM', buyerWallet.balance_cents - penaltyCents);
          walletRepository.updateWalletBalanceCents(escrow.seller_id, 'VLM', sellerWallet.balance_cents + penaltyCents);

          walletRepository.createLedgerEntry({
            entry_id: generateTrcCode('penalty', 'BUYER'),
            user_id: buyerId,
            entry_type: 'AUTOMATED_ADJUSTMENT',
            amount_cents: -penaltyCents,
            balance_after_cents: buyerWallet.balance_cents, // already updated in repository
            related_transaction_id: escrow.transaction_id,
            actor_type: 'ADMIN',
            actor_id: String(adminId),
            is_simulated: true,
            created_at: Date.now()
          });

          walletRepository.createLedgerEntry({
            entry_id: generateTrcCode('release', 'AST48'),
            user_id: sellerId,
            entry_type: 'AUTOMATED_ADJUSTMENT',
            amount_cents: penaltyCents,
            balance_after_cents: sellerWallet.balance_cents, // already updated in repository
            related_transaction_id: escrow.transaction_id,
            actor_type: 'ADMIN',
            actor_id: String(adminId),
            is_simulated: true,
            created_at: Date.now()
          });
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

      saveDb();

      return { success: true, chat, escrow: marketRepository.findEscrowById(escrow.transaction_id) };
    });
  });
}
