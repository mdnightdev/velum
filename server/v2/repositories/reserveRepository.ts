import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { reserves, type Reserve, type NewReserve } from '../db/schema/index.js';

export class ReserveRepository {
  async getReserve(reserveType: string, tx: any = db): Promise<Reserve | null> {
    const results = await tx.select().from(reserves).where(eq(reserves.reserveType, reserveType)).limit(1);
    return results[0] || null;
  }

  async updateBalance(reserveType: string, deltaCents: number, tx: any = db): Promise<Reserve | null> {
    const current = await this.getReserve(reserveType, tx);
    if (!current) {
      const created = await tx.insert(reserves).values({
        reserveType,
        balanceCents: deltaCents
      }).returning();
      return created[0];
    }
    
    const updated = await tx
      .update(reserves)
      .set({ balanceCents: current.balanceCents + deltaCents, updatedAt: new Date() })
      .where(eq(reserves.reserveType, reserveType))
      .returning();
    return updated[0] || null;
  }

  async getAllReserves(tx: any = db): Promise<Reserve[]> {
    return tx.select().from(reserves);
  }
}

export const reserveRepository = new ReserveRepository();
