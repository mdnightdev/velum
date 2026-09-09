import { eq, desc } from 'drizzle-orm';
import { db } from '../../../server/v2/db/client.js';
import { lounges, messages } from '../../../server/v2/db/schema/lounges.js';
import { ensureVelumLoungeSeeded } from '../../../server/v2/services/loungeSeeder.js';
import { printTable } from '../table.js';
import { guardProtectedLounge } from '../protection.js';
import type { CommandContext } from '../types.js';

export async function handleLounges(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, logAudit } = ctx;

  await ensureVelumLoungeSeeded();

  if (sub === 'list' || sub === 'ls') {
    const allLounges = await db.select().from(lounges).limit(100);
    const parentLounges = allLounges.filter(l => !l.parentLoungeId && l.type !== 'dm');
    printTable(parentLounges.map(l => ({
      ID: l.id,
      Name: l.name,
      Type: l.type,
      Access: l.accessLevel,
      Private: l.isPrivate ? 'Y' : 'N',
      Hidden: l.isHidden ? 'Y' : 'N'
    })));
    return;
  }

  if (sub === 'cat') {
    const input = rawArgs[0];
    if (!input) { console.log('Usage: cat <lounge_id> or <parent_id>:<sublounge_id>'); return; }
    
    if (input.includes(':')) {
      const [parentId, subId] = input.split(':');
      const parentLoungeId = parseInt(parentId, 10);
      const subLoungeId = parseInt(subId, 10);
      
      if (isNaN(parentLoungeId) || isNaN(subLoungeId)) {
        console.log('Usage: cat <parent_id>:<sublounge_id>');
        return;
      }
      
      const [subLounge] = await db.select().from(lounges).where(eq(lounges.id, subLoungeId));
      if (!subLounge || subLounge.parentLoungeId !== parentLoungeId) {
        console.log(`Sublounge ${subLoungeId} not found under parent ${parentLoungeId}.`);
        return;
      }
      
      console.log(JSON.stringify(subLounge, null, 2));
      return;
    }
    
    const loungeId = parseInt(input, 10);
    if (isNaN(loungeId)) { console.log('Usage: cat <lounge_id>'); return; }
    
    const [found] = await db.select().from(lounges).where(eq(lounges.id, loungeId));
    if (!found) { console.log(`Lounge ${loungeId} not found.`); return; }
    
    console.log(JSON.stringify(found, null, 2));
    
    if (!found.parentLoungeId) {
      const allLounges = await db.select().from(lounges);
      const sublounges = allLounges.filter(l => l.parentLoungeId === found.id);
      if (sublounges.length > 0) {
        printTable(sublounges.map(l => ({
          ID: l.id,
          Name: l.name,
          Access: l.accessLevel,
          Private: l.isPrivate ? 'Y' : 'N',
          Hidden: l.isHidden ? 'Y' : 'N'
        })));
      }
    }
    return;
  }

  if (sub === 'create') {
    const [name, description] = rawArgs;
    if (!name) { console.log('Usage: create <name> [description]'); return; }
    const [created] = await db.insert(lounges).values({
      name,
      description: description || null,
      ownerId: 1,
      isPrivate: false
    }).returning();
    console.log(`[OK] Created lounge "${created.name}" (ID ${created.id}).`);
    return;
  }

  if (sub === 'delete') {
    const input = rawArgs[0];
    if (!input) { console.log('Usage: delete <lounge_id> or <parent_id>:<sublounge_id>'); return; }
    
    if (input.includes(':')) {
      const [parentId, subId] = input.split(':');
      const parentLoungeId = parseInt(parentId, 10);
      const subLoungeId = parseInt(subId, 10);
      
      if (isNaN(parentLoungeId) || isNaN(subLoungeId)) {
        console.log('Usage: delete <parent_id>:<sublounge_id>');
        return;
      }

      if (!guardProtectedLounge(subLoungeId, 'delete')) return;
      
      const [subLounge] = await db.select().from(lounges).where(eq(lounges.id, subLoungeId));
      if (!subLounge || subLounge.parentLoungeId !== parentLoungeId) {
        console.log(`Sublounge ${subLoungeId} not found under parent ${parentLoungeId}.`);
        return;
      }
      
      await db.delete(messages).where(eq(messages.loungeId, subLoungeId));
      await db.delete(lounges).where(eq(lounges.id, subLoungeId));
      console.log(`[OK] Sublounge ${subLounge.name} (ID ${subLoungeId}) deleted from parent ${parentLoungeId}.`);
      await logAudit('/lounges/delete', `${parentLoungeId}:${subLoungeId}`, `Deleted sublounge ${subLounge.name}`);
      return;
    }
    
    const loungeId = parseInt(input, 10);
    if (isNaN(loungeId)) { console.log('Usage: delete <lounge_id>'); return; }

    if (!guardProtectedLounge(loungeId, 'delete')) return;
    
    const [lounge] = await db.select().from(lounges).where(eq(lounges.id, loungeId));
    if (!lounge) { console.log(`Lounge ${loungeId} not found.`); return; }
    
    await db.delete(messages).where(eq(messages.loungeId, loungeId));
    await db.delete(lounges).where(eq(lounges.id, loungeId));
    console.log(`[OK] Lounge ${lounge.name} (ID ${loungeId}) and all messages deleted.`);
    await logAudit('/lounges/delete', String(loungeId), `Deleted lounge ${lounge.name}`);
    return;
  }

  if (sub === 'messages') {
    const input = rawArgs[0];
    if (!input) { console.log('Usage: messages <lounge_id> or <parent_id>:<sublounge_id>'); return; }
    
    let targetLoungeId: number;
    
    if (input.includes(':')) {
      const [parentId, subId] = input.split(':');
      const parentLoungeId = parseInt(parentId, 10);
      const subLoungeId = parseInt(subId, 10);
      
      if (isNaN(parentLoungeId) || isNaN(subLoungeId)) {
        console.log('Usage: messages <parent_id>:<sublounge_id>');
        return;
      }
      
      const [subLounge] = await db.select().from(lounges).where(eq(lounges.id, subLoungeId));
      if (!subLounge || subLounge.parentLoungeId !== parentLoungeId) {
        console.log(`Sublounge ${subLoungeId} not found under parent ${parentLoungeId}.`);
        return;
      }
      targetLoungeId = subLoungeId;
    } else {
      targetLoungeId = parseInt(input, 10);
      if (isNaN(targetLoungeId)) { console.log('Usage: messages <lounge_id>'); return; }
    }
    
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.loungeId, targetLoungeId))
      .orderBy(desc(messages.createdAt))
      .limit(50);
    printTable(msgs.map(m => ({
      ID: m.id,
      Sender: m.senderId,
      Msg: m.content.substring(0, 30),
      Time: m.createdAt ? new Date(m.createdAt).toISOString().split('T')[0] : '-'
    })));
    return;
  }

  if (sub === 'purge') {
    const input = rawArgs[0];
    if (!input) { console.log('Usage: purge <lounge_id> or <parent_id>:<sublounge_id>'); return; }
    
    let targetLoungeId: number;
    
    if (input.includes(':')) {
      const [parentId, subId] = input.split(':');
      const parentLoungeId = parseInt(parentId, 10);
      const subLoungeId = parseInt(subId, 10);
      
      if (isNaN(parentLoungeId) || isNaN(subLoungeId)) {
        console.log('Usage: purge <parent_id>:<sublounge_id>');
        return;
      }
      
      const [subLounge] = await db.select().from(lounges).where(eq(lounges.id, subLoungeId));
      if (!subLounge || subLounge.parentLoungeId !== parentLoungeId) {
        console.log(`Sublounge ${subLoungeId} not found under parent ${parentLoungeId}.`);
        return;
      }
      targetLoungeId = subLoungeId;
    } else {
      targetLoungeId = parseInt(input, 10);
      if (isNaN(targetLoungeId)) { console.log('Usage: purge <lounge_id>'); return; }
    }

    if (!guardProtectedLounge(targetLoungeId, 'purge messages from')) return;
    
    await db.delete(messages).where(eq(messages.loungeId, targetLoungeId));
    console.log(`[OK] Purged messages in lounge ${targetLoungeId}.`);
    await logAudit('/lounges/purge', String(targetLoungeId), `Purged messages in lounge ${targetLoungeId}`);
    return;
  }
}
