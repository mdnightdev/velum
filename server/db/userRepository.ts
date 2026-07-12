import { db, saveDb } from '../db.js';
import { User } from '../../src/types.js';

export const userRepository = {
  /**
   * Retrieve all users
   */
  findAll(): User[] {
    return db.users || [];
  },

  /**
   * Find a user by ID
   */
  findById(id: number): User | undefined {
    return (db.users || []).find(u => Number(u.user_id) === Number(id));
  },

  /**
   * Find a user by username handle (case-insensitive, handles leading @)
   */
  findByUsername(username: string): User | undefined {
    if (!username) return undefined;
    const cleanName = username.trim().toLowerCase();
    const alternateName = cleanName.startsWith('@') ? cleanName.substring(1) : `@${cleanName}`;
    return (db.users || []).find(u => {
      const uName = u.username.toLowerCase();
      return uName === cleanName || uName === alternateName;
    });
  },

  /**
   * Persist a new user record
   */
  create(user: User): void {
    db.users = db.users || [];
    db.users.push(user);
    saveDb();
  },

  /**
   * Update fields of an existing user record
   */
  update(id: number, updates: Partial<User>): User | undefined {
    const user = this.findById(id);
    if (!user) return undefined;

    Object.assign(user, updates);
    user.updated_at = new Date().toISOString();
    saveDb();
    return user;
  },

  /**
   * Delete a user by ID
   */
  deleteById(id: number): void {
    db.users = (db.users || []).filter(u => Number(u.user_id) !== Number(id));
    saveDb();
  },

  /**
   * Calculate next incremental user primary key ID
   */
  nextId(): number {
    const users = this.findAll();
    return Math.max(...users.map(u => Number(u.user_id)), 0) + 1;
  }
};
