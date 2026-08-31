import { eq, desc } from 'drizzle-orm';
import { db } from '../../../server/v2/db/client.js';
import { escrows } from '../../../server/v2/db/schema/marketplace.js';
import { outboxEvents } from '../../../server/v2/db/schema/outbox.js';
import { marketRepository } from '../../../server/v2/repositories/marketRepository.js';
import { bankRepository } from '../../../server/v2/repositories/bankRepository.js';
import { printDetail, printTable } from '../table.js';
import type { CommandContext } from '../types.js';

export async function handleEscrow(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, requireIntArg } = ctx;

  if (sub === 'list' || sub === 'ls') {
    const escrowsList = await db.select().from(escrows).limit(100);
    printTable(escrowsList.map(e => ({
      ID: e.id,
      Listing: e.listingId,
      Buyer: e.buyerId,
      Seller: e.sellerId,
      Amount: `$${parseFloat(e.amount).toFixed(2)}`,
      Status: e.status,
      Created: e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : '-'
    })));
    return;
  }

  if (sub === 'outbox' || sub === 'events') {
    const arg = rawArgs[0];
    if (arg && !isNaN(parseInt(arg, 10))) {
      const id = parseInt(arg, 10);
      const results = await db.select().from(outboxEvents).where(eq(outboxEvents.id, id)).limit(1);
      if (results[0]) {
        console.log(JSON.stringify(results[0], null, 2));
      } else {
        console.log(`Event #${id} not found.`);
      }
      return;
    }

    const events = await db.select().from(outboxEvents).orderBy(desc(outboxEvents.createdAt)).limit(100);
    printTable(events.map(ev => ({
      ID: ev.id,
      EventType: ev.eventType,
      Status: ev.processed ? 'Processed' : 'Pending',
      Created: ev.createdAt ? new Date(ev.createdAt).toISOString().split('T')[0] : '-'
    })));
    return;
  }

  if (sub === 'cat' || sub === 'get') {
    const id = requireIntArg(rawArgs, 0, 'cat <escrow_id>');
    if (id === null) return;
    const item = await marketRepository.findEscrowById(id);
    if (!item) { console.log(`Escrow record ${id} not found.`); return; }
    printDetail('Escrow Details', {
      id: item.id,
      listingId: item.listingId,
      buyerId: item.buyerId,
      sellerId: item.sellerId,
      amount: item.amount,
      status: item.status,
      createdAt: item.createdAt
    });
    return;
  }

  if (sub === 'release') {
    const id = requireIntArg(rawArgs, 0, 'release <escrow_id>');
    if (id === null) return;
    const escrow = await marketRepository.findEscrowById(id);
    if (!escrow) { console.log(`Escrow ${id} not found.`); return; }

    await marketRepository.updateEscrowStatus(id, 'RELEASED');
    const sellerWallet = await bankRepository.findWalletByUserId(escrow.sellerId);
    if (sellerWallet) {
      const newBal = (parseFloat(sellerWallet.balance) + parseFloat(escrow.amount)).toFixed(2);
      await bankRepository.updateBalance(sellerWallet.id, newBal);
    }
    console.log(`[OK] Escrow ${id} released to seller ID ${escrow.sellerId}.`);
    return;
  }

  if (sub === 'refund') {
    const id = requireIntArg(rawArgs, 0, 'refund <escrow_id>');
    if (id === null) return;
    const escrow = await marketRepository.findEscrowById(id);
    if (!escrow) { console.log(`Escrow ${id} not found.`); return; }

    await marketRepository.updateEscrowStatus(id, 'REFUNDED');
    const buyerWallet = await bankRepository.findWalletByUserId(escrow.buyerId);
    if (buyerWallet) {
      const newBal = (parseFloat(buyerWallet.balance) + parseFloat(escrow.amount)).toFixed(2);
      await bankRepository.updateBalance(buyerWallet.id, newBal);
    }
    console.log(`[OK] Escrow ${id} refunded to buyer ID ${escrow.buyerId}.`);
    return;
  }

  if (sub === 'seize') {
    const id = requireIntArg(rawArgs, 0, 'seize <escrow_id>');
    if (id === null) return;
    const escrow = await marketRepository.findEscrowById(id);
    if (!escrow) { console.log(`Escrow ${id} not found.`); return; }
    await marketRepository.updateEscrowStatus(id, 'DISPUTED');
    console.log(`[OK] Escrow ${id} marked as DISPUTED.`);
    return;
  }
}
