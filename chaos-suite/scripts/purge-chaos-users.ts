/**
 * Purge chaos-suite naming-pool users from Postgres + clear credentials.json.
 * Never touches IDs 1 / 2 / 999 or admin roles.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../../server/v2/db/client.js';
import { users } from '../../server/v2/db/schema/users.js';
import { userRepository } from '../../server/v2/repositories/userRepository.js';
import { NAME_POOL } from '../src/data/naming.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const credPath = path.join(__dirname, '..', 'chaos-data', 'credentials.json');
const PROTECTED = new Set([1, 2, 999]);
const ADMIN_ROLES = new Set(['CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN', 'ADMIN', 'BANK_ADMIN']);

async function main() {
  const fromCreds: { username: string; userId?: number }[] = [];
  if (fs.existsSync(credPath)) {
    const raw = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
    if (Array.isArray(raw)) fromCreds.push(...raw);
  }

  const poolLower = new Set(NAME_POOL.map((n) => n.toLowerCase()));
  const allUsers = await db
    .select({ id: users.id, username: users.username, role: users.role })
    .from(users);

  const targets = new Map<number, string>();
  for (const c of fromCreds) {
    if (c.userId && !PROTECTED.has(c.userId)) targets.set(c.userId, c.username);
  }
  for (const u of allUsers) {
    if (PROTECTED.has(u.id)) continue;
    if (ADMIN_ROLES.has(String(u.role || ''))) continue;
    const un = String(u.username || '');
    const base = un.replace(/\d+$/, '').toLowerCase();
    if (poolLower.has(un.toLowerCase()) || poolLower.has(base)) {
      targets.set(u.id, un);
    }
  }

  console.log(`purge targets: ${targets.size}`);
  let ok = 0;
  let fail = 0;
  for (const [id, name] of targets) {
    try {
      await userRepository.purgeUserCompletely(id, 'CHAOS_SUITE_RESET');
      console.log(`  purged ${name} (${id})`);
      ok++;
    } catch (e) {
      console.error(`  fail ${name} (${id}):`, (e as Error).message);
      fail++;
    }
  }

  fs.mkdirSync(path.dirname(credPath), { recursive: true });
  fs.writeFileSync(credPath, '[]\n');
  console.log(`credentials cleared → ${credPath}`);
  console.log(`done purged=${ok} failed=${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
