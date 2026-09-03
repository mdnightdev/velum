import readline from 'readline';
import { Writable } from 'stream';
import dotenv from 'dotenv';
import { userRepository } from '../../server/v2/repositories/userRepository.js';
import { verifyArgon2id } from '../../server/v2/utils/crypto.js';
import { VelumV2Shell } from './shell.js';
import { ensureAdminSeeded } from '../../server/v2/services/adminSeeder.js';

dotenv.config();

// Suppress extraneous driver deprecation warnings from polluting the terminal UI
process.on('warning', (warning) => {
  if (warning.name === 'Warning' && warning.message?.includes('SECURITY WARNING: The SSL modes')) {
    return;
  }
  console.warn(warning);
});

const mutableStdout = new Writable({
  write(chunk, encoding, callback) {
    if (!(this as any).muted) {
      process.stdout.write(chunk, encoding);
    }
    callback();
  }
}) as any;
mutableStdout.muted = false;

const shell = new VelumV2Shell();

const rl = readline.createInterface({
  input: process.stdin,
  output: mutableStdout,
  terminal: true,
  completer: (line: string) => shell.getCompletions(line)
});

function printMotd(): void {
  console.log(`\nVelum Admin CLI\n`);
}

async function bootstrap() {
  await ensureAdminSeeded();
  
  printMotd();

  rl.question('login: ', (username) => {
    mutableStdout.muted = false;
    process.stdout.write('password: ');
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
        authenticated = await verifyArgon2id(passwd, user.salt, user.passwordHash);
      }

      if (!authenticated) {
        console.log('Login incorrect');
        process.exit(1);
      }

      console.log('Authenticated.\n');

      await shell.start(rl);
    });
  });
}

bootstrap();
