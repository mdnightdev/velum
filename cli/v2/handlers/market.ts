import { sql } from 'drizzle-orm';
import { db } from '../../../server/v2/db/client.js';
import { listings } from '../../../server/v2/db/schema/marketplace.js';
import { marketRepository } from '../../../server/v2/repositories/marketRepository.js';
import { printDetail, printTable } from '../table.js';
import type { CommandContext } from '../types.js';

export async function handleMarket(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, flags, requireIntArg } = ctx;

  if (sub === 'listings' || sub === 'list' || sub === 'ls') {
    const pageSize = 50;
    const page = Math.max(1, parseInt(flags['page'] as string, 10) || 1);
    const offset = (page - 1) * pageSize;

    const countRes = await db.select({ count: sql<number>`count(*)::int` }).from(listings);
    const totalCount = countRes[0]?.count || 0;
    const pageListings = await db.select().from(listings).limit(pageSize).offset(offset);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    printTable(pageListings.map(l => ({
      ID: l.id,
      Title: l.title,
      Price: l.price,
      SellerID: l.sellerId,
      Category: l.category,
      Stock: l.stock,
      Status: l.status
    })));

    if (page < totalPages) {
      console.log(`(page ${page}/${totalPages}, total ${totalCount}. Use "list --page ${page + 1}" for more)`);
    }
    return;
  }

  if (sub === 'cat' || sub === 'get') {
    const id = requireIntArg(rawArgs, 0, 'cat <listing_id>');
    if (id === null) return;
    const item = await marketRepository.findListingById(id);
    if (!item) { console.log(`Listing ${id} not found.`); return; }
    printDetail('Listing Details', {
      id: item.id,
      title: item.title,
      description: item.description,
      price: item.price,
      sellerId: item.sellerId,
      category: item.category,
      stock: item.stock,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    });
    return;
  }

  if (sub === 'suspend') {
    const id = requireIntArg(rawArgs, 0, 'suspend <listing_id>');
    if (id === null) return;
    const updated = await marketRepository.updateListing(id, { status: 'SUSPENDED' });
    console.log(`[OK] Listing ${id} status set to: ${updated?.status}`);
    return;
  }

  if (sub === 'unsuspend') {
    const id = requireIntArg(rawArgs, 0, 'unsuspend <listing_id>');
    if (id === null) return;
    const updated = await marketRepository.updateListing(id, { status: 'ACTIVE' });
    console.log(`[OK] Listing ${id} status set to: ${updated?.status}`);
    return;
  }

  if (sub === 'adjust') {
    const id = requireIntArg(rawArgs, 0, 'adjust <listing_id> <stock_count>');
    if (id === null) return;
    const count = parseInt(rawArgs[1], 10);
    if (isNaN(count)) { console.log('Usage: adjust <listing_id> <stock_count>'); return; }
    const updated = await marketRepository.updateListing(id, { stock: count });
    console.log(`[OK] Listing ${id} stock count updated to: ${updated?.stock}`);
    return;
  }
}
