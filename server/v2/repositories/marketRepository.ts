import { eq, desc, or, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { listings, escrows, type Listing, type NewListing, type Escrow, type NewEscrow } from '../db/schema/index.js';
import { moderationService } from '../services/moderationService.js';
import { SystemBot } from '../services/systemBot.js';
import { BotTemplates } from '../services/botTemplates.js';
import { users } from '../db/schema/users.js';

export type ListingWithSeller = Listing & { sellerUsername?: string | null };

export type EscrowWithParties = Escrow & {
  buyerUsername?: string | null;
  sellerUsername?: string | null;
  listingTitle?: string | null;
};

export class MarketRepository {
  async createListing(data: NewListing, tx: any = db): Promise<Listing> {
    const combinedContent = `${data.title} ${data.description || ''} ${data.category || ''} ${data.digitalPayload || ''}`;
    const hit = moderationService.scanListingContent(combinedContent);

    const payload: NewListing = hit
      ? {
          ...data,
          status: 'PENDING_REVIEW',
          moderationReason: hit.match,
          moderationLane: hit.lane,
          heldAt: new Date(),
        }
      : {
          ...data,
          status: data.status || 'ACTIVE',
          moderationReason: null,
          moderationLane: null,
          heldAt: null,
        };

    const inserted = await tx.insert(listings).values(payload).returning();
    const listing = inserted[0] as Listing;

    if (hit && listing) {
      void (async () => {
        try {
          const [seller] = await db.select().from(users).where(eq(users.id, listing.sellerId)).limit(1);
          if (seller) {
            await SystemBot.getInstance().sendToUser(
              seller.id,
              BotTemplates.marketplaceListingHeldForReview(seller.username, listing.title, hit.lane, hit.match)
            );
          }
          const { auditLogs } = await import('../db/schema/audit_logs.js');
          await db.insert(auditLogs).values({
            logId: `mod_${Date.now()}_audit`,
            adminId: 999,
            adminName: 'SYSTEM_MODERATION',
            action: 'MARKETPLACE_LISTING_HELD',
            targetId: String(listing.sellerId),
            reason: `Listing #${listing.id} held (${hit.lane}): ${hit.match}`,
          });
        } catch {
          /* listing already PENDING_REVIEW */
        }
      })();
    }

    return listing;
  }

  async findListingById(id: number, tx: any = db): Promise<Listing | null> {
    const results = await tx.select().from(listings).where(eq(listings.id, id)).limit(1);
    return results[0] || null;
  }

  async findListingByIdForUpdate(id: number, tx: any = db): Promise<Listing | null> {
    const results = await tx.select().from(listings).where(eq(listings.id, id)).limit(1).for('update');
    return results[0] || null;
  }

  async getListings(limit = 50, tx: any = db): Promise<ListingWithSeller[]> {
    const rows = await tx
      .select({
        id: listings.id,
        sellerId: listings.sellerId,
        title: listings.title,
        description: listings.description,
        price: listings.price,
        currency: listings.currency,
        category: listings.category,
        stock: listings.stock,
        digitalDelivery: listings.digitalDelivery,
        digitalPayload: listings.digitalPayload,
        status: listings.status,
        moderationReason: listings.moderationReason,
        moderationLane: listings.moderationLane,
        heldAt: listings.heldAt,
        createdAt: listings.createdAt,
        updatedAt: listings.updatedAt,
        sellerUsername: users.username,
      })
      .from(listings)
      .leftJoin(users, eq(listings.sellerId, users.id))
      .where(eq(listings.status, 'ACTIVE'))
      .orderBy(desc(listings.createdAt))
      .limit(limit);
    return rows as ListingWithSeller[];
  }

  async listEscrowsForUser(userId: number, limit = 50, tx: any = db): Promise<EscrowWithParties[]> {
    const rows = await tx
      .select({
        id: escrows.id,
        listingId: escrows.listingId,
        buyerId: escrows.buyerId,
        sellerId: escrows.sellerId,
        amount: escrows.amount,
        currency: escrows.currency,
        paymentCurrency: escrows.paymentCurrency,
        paymentAmount: escrows.paymentAmount,
        status: escrows.status,
        createdAt: escrows.createdAt,
        listingTitle: listings.title,
        sellerUsername: users.username,
      })
      .from(escrows)
      .leftJoin(listings, eq(escrows.listingId, listings.id))
      .leftJoin(users, eq(escrows.sellerId, users.id))
      .where(or(eq(escrows.buyerId, userId), eq(escrows.sellerId, userId)))
      .orderBy(desc(escrows.createdAt))
      .limit(limit);

    const buyerIds = [
      ...new Set((rows as Array<{ buyerId: number }>).map((r) => r.buyerId)),
    ] as number[];
    const buyers =
      buyerIds.length === 0
        ? ([] as Array<{ id: number; username: string }>)
        : ((await tx
            .select({ id: users.id, username: users.username })
            .from(users)
            .where(inArray(users.id, buyerIds))) as Array<{ id: number; username: string }>);
    const buyerMap = new Map(buyers.map((b) => [b.id, b.username]));

    return rows.map((r: (typeof rows)[number]) => ({
      ...r,
      buyerUsername: buyerMap.get(r.buyerId) || null,
    })) as EscrowWithParties[];
  }

  async updateListing(id: number, data: Partial<NewListing>, tx: any = db): Promise<Listing | null> {
    const existing = await this.findListingById(id, tx);
    if (!existing) return null;

    const nextTitle = data.title ?? existing.title;
    const nextDescription = data.description ?? existing.description;
    const nextCategory = data.category ?? existing.category;
    const nextPayload = data.digitalPayload !== undefined ? data.digitalPayload : existing.digitalPayload;
    const combined = `${nextTitle} ${nextDescription || ''} ${nextCategory || ''} ${nextPayload || ''}`;
    const hit = moderationService.scanListingContent(combined);

    const patch: Partial<NewListing> = {
      ...data,
      updatedAt: new Date(),
    };

    if (hit) {
      patch.status = 'PENDING_REVIEW';
      patch.moderationReason = hit.match;
      patch.moderationLane = hit.lane;
      patch.heldAt = new Date();
    }

    const updated = await tx
      .update(listings)
      .set(patch)
      .where(eq(listings.id, id))
      .returning();

    const listing = updated[0] || null;
    if (hit && listing) {
      void moderationService.holdListingForReview(listing.id, hit);
    }
    return listing;
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

  async updateEscrowStatus(
    id: number,
    status: 'HELD' | 'RELEASED' | 'DISPUTED' | 'REFUNDED',
    tx: any = db
  ): Promise<Escrow | null> {
    const updated = await tx
      .update(escrows)
      .set({ status })
      .where(eq(escrows.id, id))
      .returning();
    return updated[0] || null;
  }
}

export const marketRepository = new MarketRepository();
