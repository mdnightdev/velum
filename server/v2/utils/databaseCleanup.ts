import { sql } from 'drizzle-orm';
import { db, pool } from '../db/client.js';

export interface OrphanScanResult {
  entity: string;
  count: number;
  status: 'CLEAN' | 'NEEDS_CLEANUP';
}

export interface CleanupReport {
  members: number;
  messages: number;
  sublounges: number;
  relationships: number;
  ownerlessLounges: number;
  expiredSessions: number;
  totalCleaned: number;
}

export class DatabaseCleanupService {
  /**
   * Scan relational tables for orphaned references and stale records.
   */
  public async scanOrphans(): Promise<{ totalOrphans: number; rows: OrphanScanResult[] }> {
    const res = await pool.query(`
      SELECT 'lounges (orphaned owners)' as name, count(*)::int as count FROM lounges WHERE (owner_id NOT IN (SELECT id FROM users) OR owner_id IS NULL) AND is_official = false AND is_system = false
      UNION ALL
      SELECT 'relationships (invalid users)', count(*)::int FROM relationships WHERE user_id NOT IN (SELECT id FROM users) OR friend_id NOT IN (SELECT id FROM users)
      UNION ALL
      SELECT 'lounge_members (invalid references)', count(*)::int FROM lounge_members WHERE lounge_id NOT IN (SELECT id FROM lounges) OR user_id NOT IN (SELECT id FROM users)
      UNION ALL
      SELECT 'messages (invalid references)', count(*)::int FROM messages WHERE lounge_id NOT IN (SELECT id FROM lounges) OR sender_id NOT IN (SELECT id FROM users)
      UNION ALL
      SELECT 'sublounges (invalid parent)', count(*)::int FROM lounges WHERE parent_lounge_id IS NOT NULL AND parent_lounge_id NOT IN (SELECT id FROM lounges)
      UNION ALL
      SELECT 'tickets (invalid user)', count(*)::int FROM tickets WHERE user_id NOT IN (SELECT id FROM users)
      UNION ALL
      SELECT 'reports (invalid target)', count(*)::int FROM reports WHERE target_user_id NOT IN (SELECT id FROM users) OR reporter_id NOT IN (SELECT id FROM users)
      UNION ALL
      SELECT 'transactions (invalid wallet)', count(*)::int FROM transactions WHERE wallet_id NOT IN (SELECT id FROM wallets)
      UNION ALL
      SELECT 'expired_sessions (stale tokens)', count(*)::int FROM sessions WHERE expires_at < NOW()
    `);

    let totalOrphans = 0;
    const rows: OrphanScanResult[] = res.rows.map(r => {
      const c = Number(r.count || 0);
      totalOrphans += c;
      return {
        entity: r.name,
        count: c,
        status: c === 0 ? 'CLEAN' : 'NEEDS_CLEANUP'
      };
    });

    return { totalOrphans, rows };
  }

  /**
   * Purge orphaned relational entries and expired session tokens.
   */
  public async cleanOrphans(): Promise<CleanupReport> {
    const cleanMembers = await db.execute(sql`
      DELETE FROM lounge_members 
      WHERE lounge_id NOT IN (SELECT id FROM lounges)
         OR user_id NOT IN (SELECT id FROM users)
    `);
    const members = cleanMembers.rowCount || 0;

    const cleanMessages = await db.execute(sql`
      DELETE FROM messages 
      WHERE lounge_id NOT IN (SELECT id FROM lounges)
         OR sender_id NOT IN (SELECT id FROM users)
    `);
    const messages = cleanMessages.rowCount || 0;

    const cleanSublounges = await db.execute(sql`
      DELETE FROM lounges 
      WHERE parent_lounge_id IS NOT NULL 
        AND parent_lounge_id NOT IN (SELECT id FROM lounges)
        AND is_official = false
    `);
    const sublounges = cleanSublounges.rowCount || 0;

    const cleanRelationships = await db.execute(sql`
      DELETE FROM relationships
      WHERE user_id NOT IN (SELECT id FROM users)
         OR friend_id NOT IN (SELECT id FROM users)
    `);
    const relationships = cleanRelationships.rowCount || 0;

    const cleanOwnerlessLounges = await db.execute(sql`
      DELETE FROM lounges
      WHERE (owner_id NOT IN (SELECT id FROM users) OR owner_id IS NULL)
        AND is_official = false
        AND is_system = false
    `);
    const ownerlessLounges = cleanOwnerlessLounges.rowCount || 0;

    const cleanSessions = await db.execute(sql`
      DELETE FROM sessions
      WHERE expires_at < NOW()
    `);
    const expiredSessions = cleanSessions.rowCount || 0;

    const totalCleaned = members + messages + sublounges + relationships + ownerlessLounges + expiredSessions;

    return {
      members,
      messages,
      sublounges,
      relationships,
      ownerlessLounges,
      expiredSessions,
      totalCleaned
    };
  }
}

export const databaseCleanup = new DatabaseCleanupService();
