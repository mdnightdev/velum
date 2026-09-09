import { ticketRepository } from '../../../server/v2/repositories/ticketRepository.js';
import { userRepository } from '../../../server/v2/repositories/userRepository.js';
import { printTable } from '../table.js';
import type { CommandContext } from '../types.js';

export async function handleTickets(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, requireIntArg, logAudit } = ctx;

  if (sub === 'list' || sub === 'ls') {
    const allTickets = await ticketRepository.findAll(100);
    if (allTickets.length > 0) {
      const ticketsWithUsers = await Promise.all(allTickets.map(async (ticket) => {
        const user = await userRepository.findById(ticket.userId);
        return {
          ID: ticket.id,
          Subject: ticket.subject,
          Status: ticket.status,
          User: user?.username || `user_${ticket.userId}`,
          Created: ticket.createdAt ? new Date(ticket.createdAt).toISOString().split('T')[0] : '-'
        };
      }));
      printTable(ticketsWithUsers);
    } else {
      console.log('No support tickets found.');
    }
    return;
  }

  if (sub === 'cat' || sub === 'show') {
    const id = requireIntArg(rawArgs, 0, 'cat <ticket_id>');
    if (id === null) return;
    const ticket = await ticketRepository.findById(id);
    if (!ticket) { console.log('Ticket not found.'); return; }
    const user = await userRepository.findById(ticket.userId);
    console.log(JSON.stringify({ ...ticket, username: user?.username || 'unknown' }, null, 2));
    return;
  }

  if (sub === 'delete') {
    const id = requireIntArg(rawArgs, 0, 'delete <ticket_id>');
    if (id === null) return;
    const deleted = await ticketRepository.delete(id);
    if (deleted) {
      console.log(`[OK] Support ticket ${id} deleted.`);
      await logAudit('/tickets/delete', String(id), 'Deleted support ticket');
    } else {
      console.log(`Ticket ${id} not found.`);
    }
    return;
  }

  if (sub === 'purge-all') {
    const count = await ticketRepository.deleteAll();
    console.log(`[OK] Purged ${count} support tickets.`);
    await logAudit('/tickets/purge-all', 'ALL', `Purged ${count} support tickets`);
    return;
  }
}
