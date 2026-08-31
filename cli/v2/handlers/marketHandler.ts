import { db } from '../../../server/v2/db/client.js';
import { listings, escrows } from '../../../server/v2/db/schema/marketplace.js';
import { marketRepository } from '../../../server/v2/repositories/marketRepository.js';
import { logAudit, requireArg } from '../helpers.js';
import { formatTable } from '../table.js';
import { desc, eq } from 'drizzle-orm';

export async function handleMarketCommand(sub: string, rawArgs: string[]): Promise<void> {
  if (sub === 'listings' || sub === 'list') {
    const list = await db.select().from(listings).orderBy(desc(listings.createdAt)).limit(50);
    formatTable(
      list.map(l => ({
        id: l.id,
        title: l.title,
        price: `$${l.price}`,
        seller: l.sellerId,
        stock: l.stock,
        category: l.category
      })),
      [
        { key: 'id', label: 'ID', width: 6 },
        { key: 'title', label: 'TITLE', width: 22 },
        { key: 'price', label: 'PRICE', width: 10 },
        { key: 'seller', label: 'SELLER ID', width: 10 },
        { key: 'stock', label: 'STOCK', width: 8 },
        { key: 'category', label: 'CATEGORY', width: 14 }
      ]
    );
    return;
  }

  if (sub === 'escrows') {
    const list = await db.select().from(escrows).orderBy(desc(escrows.createdAt)).limit(50);
    formatTable(
      list.map(e => ({
        id: e.id,
        listing: e.listingId,
        amount: `$${e.amount}`,
        buyer: e.buyerId,
        seller: e.sellerId,
        status: e.status
      })),
      [
        { key: 'id', label: 'ID', width: 6 },
        { key: 'listing', label: 'LISTING ID', width: 12 },
        { key: 'amount', label: 'AMOUNT', width: 12 },
        { key: 'buyer', label: 'BUYER', width: 8 },
        { key: 'seller', label: 'SELLER', width: 8 },
        { key: 'status', label: 'STATUS', width: 12 }
      ]
    );
    return;
  }

  if (sub === 'delist') {
    const listingId = requireArg(rawArgs, 0, 'delist <listing_id>');
    if (!listingId) return;
    const numId = parseInt(listingId, 10);
    if (isNaN(numId)) {
      console.log('Listing ID must be a number.');
      return;
    }
    await marketRepository.deleteListing(numId);
    console.log(`[OK] Listing #${numId} deleted.`);
    await logAudit('/market/delist', String(numId), 'Listing removed');
    return;
  }

  console.log(`Unknown /market subcommand: "${sub}". Type "help" or "ls" to view commands.`);
}
