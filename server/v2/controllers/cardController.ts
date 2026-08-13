import type { Request, Response } from 'express';
import { cardRepository } from '../repositories/cardRepository.js';
import { bankRepository } from '../repositories/bankRepository.js';
import { generateRandomToken } from '../utils/crypto.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';

export class CardController {
  async getCard(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    if (req.user.duress_active) {
      res.status(200).json({ card: null });
      return;
    }

    let card = await cardRepository.findCardByUserId(req.user.userId);
    if (!card) {
      res.status(200).json({ card: null });
      return;
    }

    const wallet = await bankRepository.findWalletByUserId(req.user.userId);
    const balanceCents = wallet ? Math.round(parseFloat(wallet.balance) * 100) : 0;

    res.status(200).json({
      card: {
        ...card,
        balanceCents,
        availableCents: Math.max(0, card.limitCents - balanceCents)
      }
    });
  }

  async createCard(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    const existingCard = await cardRepository.findCardByUserId(req.user.userId);
    if (existingCard) {
      throw new BadRequestError('User already has a card.');
    }

    const cardToken = `CRD-${generateRandomToken(8).toUpperCase()}`;
    const { limitCents = 500000, cardType = 'CREDIT' } = req.body;

    const parsedLimit = parseInt(limitCents, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      throw new BadRequestError('Invalid limit amount.');
    }

    if (cardType !== 'CREDIT' && cardType !== 'DEBIT') {
      throw new BadRequestError('Card type must be CREDIT or DEBIT.');
    }

    const card = await cardRepository.createCard({
      userId: req.user.userId,
      cardToken,
      cardType,
      limitCents: parsedLimit,
      isActive: true
    });

    res.status(201).json({ 
      success: true,
      card 
    });
  }

  async updateLimit(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    const { limitCents } = req.body;
    const parsedLimit = parseInt(limitCents, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      throw new BadRequestError('Invalid limit amount.');
    }

    const card = await cardRepository.updateLimitByUserId(req.user.userId, parsedLimit);
    if (!card) {
      throw new NotFoundError('Card not found for user.');
    }

    res.status(200).json({ card });
  }

  async toggleActive(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      throw new BadRequestError('isActive must be a boolean.');
    }

    const card = await cardRepository.findCardByUserId(req.user.userId);
    if (!card) {
      throw new NotFoundError('Card not found for user.');
    }

    const updated = await cardRepository.toggleActive(card.id, isActive);
    res.status(200).json({ card: updated });
  }

  async getAllCards(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    if (req.user.role !== 'ADMIN' && req.user.role !== 'BANK_ADMIN') {
      throw new BadRequestError('Unauthorized access.');
    }

    const { limit = 100 } = req.query;
    const parsedLimit = parseInt(limit as string, 10) || 100;

    const cards = await cardRepository.getAllCards(parsedLimit);
    
    const cardsWithBalance = await Promise.all(
      cards.map(async (card) => {
        const wallet = await bankRepository.findWalletByUserId(card.userId);
        const balanceCents = wallet ? Math.round(parseFloat(wallet.balance) * 100) : 0;
        return {
          ...card,
          balanceCents,
          availableCents: Math.max(0, card.limitCents - balanceCents)
        };
      })
    );

    res.status(200).json({ cards: cardsWithBalance });
  }

  async getCardByToken(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    if (req.user.role !== 'ADMIN' && req.user.role !== 'BANK_ADMIN') {
      throw new BadRequestError('Unauthorized access.');
    }

    const { cardToken } = req.params;
    const card = await cardRepository.findCardByToken(cardToken);
    if (!card) {
      throw new NotFoundError('Card not found.');
    }

    const wallet = await bankRepository.findWalletByUserId(card.userId);
    const balanceCents = wallet ? Math.round(parseFloat(wallet.balance) * 100) : 0;

    res.status(200).json({
      card: {
        ...card,
        balanceCents,
        availableCents: Math.max(0, card.limitCents - balanceCents)
      }
    });
  }
}

export const cardController = new CardController();
