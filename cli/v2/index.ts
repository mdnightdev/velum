import readline from 'readline';
import { Writable } from 'stream';
import dotenv from 'dotenv';
import { userRepository } from '../../server/v2/repositories/userRepository.js';
import { hashArgon2id, safeCompare } from '../../server/v2/utils/crypto.js';
import { VelumV2Shell } from './shell.js';
import { ensureAdminSeeded } from '../../server/v2/services/adminSeeder.js';

dotenv.config();

const mutableStdout = new Writable({
  write(chunk, encoding, callback) {
    if (!(this as any).muted) {
      process.stdout.write(chunk, encoding);
    }
    callback();
  }
}) as any;
mutableStdout.muted = false;

// Constructed early (before login) so its completer has namespace/path
// context available immediately, rather than wiring completion up after auth.
const shell = new VelumV2Shell();

const rl = readline.createInterface({
  input: process.stdin,
  output: mutableStdout,
  terminal: true,
  completer: (line: string) => shell.getCompletions(line)
});

function printMotd(): void {
  console.log(`
==================================================
 Welcome to Velum V2 Secure Administrative CLI
 Engine: PostgreSQL + Drizzle ORM + Local Redis
==================================================
`);
}

import crypto from 'node:crypto';

async function bootstrap() {
  // Seed admin users from environment variables
  await ensureAdminSeeded();
  
  printMotd();

  rl.question('velum-v2 login: ', (username) => {
    mutableStdout.muted = false;
    process.stdout.write('Password: ');
    mutableStdout.muted = true;

    rl.question('', async (passwd) => {
      mutableStdout.muted = false;
      console.log();

      const inputUsername = username.trim();
      let authenticated = false;

      let user = await userRepository.findByUsername(inputUsername);
      if (!user) {
        await ensureAdminSeeded();
        user = await userRepository.findByUsername(inputUsername);
      }
      if (user && (user.role === 'CLI_ADMIN' || user.role === 'ADMIN')) {
        const clientHash = crypto.createHash('sha256').update(user.salt + passwd).digest('hex');
        const computedPasswordHash = await hashArgon2id(passwd, Buffer.from(user.salt, 'hex'));
        const computedFromClientHash = await hashArgon2id(clientHash, Buffer.from(user.salt, 'hex'));

        const isMatch =
          safeCompare(computedPasswordHash, user.passwordHash) ||
          safeCompare('argon2id:' + computedPasswordHash, user.passwordHash) ||
          safeCompare(computedFromClientHash, user.passwordHash) ||
          safeCompare('argon2id:' + computedFromClientHash, user.passwordHash) ||
          safeCompare(passwd, user.passwordHash);

        if (isMatch) {
          authenticated = true;
        }
      }

      if (!authenticated) {
        console.log('Login incorrect');
        process.exit(1);
      }

      console.log('Operator session authenticated successfully.\n');

      shell.start(rl);
    });
  });
}

bootstrap();
