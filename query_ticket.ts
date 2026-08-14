import { db } from './server/v2/db/client.js';
import { tickets } from './server/v2/db/schema/index.js';
import { eq } from 'drizzle-orm';

async function main() {
  const [t] = await db.select().from(tickets).where(eq(tickets.id, 7)).limit(1);
  console.log(t);
  process.exit(0);
}
main();
