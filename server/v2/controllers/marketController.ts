import type { Request, Response } from 'express';
import { db } from '../db/client.js';
import { marketRepository } from '../repositories/marketRepository.js';
import { bankRepository } from '../repositories/bankRepository.js';
import { reserveRepository } from '../repositories/reserveRepository.js';
import { generateRandomToken } from '../utils/crypto.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import type { CreateListingInput, UpdateListingInput, EscrowActionInput } from '../schemas/marketplace.js';
import { outboxWorker } from '../services/outboxWorker.js';
import {
  assertListingCurrency,
  assertPayCurrency,
  listingPriceInPayCurrency,
  getEscrowFeePercent,
  feeToEurCents,
  ensureMarketCurrencySchema,
} from '../services/marketplaceService.js';
import { RESERVE_TRADING } from '../services/institutionalBank.js';

export class MarketController {
  async createListing(req: Request<{}, {}, CreateListingInput>, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    await ensureMarketCurrencySchema();

    const { title, description, price, category, stock, digitalDelivery, digitalPayload, currency } =
      req.body;
    const listingCurrency = assertListingCurrency(currency || 'EUR');

    const listing = await marketRepository.createListing({
      sellerId: req.user.userId,
      title,
      description,
      price: price.toString(),
      currency: listingCurrency,
      category,
      stock,
      digitalDelivery,
      digitalPayload,
    });

    res.status(201).json({
      listing,
      heldForReview: listing.status === 'PENDING_REVIEW',
      message:
        listing.status === 'PENDING_REVIEW'
          ? 'Listing saved and held for admin review. It is not public yet.'
          : undefined,
    });
  }

  async getListings(_req: Request, res: Response): Promise<void> {
    const listings = await marketRepository.getListings(50);
    res.status(200).json({
      listings: listings.map((l) => ({
        ...l,
        seller_username: l.sellerUsername || undefined,
      })),
    });
  }

  async getMyEscrows(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    await ensureMarketCurrencySchema();

    if (req.user.duress_active) {
      res.status(200).json({ escrows: [] });
      return;
    }

    const feePct = await getEscrowFeePercent();
    const rows = await marketRepository.listEscrowsForUser(req.user.userId, 50);
    const escrows = rows.map((e) => {
      const amount = parseFloat(String(e.amount));
      const fee = Number.isFinite(amount)
        ? Math.round(amount * (feePct / 100) * 100) / 100
        : 0;
      const payout = Number.isFinite(amount) ? Math.round((amount - fee) * 100) / 100 : 0;
      return {
        transaction_id: String(e.id),
        listing_id: String(e.listingId),
        listing_title: e.listingTitle || undefined,
        buyer_id: e.buyerId,
        buyer_username: e.buyerUsername || undefined,
        seller_id: e.sellerId,
        seller_username: e.sellerUsername || undefined,
        amount,
        currency: e.currency || 'EUR',
        payment_currency: e.paymentCurrency || e.currency || 'EUR',
        payment_amount: parseFloat(String(e.paymentAmount || e.amount)),
        status: e.status,
        platform_fee: fee,
        payout_amount: payout,
        created_at: e.createdAt,
      };
    });

    res.status(200).json({ escrows });
  }

  async getListingById(req: Request<{ id: string }>, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError('Invalid listing ID.');

    const listing = await marketRepository.findListingById(id);
    if (!listing) throw new NotFoundError('Listing not found.');

    res.status(200).json({ listing });
  }

  async updateListing(
    req: Request<{ id: string }, {}, UpdateListingInput>,
    res: Response
  ): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError('Invalid listing ID.');

    const existing = await marketRepository.findListingById(id);
    if (!existing) throw new NotFoundError('Listing not found.');

    if (existing.sellerId !== req.user.userId && req.user.role !== 'ADMIN') {
      throw new ForbiddenError('Unauthorized to modify this listing.');
    }

    const updatePayload: Record<string, unknown> = { ...req.body };
    if (req.body.price !== undefined) {
      updatePayload.price = req.body.price.toString();
    }
    if (req.body.currency !== undefined) {
      updatePayload.currency = assertListingCurrency(req.body.currency);
    }

    const updated = await marketRepository.updateListing(id, updatePayload as any);
    res.status(200).json({ listing: updated });
  }

  async purchaseEscrow(req: Request<{ id: string }>, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    await ensureMarketCurrencySchema();

    const listingId = parseInt(req.params.id, 10);
    if (isNaN(listingId)) throw new BadRequestError('Invalid listing ID.');

    const result = await db.transaction(async (tx) => {
      const listing = await marketRepository.findListingByIdForUpdate(listingId, tx);
      if (!listing || listing.status !== 'ACTIVE') {
        throw new NotFoundError('Listing not available.');
      }

      if (listing.sellerId === req.user!.userId) {
        throw new BadRequestError('Cannot purchase your own listing.');
      }

      const listingCurrency = assertListingCurrency(listing.currency || 'EUR');
      const price = parseFloat(listing.price);
      if (!Number.isFinite(price) || price <= 0) {
        throw new BadRequestError('Invalid listing price.');
      }

      const payCurrency = assertPayCurrency(
        (req.body?.payCurrency || req.body?.currency || listingCurrency) as string
      );
      const { paymentAmount, rate } = listingPriceInPayCurrency(price, listingCurrency, payCurrency);

      await bankRepository.ensureCurrencyWallets(req.user!.userId, tx);
      const buyerWallet = await bankRepository.findWalletByUserIdAndCurrencyForUpdate(
        req.user!.userId,
        payCurrency,
        tx
      );
      if (!buyerWallet) throw new NotFoundError('Buyer wallet not found.');

      const buyerBalance = parseFloat(buyerWallet.balance);
      if (buyerBalance < paymentAmount) {
        throw new BadRequestError(
          `Insufficient ${payCurrency} balance for escrow purchase (need ${paymentAmount.toFixed(2)}).`
        );
      }

      const newBuyerBalance = (buyerBalance - paymentAmount).toFixed(2);
      await bankRepository.updateBalance(buyerWallet.id, newBuyerBalance, tx);

      const fxNote =
        payCurrency === listingCurrency
          ? ''
          : ` (paid ${paymentAmount.toFixed(2)} ${payCurrency} @ spot ${rate.toFixed(6)})`;

      await bankRepository.createTransaction(
        {
          reference: `ESCROW-${generateRandomToken(6).toUpperCase()}`,
          walletId: buyerWallet.id,
          type: 'ESCROW',
          amount: paymentAmount.toFixed(2),
          status: 'COMPLETED',
          description: `Escrow hold for listing #${listing.id}: ${listing.title}${fxNote}`,
        },
        tx
      );

      const escrow = await marketRepository.createEscrow(
        {
          listingId: listing.id,
          buyerId: req.user!.userId,
          sellerId: listing.sellerId,
          amount: price.toFixed(2),
          currency: listingCurrency,
          paymentCurrency: payCurrency,
          paymentAmount: paymentAmount.toFixed(2),
          status: 'HELD',
        },
        tx
      );

      await outboxWorker.queueEvent(
        {
          eventType: 'ESCROW_PURCHASE',
          aggregateId: escrow.id.toString(),
          payload: {
            escrowId: escrow.id,
            listingId: listing.id,
            buyerId: req.user!.userId,
            sellerId: listing.sellerId,
            amount: price.toFixed(2),
            currency: listingCurrency,
            paymentAmount: paymentAmount.toFixed(2),
            paymentCurrency: payCurrency,
            spotRate: rate,
          },
        },
        tx
      );

      return {
        escrow,
        newBuyerBalance,
        paymentAmount,
        paymentCurrency: payCurrency,
        spotRate: rate,
      };
    });

    res.status(201).json({
      escrow: result.escrow,
      newBalance: result.newBuyerBalance,
      payment_amount: result.paymentAmount,
      payment_currency: result.paymentCurrency,
      spot_rate: result.spotRate,
    });
  }

  async processEscrowAction(req: Request<{}, {}, EscrowActionInput>, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    await ensureMarketCurrencySchema();

    const { transactionId, action } = req.body;
    const escrowId = parseInt(transactionId, 10);

    const result = await db.transaction(async (tx) => {
      const escrow = await marketRepository.findEscrowByIdForUpdate(escrowId, tx);
      if (!escrow) throw new NotFoundError('Escrow transaction not found.');

      if (escrow.status !== 'HELD') {
        throw new BadRequestError('Escrow action can only be performed on HELD transactions.');
      }

      if (
        escrow.buyerId !== req.user!.userId &&
        escrow.sellerId !== req.user!.userId &&
        req.user!.role !== 'ADMIN'
      ) {
        throw new ForbiddenError('Unauthorized to manage this escrow.');
      }

      const amount = parseFloat(escrow.amount);
      const listingCurrency = escrow.currency || 'EUR';
      const paymentCurrency = escrow.paymentCurrency || listingCurrency;
      const paymentAmount = parseFloat(escrow.paymentAmount || escrow.amount);

      if (action === 'RELEASE') {
        const feePercent = await getEscrowFeePercent();
        const feeMajor = Math.round(amount * (feePercent / 100) * 100) / 100;
        const sellerNet = Math.round((amount - feeMajor) * 100) / 100;
        const feeEurCents = feeToEurCents(feeMajor, listingCurrency);

        await bankRepository.ensureCurrencyWallets(escrow.sellerId, tx);
        const sellerWallet = await bankRepository.findWalletByUserIdAndCurrencyForUpdate(
          escrow.sellerId,
          listingCurrency,
          tx
        );
        if (!sellerWallet) throw new NotFoundError('Seller wallet not found.');

        const newSellerBalance = (parseFloat(sellerWallet.balance) + sellerNet).toFixed(2);
        await bankRepository.updateBalance(sellerWallet.id, newSellerBalance, tx);

        await bankRepository.createTransaction(
          {
            reference: `REL-${generateRandomToken(6).toUpperCase()}`,
            walletId: sellerWallet.id,
            type: 'CREDIT',
            amount: sellerNet.toFixed(2),
            status: 'COMPLETED',
            description: `Escrow release for listing #${escrow.listingId} (net after ${feePercent}% fee)`,
          },
          tx
        );

        if (feeEurCents > 0) {
          await reserveRepository.updateBalance(RESERVE_TRADING, feeEurCents, tx);
        }

        const updated = await marketRepository.updateEscrowStatus(escrow.id, 'RELEASED', tx);
        await outboxWorker.queueEvent(
          {
            eventType: 'ESCROW_RELEASE',
            aggregateId: escrow.id.toString(),
            payload: {
              escrowId: escrow.id,
              action: 'RELEASE',
              sellerId: escrow.sellerId,
              sellerNet: sellerNet.toFixed(2),
              feeMajor: feeMajor.toFixed(2),
              feeEurCents,
              currency: listingCurrency,
            },
          },
          tx
        );

        return {
          escrow: updated,
          sellerNet,
          feeMajor,
          feeEurCents,
          feePercent,
        };
      }

      if (action === 'REFUND') {
        await bankRepository.ensureCurrencyWallets(escrow.buyerId, tx);
        const buyerWallet = await bankRepository.findWalletByUserIdAndCurrencyForUpdate(
          escrow.buyerId,
          paymentCurrency,
          tx
        );
        if (!buyerWallet) throw new NotFoundError('Buyer wallet not found.');

        const newBuyerBalance = (parseFloat(buyerWallet.balance) + paymentAmount).toFixed(2);
        await bankRepository.updateBalance(buyerWallet.id, newBuyerBalance, tx);

        await bankRepository.createTransaction(
          {
            reference: `RFND-${generateRandomToken(6).toUpperCase()}`,
            walletId: buyerWallet.id,
            type: 'REFUND',
            amount: paymentAmount.toFixed(2),
            status: 'COMPLETED',
            description: `Escrow refund for listing #${escrow.listingId}`,
          },
          tx
        );

        const updated = await marketRepository.updateEscrowStatus(escrow.id, 'REFUNDED', tx);
        await outboxWorker.queueEvent(
          {
            eventType: 'ESCROW_REFUND',
            aggregateId: escrow.id.toString(),
            payload: {
              escrowId: escrow.id,
              action: 'REFUND',
              buyerId: escrow.buyerId,
              paymentAmount: paymentAmount.toFixed(2),
              paymentCurrency,
            },
          },
          tx
        );

        return { escrow: updated };
      }

      const updated = await marketRepository.updateEscrowStatus(escrow.id, 'DISPUTED', tx);
      await outboxWorker.queueEvent(
        {
          eventType: 'ESCROW_DISPUTE',
          aggregateId: escrow.id.toString(),
          payload: { escrowId: escrow.id, action: 'DISPUTE' },
        },
        tx
      );

      return { escrow: updated };
    });

    res.status(200).json(result);
  }
}

export const marketController = new MarketController();
