import { db, saveDb } from '../db.js';
import { Ticket } from '../../src/types.js';

export const ticketRepository = {
  /**
   * Retrieve all tickets
   */
  findAll(): Ticket[] {
    return db.tickets || [];
  },

  /**
   * Find a ticket by ID
   */
  findById(id: string): Ticket | undefined {
    return (db.tickets || []).find(t => t.ticket_id === id);
  },

  /**
   * Find all tickets associated with a user ID
   */
  findByUserId(userId: number): Ticket[] {
    return (db.tickets || []).filter(t => Number(t.user_id) === Number(userId));
  },

  /**
   * Find an unresolved recovery request ticket for a user
   */
  findOpenRecoveryRequest(userId: number): Ticket | undefined {
    return (db.tickets || []).find(t => 
      Number(t.user_id) === Number(userId) && 
      t.issue_type === 'recovery_request' && 
      t.status !== 'resolved'
    );
  },

  /**
   * Find a ticket by user ID and provided recovery key code
   */
  findWithRecoveryKey(userId: number, key: string): Ticket | undefined {
    return (db.tickets || []).find(t => 
      Number(t.user_id) === Number(userId) && 
      t.provided_recovery_key === key
    );
  },

  /**
   * Persist a new ticket record
   */
  create(ticket: Ticket): void {
    db.tickets = db.tickets || [];
    db.tickets.push(ticket);
    saveDb();
  },

  /**
   * Delete a ticket by ID
   */
  deleteById(id: string): void {
    db.tickets = (db.tickets || []).filter(t => t.ticket_id !== id);
    saveDb();
  },

  /**
   * Delete all tickets associated with a user ID
   */
  deleteByUserId(userId: number): void {
    db.tickets = (db.tickets || []).filter(t => Number(t.user_id) !== Number(userId));
    saveDb();
  }
};
