/**
 * Purge disposable local test data:
 * - users with IDs 9000–9999 (test band)
 * - listings titled AutoTest*, Hold*, or Clean*
 *
 * Usage (local): npx tsx scripts/purge-test-accounts.ts
 */
import 'dotenv/config';
import { db } from '../server/v2/db/client.js';
import { users } from '../server/v2/db/schema/users.js';
import { listings } from '../server/v2/db/schema/marketplace.js';
import { sql, and, gte, lte, or, ilike } from 'drizzle-orm';
import { UserDeletionService } from '../server/v2/services/userDeletionService.js';
import { TEST_USER_ID_MIN, TEST_USER_ID_MAX } from '../server/v2/constants/systemIds.js';

async function main() {
  const autoListings = await db
    .select({ id: listings.id, title: listings.title })
    .from(listings)
    .where(
      or(
        ilike(listings.title, 'AutoTest%'),
        ilike(listings.title, 'Hold%'),
        ilike(listings.title, 'Clean%')
      )
    );

  for (const row of autoListings) {
    await db.delete(listings).where(sql`${listings.id} = ${row.id}`);
    console.log(`deleted listing #${row.id} ${row.title}`);
  }

  const testUsers = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(and(gte(users.id, TEST_USER_ID_MIN), lte(users.id, TEST_USER_ID_MAX)));

  for (const u of testUsers) {
    const result = await UserDeletionService.executeInstantPurge(u.id, 'PURGE_TEST_BAND');
    console.log(`purged user #${u.id} ${u.username} ok=${result.success}`);
  }

  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('users', 'id'),
      GREATEST(
        (SELECT COALESCE(MAX(id), 1) FROM users WHERE id < ${TEST_USER_ID_MIN}),
        1000
      ),
      true
    );
  `);

  console.log(
    `Done. Removed ${autoListings.length} test listing(s), ${testUsers.length} test-band user(s) (${TEST_USER_ID_MIN}-${TEST_USER_ID_MAX}).`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
