import { db } from '../../db/client.js';
import { users, wallets, listings } from '../../db/schema/index.js';
import { sql } from 'drizzle-orm';

export class AdminMetricsService {
  async getSystemOverview() {
    const [userCountResult] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [walletCountResult] = await db.select({ count: sql<number>`count(*)` }).from(wallets);
    const [listingCountResult] = await db.select({ count: sql<number>`count(*)` }).from(listings);

    return {
      totalUsers: Number(userCountResult?.count || 0),
      totalWallets: Number(walletCountResult?.count || 0),
      totalListings: Number(listingCountResult?.count || 0),
      serverUptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };
  }
}

export const adminMetricsService = new AdminMetricsService();
