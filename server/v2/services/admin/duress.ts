import { db } from '../../db/client.js';
import { users } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';

export class AdminDuressService {
  async triggerDuressProtocol(userId: number) {
    console.warn(`[DURESS TRIGGERED] Duress protocol activated for user ID ${userId}`);
    await db.update(users).set({ duressActive: true }).where(eq(users.id, userId));

    return {
      success: true,
      duressActive: true,
      timestamp: new Date().toISOString()
    };
  }
}

export const adminDuressService = new AdminDuressService();
