import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { tickets, type Ticket, type NewTicket } from '../db/schema/index.js';

export class TicketRepository {
  async findAll(limit = 100, tx: any = db): Promise<Ticket[]> {
    return tx
      .select()
      .from(tickets)
      .orderBy(desc(tickets.createdAt))
      .limit(limit);
  }

  async findById(id: number, tx: any = db): Promise<Ticket | null> {
    const results = await tx.select().from(tickets).where(eq(tickets.id, id)).limit(1);
    return results[0] || null;
  }

  async findByUserId(userId: number, limit = 50, tx: any = db): Promise<Ticket[]> {
    return tx
      .select()
      .from(tickets)
      .where(eq(tickets.userId, userId))
      .orderBy(desc(tickets.createdAt))
      .limit(limit);
  }

  async create(data: NewTicket, tx: any = db): Promise<Ticket> {
    const inserted = await tx.insert(tickets).values(data).returning();
    return inserted[0];
  }

  async updateStatus(id: number, status: string, tx: any = db): Promise<Ticket | null> {
    const updated = await tx
      .update(tickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning();
    return updated[0] || null;
  }

  async delete(id: number, tx: any = db): Promise<Ticket | null> {
    const deleted = await tx.delete(tickets).where(eq(tickets.id, id)).returning();
    return deleted[0] || null;
  }

  async deleteAll(tx: any = db): Promise<number> {
    const result = await tx.delete(tickets);
    return result.rowCount || 0;
  }
}

export const ticketRepository = new TicketRepository();
