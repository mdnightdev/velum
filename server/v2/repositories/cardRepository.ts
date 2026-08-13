import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { cards, type Card, type NewCard } from '../db/schema/index.js';

export class CardRepository {
  async findCardByUserId(userId: number, tx: any = db): Promise<Card | null> {
    const results = await tx.select().from(cards).where(eq(cards.userId, userId)).limit(1);
    return results[0] || null;
  }

  async findCardByToken(cardToken: string, tx: any = db): Promise<Card | null> {
    const results = await tx.select().from(cards).where(eq(cards.cardToken, cardToken)).limit(1);
    return results[0] || null;
  }

  async createCard(data: NewCard, tx: any = db): Promise<Card> {
    const inserted = await tx.insert(cards).values(data).returning();
    return inserted[0];
  }

  async updateLimit(cardId: number, newLimitCents: number, tx: any = db): Promise<Card | null> {
    const updated = await tx
      .update(cards)
      .set({ limitCents: newLimitCents, updatedAt: new Date() })
      .where(eq(cards.id, cardId))
      .returning();
    return updated[0] || null;
  }

  async updateLimitByUserId(userId: number, newLimitCents: number, tx: any = db): Promise<Card | null> {
    const updated = await tx
      .update(cards)
      .set({ limitCents: newLimitCents, updatedAt: new Date() })
      .where(eq(cards.userId, userId))
      .returning();
    return updated[0] || null;
  }

  async toggleActive(cardId: number, isActive: boolean, tx: any = db): Promise<Card | null> {
    const updated = await tx
      .update(cards)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(cards.id, cardId))
      .returning();
    return updated[0] || null;
  }

  async getAllCards(limit = 100, tx: any = db): Promise<Card[]> {
    return tx
      .select()
      .from(cards)
      .orderBy(desc(cards.createdAt))
      .limit(limit);
  }

  async getCardsByType(cardType: string, limit = 100, tx: any = db): Promise<Card[]> {
    return tx
      .select()
      .from(cards)
      .where(eq(cards.cardType, cardType))
      .orderBy(desc(cards.createdAt))
      .limit(limit);
  }

  async deleteCard(cardId: number, tx: any = db): Promise<Card | null> {
    const deleted = await tx.delete(cards).where(eq(cards.id, cardId)).returning();
    return deleted[0] || null;
  }
}

export const cardRepository = new CardRepository();
