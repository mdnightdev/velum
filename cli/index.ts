// Suppress Node.js pg security warnings
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.message && warning.message.includes('SSL modes')) return;
  console.warn(warning.stack || warning.message);
});

import readline from 'readline';
import { Writable } from 'stream';
import dotenv from 'dotenv';
import { VelumShell } from './shell.ts';

// Suppress dotenv/dotenvx package console output noise during initialization
const originalConsoleLog = console.log;
const originalStdoutWrite = process.stdout.write;
try {
  console.log = () => {};
  process.stdout.write = () => true as any;
  dotenv.config();
} finally {
  console.log = originalConsoleLog;
  process.stdout.write = originalStdoutWrite;
}

const MIDNIGHT_PASSWORD = process.env.MIDNIGHT_PASSWORD || '';

if (!MIDNIGHT_PASSWORD) {
  console.error('[SECURITY ERROR] MIDNIGHT_PASSWORD environment variable is not defined or empty.');
  console.error('Please configure your administrative credentials in your .env file.');
  process.exit(1);
}

// Create a mutable output stream that can mask password inputs
const mutableStdout = new Writable({
  write(chunk, encoding, callback) {
    if (!(this as any).muted) {
      process.stdout.write(chunk, encoding);
    }
    callback();
  }
}) as any;
mutableStdout.muted = false;

const rl = readline.createInterface({
  input: process.stdin,
  output: mutableStdout,
  terminal: true
});

function printMotd(): void {
  console.log(`
Welcome to Velum Secure OS v2.0 (GNU/Linux x86_64)

 * Systems:       Operational
 * Integrity:     Verified
 * Cache State:   Ready
`);
}

function bootstrap(): void {
  printMotd();

  rl.question('velum login: ', (username) => {
    // Unix-style password prompt
    mutableStdout.muted = false;
    process.stdout.write('Password: ');
    mutableStdout.muted = true;

    rl.question('', (passwd) => {
      mutableStdout.muted = false;
      console.log(); // Print newline after hidden input

      // Clean password from readline history to prevent leakage
      const rlAny = rl as any;
      if (rlAny.history && rlAny.history.length > 0) {
        rlAny.history = rlAny.history.slice(1);
      }

      if (passwd !== MIDNIGHT_PASSWORD) {
        console.log('Login incorrect');
        process.exit(1);
      }

      console.log('Last login: ' + new Date().toUTCString().replace('GMT', 'UTC') + ' from 127.0.0.1');
      console.log('Operator session authenticated successfully.\n');

      const shell = new VelumShell();
      shell.start(rl);
    });
  });
}

bootstrap();
