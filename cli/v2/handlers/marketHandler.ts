import { db } from '../../../server/v2/db/client.js';
import { listings, escrows } from '../../../server/v2/db/schema/marketplace.js';
import { marketRepository } from '../../../server/v2/repositories/marketRepository.js';
import { logAudit, requireArg } from '../helpers.js';
import { formatTable, printDetail } from '../table.js';
import { theme } from '../theme.js';
import { desc, eq } from 'drizzle-orm';

export async function handleMarketCommand(sub: string, rawArgs: string[]): Promise<void> {
  if (sub === 'listings' || sub === 'list') {
    const list = await db.select().from(listings).orderBy(desc(listings.createdAt)).limit(50);
    console.log(`\n=== Marketplace Listings (${list.length}) ===`);
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
        { key: 'title', label: 'Title', width: 22 },
        { key: 'price', label: 'Price', width: 10 },
        { key: 'seller', label: 'Seller ID', width: 10 },
        { key: 'stock', label: 'Stock', width: 8 },
        { key: 'category', label: 'Category', width: 14 }
      ]
    );
    return;
  }

  if (sub === 'escrows') {
    const list = await db.select().from(escrows).orderBy(desc(escrows.createdAt)).limit(50);
    console.log(`\n=== Active Escrow Transactions (${list.length}) ===`);
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
        { key: 'listing', label: 'Listing ID', width: 12 },
        { key: 'amount', label: 'Amount', width: 12 },
        { key: 'buyer', label: 'Buyer', width: 8 },
        { key: 'seller', label: 'Seller', width: 8 },
        { key: 'status', label: 'Status', width: 12 }
      ]
    );
    return;
  }

  if (sub === 'delist') {
    const listingId = requireArg(rawArgs, 0, 'delist <listing_id>');
    if (!listingId) return;
    const numId = parseInt(listingId, 10);
    if (isNaN(numId)) {
      console.log('Invalid listing ID.');
      return;
    }
    await db.delete(listings).where(eq(listings.id, numId));
    console.log(`[OK] Delisted and removed marketplace item #${numId}.`);
    await logAudit('/market/delist', String(numId), 'Delisted marketplace item via CLI');
    return;
  }

  console.log(`Unknown /market subcommand: "${sub}". Type "help" or "ls" to view commands.`);
}
