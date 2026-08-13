import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { listings, escrows, type Listing, type NewListing, type Escrow, type NewEscrow } from '../db/schema/index.js';

export class MarketRepository {
  async createListing(data: NewListing, tx: any = db): Promise<Listing> {
    const inserted = await tx.insert(listings).values(data).returning();
    return inserted[0];
  }

  async findListingById(id: number, tx: any = db): Promise<Listing | null> {
    const results = await tx.select().from(listings).where(eq(listings.id, id)).limit(1);
    return results[0] || null;
  }

  async findListingByIdForUpdate(id: number, tx: any = db): Promise<Listing | null> {
    const results = await tx.select().from(listings).where(eq(listings.id, id)).limit(1).for('update');
    return results[0] || null;
  }

  async getListings(limit = 50, tx: any = db): Promise<Listing[]> {
    return tx
      .select()
      .from(listings)
      .where(eq(listings.status, 'ACTIVE'))
      .orderBy(desc(listings.createdAt))
      .limit(limit);
  }

  async updateListing(id: number, data: Partial<NewListing>, tx: any = db): Promise<Listing | null> {
    const updated = await tx
      .update(listings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(listings.id, id))
      .returning();
    return updated[0] || null;
  }

  async deleteListing(id: number, tx: any = db): Promise<boolean> {
    const deleted = await tx.delete(listings).where(eq(listings.id, id)).returning();
    return deleted.length > 0;
  }

  async createEscrow(data: NewEscrow, tx: any = db): Promise<Escrow> {
    const inserted = await tx.insert(escrows).values(data).returning();
    return inserted[0];
  }

  async findEscrowById(id: number, tx: any = db): Promise<Escrow | null> {
    const results = await tx.select().from(escrows).where(eq(escrows.id, id)).limit(1);
    return results[0] || null;
  }

  async findEscrowByIdForUpdate(id: number, tx: any = db): Promise<Escrow | null> {
    const results = await tx.select().from(escrows).where(eq(escrows.id, id)).limit(1).for('update');
    return results[0] || null;
  }

  async updateEscrowStatus(id: number, status: 'HELD' | 'RELEASED' | 'DISPUTED' | 'REFUNDED', tx: any = db): Promise<Escrow | null> {
    const updated = await tx
      .update(escrows)
      .set({ status })
      .where(eq(escrows.id, id))
      .returning();
    return updated[0] || null;
  }
}

export const marketRepository = new MarketRepository();
