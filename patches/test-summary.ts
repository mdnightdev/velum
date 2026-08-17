import { db } from './server/v2/db/client.js';
import { lounges, messages, users } from './server/v2/db/schema/index.js';
import { eq, desc } from 'drizzle-orm';
const allLounges = await db.select().from(lounges);
console.log(allLounges.map(l => ({ slug: l.slug, type: l.type })));
process.exit(0);
