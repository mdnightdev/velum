import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, sessions, type User, type NewUser, type Session, type NewSession } from '../db/schema/index.js';

export class UserRepository {
  async findById(id: number): Promise<User | null> {
    const results = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return results[0] || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const results = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.username}) = LOWER(${username})`)
      .limit(1);
    return results[0] || null;
  }

  async create(data: NewUser): Promise<User> {
    const inserted = await db.insert(users).values(data).returning();
    return inserted[0];
  }

  async update(id: number, data: Partial<NewUser>): Promise<User | null> {
    const updated = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const deleted = await db.delete(users).where(eq(users.id, id)).returning();
    return deleted.length > 0;
  }

  async createSession(data: NewSession): Promise<Session> {
    const inserted = await db.insert(sessions).values(data).returning();
    return inserted[0];
  }

  async findSessionByTokenHash(tokenHash: string): Promise<{ session: Session; user: User } | null> {
    const results = await db
      .select({
        session: sessions,
        user: users
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);

    if (results.length === 0) return null;
    return results[0];
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<boolean> {
    const deleted = await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash)).returning();
    return deleted.length > 0;
  }

  async deleteAllSessionsForUser(userId: number, tx: any = db): Promise<number> {
    const deleted = await tx.delete(sessions).where(eq(sessions.userId, userId));
    return deleted.rowCount || 0;
  }
}

export const userRepository = new UserRepository();
