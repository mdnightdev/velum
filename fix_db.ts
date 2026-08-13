import { db } from './server/v2/db/client.js';
import { users } from './server/v2/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { hashArgon2id, generateRandomToken } from './server/v2/utils/crypto.js';

async function main() {
  const newSalt = generateRandomToken(16);
  const newSaltBuf = Buffer.from(newSalt, 'hex');
  const passHashHex = await hashArgon2id('Falafax@12', newSaltBuf);

  await db.update(users)
    .set({
      passwordHash: `argon2id:${passHashHex}`,
      salt: newSalt
    })
    .where(eq(users.username, 'Taipei'));

  console.log('Fixed Taipei password');
  process.exit(0);
}
main();
