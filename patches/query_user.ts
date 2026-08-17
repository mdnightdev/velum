import { db } from './server/v2/db/client';
import { users } from './server/v2/db/schema/index';
import { eq } from 'drizzle-orm';

async function main() {
  const [user] = await db.select().from(users).where(eq(users.username, 'Taipei')).limit(1);
  console.log(user);
  process.exit(0);
}
main();
