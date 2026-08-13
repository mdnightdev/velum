import { eq, ne, or, asc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { outboxEvents, type NewOutboxEvent } from '../db/schema/outbox.js';
import { listings } from '../db/schema/index.js';
import { getRedisClient } from '../db/redis.js';
import { scanContent } from './marketplaceService.js';

export class OutboxWorker {
  private isProcessing = false;
  private intervalTimer: NodeJS.Timeout | null = null;
  private rescanTimer: NodeJS.Timeout | null = null;

  async queueEvent(event: NewOutboxEvent, tx: any = db): Promise<void> {
    console.log(`[DEBUG] queueEvent called: ${event.eventType} for aggregate ${event.aggregateId}`);
    await tx.insert(outboxEvents).values(event);
  }

  async runMarketplaceRescan(): Promise<void> {
    const batchSize = 100;
    let lastId = 0;
    let hasMore = true;

    while (hasMore) {
      const activeListings = await db
        .select()
        .from(listings)
        .where(eq(listings.status, 'ACTIVE'))
        .orderBy(asc(listings.id))
        .offset(lastId)
        .limit(batchSize);

      if (activeListings.length === 0) {
        hasMore = false;
        break;
      }

      for (const listing of activeListings) {
        if (scanContent(listing.title, listing.description || '')) {
          await db
            .update(listings)
            .set({ status: 'PENDING_REVIEW' })
            .where(eq(listings.id, listing.id));
        }
      }
      lastId += batchSize;
    }
  }

  async processPendingEvents(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const processedCount = await db.transaction(async (tx) => {
        const pending = await tx
          .select()
          .from(outboxEvents)
          .where(eq(outboxEvents.processed, false))
          .limit(50)
          .for('update', { skipLocked: true });

        if (pending.length === 0) {
          return 0;
        }

        const redis = await getRedisClient();

        for (const evt of pending) {
          if (redis) {
            try {
              await redis.xAdd('velum:events', '*', {
                eventType: evt.eventType,
                aggregateId: evt.aggregateId,
                payload: JSON.stringify(evt.payload)
              });
              // Mark processed ONLY if Redis succeeded
              await tx
                .update(outboxEvents)
                .set({ processed: true })
                .where(eq(outboxEvents.id, evt.id));
            } catch (redisErr) {
              console.error(`[OUTBOX WORKER] Failed to publish event #${evt.id} to Redis:`, redisErr);
              // Do NOT mark as processed, it stays in PG outbox to retry
            }
          }
        }
        return pending.length;
      });

      this.isProcessing = false;
      return processedCount;
    } catch (err) {
      console.error('[OUTBOX WORKER] Error processing outbox events:', err);
      this.isProcessing = false;
      return 0;
    }
  }

  startWorker(pollIntervalMs = 5000, rescanIntervalMs = 60000): void {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => {
      this.processPendingEvents().catch(() => {});
    }, pollIntervalMs);
    
    this.rescanTimer = setInterval(() => {
      this.runMarketplaceRescan().catch((err) => console.error('[OUTBOX WORKER] Re-scan error:', err));
    }, rescanIntervalMs);
  }

  stopWorker(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (this.rescanTimer) {
      clearInterval(this.rescanTimer);
      this.rescanTimer = null;
    }
  }
}

export const outboxWorker = new OutboxWorker();
