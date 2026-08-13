import type { Request, Response } from 'express';
import { db } from '../db/client.js';
import { marketRepository } from '../repositories/marketRepository.js';
import { bankRepository } from '../repositories/bankRepository.js';
import { generateRandomToken } from '../utils/crypto.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import type { CreateListingInput, UpdateListingInput, EscrowActionInput } from '../schemas/marketplace.js';
import { outboxWorker } from '../services/outboxWorker.js';
import { scanContent } from '../services/marketplaceService.js';

export class MarketController {
  async createListing(req: Request<{}, {}, CreateListingInput>, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    const { title, description, price, category, stock, digitalDelivery, digitalPayload } = req.body;

    const isFlagged = scanContent(title, description);

    const listing = await marketRepository.createListing({
      sellerId: req.user.userId,
      title,
      description,
      price: price.toString(),
      category,
      stock,
      digitalDelivery,
      digitalPayload,
      status: isFlagged ? 'PENDING_REVIEW' : 'ACTIVE'
    });

    res.status(201).json({ listing });
  }

  async getListings(_req: Request, res: Response): Promise<void> {
    const listings = await marketRepository.getListings(50);
    res.status(200).json({ listings });
  }

  async getListingById(req: Request<{ id: string }>, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError('Invalid listing ID.');

    const listing = await marketRepository.findListingById(id);
    if (!listing) throw new NotFoundError('Listing not found.');

    res.status(200).json({ listing });
  }

  async updateListing(req: Request<{ id: string }, {}, UpdateListingInput>, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError('Invalid listing ID.');

    const existing = await marketRepository.findListingById(id);
    if (!existing) throw new NotFoundError('Listing not found.');

    if (existing.sellerId !== req.user.userId && req.user.role !== 'ADMIN') {
      throw new ForbiddenError('Unauthorized to modify this listing.');
    }

    const updatePayload: Record<string, any> = { ...req.body };
    if (req.body.price !== undefined) {
      updatePayload.price = req.body.price.toString();
    }

    const updated = await marketRepository.updateListing(id, updatePayload);
    res.status(200).json({ listing: updated });
  }

  async purchaseEscrow(req: Request<{ id: string }>, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
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

      const price = parseFloat(listing.price);
      const buyerWallet = await bankRepository.findWalletByUserIdForUpdate(req.user!.userId, tx);
      if (!buyerWallet) throw new NotFoundError('Buyer wallet not found.');

      const buyerBalance = parseFloat(buyerWallet.balance);
      if (buyerBalance < price) {
        throw new BadRequestError('Insufficient balance for escrow purchase.');
      }

      const newBuyerBalance = (buyerBalance - price).toFixed(2);
      await bankRepository.updateBalance(buyerWallet.id, newBuyerBalance, tx);

      await bankRepository.createTransaction({
        reference: `ESCROW-${generateRandomToken(6).toUpperCase()}`,
        walletId: buyerWallet.id,
        type: 'ESCROW',
        amount: price.toFixed(2),
        status: 'COMPLETED',
        description: `Escrow hold for listing #${listing.id}: ${listing.title}`
      }, tx);

      const escrow = await marketRepository.createEscrow({
        listingId: listing.id,
        buyerId: req.user!.userId,
        sellerId: listing.sellerId,
        amount: price.toFixed(2),
        status: 'HELD'
      }, tx);

      await outboxWorker.queueEvent({
        eventType: 'ESCROW_PURCHASE',
        aggregateId: escrow.id.toString(),
        payload: {
          escrowId: escrow.id,
          listingId: listing.id,
          buyerId: req.user!.userId,
          sellerId: listing.sellerId,
          amount: price.toFixed(2)
        }
      }, tx);

      return { escrow, newBuyerBalance };
    });

    res.status(201).json({ escrow: result.escrow, newBalance: result.newBuyerBalance });
  }

  async processEscrowAction(req: Request<{}, {}, EscrowActionInput>, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    const { transactionId, action } = req.body;
    const escrowId = parseInt(transactionId, 10);

    const result = await db.transaction(async (tx) => {
      const escrow = await marketRepository.findEscrowByIdForUpdate(escrowId, tx);
      if (!escrow) throw new NotFoundError('Escrow transaction not found.');

      if (escrow.status !== 'HELD') {
        throw new BadRequestError('Escrow action can only be performed on HELD transactions.');
      }

      if (escrow.buyerId !== req.user!.userId && escrow.sellerId !== req.user!.userId && req.user!.role !== 'ADMIN') {
        throw new ForbiddenError('Unauthorized to manage this escrow.');
      }

      const amount = parseFloat(escrow.amount);

      if (action === 'RELEASE') {
        const sellerWallet = await bankRepository.findWalletByUserIdForUpdate(escrow.sellerId, tx);
        if (!sellerWallet) throw new NotFoundError('Seller wallet not found.');

        const newSellerBalance = (parseFloat(sellerWallet.balance) + amount).toFixed(2);
        await bankRepository.updateBalance(sellerWallet.id, newSellerBalance, tx);

        await bankRepository.createTransaction({
          reference: `REL-${generateRandomToken(6).toUpperCase()}`,
          walletId: sellerWallet.id,
          type: 'CREDIT',
          amount: amount.toFixed(2),
          status: 'COMPLETED',
          description: `Escrow release for listing #${escrow.listingId}`
        }, tx);

        const updated = await marketRepository.updateEscrowStatus(escrow.id, 'RELEASED', tx);
        await outboxWorker.queueEvent({
          eventType: 'ESCROW_RELEASE',
          aggregateId: escrow.id.toString(),
          payload: { escrowId: escrow.id, action: 'RELEASE', sellerId: escrow.sellerId }
        }, tx);

        return updated;
      }

      if (action === 'REFUND') {
        const buyerWallet = await bankRepository.findWalletByUserIdForUpdate(escrow.buyerId, tx);
        if (!buyerWallet) throw new NotFoundError('Buyer wallet not found.');

        const newBuyerBalance = (parseFloat(buyerWallet.balance) + amount).toFixed(2);
        await bankRepository.updateBalance(buyerWallet.id, newBuyerBalance, tx);

        const updated = await marketRepository.updateEscrowStatus(escrow.id, 'REFUNDED', tx);
        await outboxWorker.queueEvent({
          eventType: 'ESCROW_REFUND',
          aggregateId: escrow.id.toString(),
          payload: { escrowId: escrow.id, action: 'REFUND', buyerId: escrow.buyerId }
        }, tx);

        return updated;
      }

      const updated = await marketRepository.updateEscrowStatus(escrow.id, 'DISPUTED', tx);
      await outboxWorker.queueEvent({
        eventType: 'ESCROW_DISPUTE',
        aggregateId: escrow.id.toString(),
        payload: { escrowId: escrow.id, action: 'DISPUTE' }
      }, tx);

      return updated;
    });

    res.status(200).json({ escrow: result });
  }
}

export const marketController = new MarketController();
