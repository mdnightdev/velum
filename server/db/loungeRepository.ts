import { db, saveDb } from '../db.js';
import { Lounge } from '../../src/types.js';

export const loungeRepository = {
  /**
   * Retrieve all lounges
   */
  findAll(): Lounge[] {
    return db.lounges || [];
  },

  /**
   * Find a lounge by ID, slug or identifier
   */
  findById(id: string | number): Lounge | undefined {
    return (db.lounges || []).find(l => 
      l && (l.id === id || l.lounge_id === id || l.slug === id)
    );
  },

  /**
   * Find a lounge by slug
   */
  findBySlug(slug: string): Lounge | undefined {
    return (db.lounges || []).find(l => l && l.slug === slug);
  },

  /**
   * Find a lounge by invite code
   */
  findByInviteCode(code: string): Lounge | undefined {
    return (db.lounges || []).find(l => l && l.invite_code === code);
  },

  /**
   * Find sublounges of a parent lounge
   */
  findSublounges(parentLoungeId: string): Lounge[] {
    return (db.lounges || []).filter(l => l && l.parent_lounge_id === parentLoungeId);
  },

  /**
   * Find system/official lounges
   */
  findSystemLounges(): Lounge[] {
    return (db.lounges || []).filter(l => l && Number(l.is_system) === 1);
  },

  /**
   * Find non-system user-created lounges
   */
  findUserLounges(): Lounge[] {
    return (db.lounges || []).filter(l => l && Number(l.is_system) === 0);
  },

  /**
   * Persist a new lounge record
   */
  create(lounge: Lounge): void {
    db.lounges = db.lounges || [];
    db.lounges.push(lounge);
    saveDb();
  },

  /**
   * Update an existing lounge
   */
  update(id: string, updates: Partial<Lounge>): Lounge | undefined {
    const lounge = this.findById(id);
    if (!lounge) return undefined;

    Object.assign(lounge, updates);
    saveDb();
    return lounge;
  },

  /**
   * Delete a lounge by ID
   */
  deleteById(id: string): void {
    db.lounges = (db.lounges || []).filter(l => l && l.lounge_id !== id && l.id !== id);
    saveDb();
  },

  /**
   * Delete multiple lounges by ID array
   */
  deleteMany(ids: string[]): void {
    db.lounges = (db.lounges || []).filter(l => l && !ids.includes(l.lounge_id));
    saveDb();
  }
};
