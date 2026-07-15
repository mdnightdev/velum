"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var readline_1 = require("readline");
var stream_1 = require("stream");
var dotenv_1 = require("dotenv");
var shell_ts_1 = require("./shell.ts");
// Suppress dotenv/dotenvx package console output noise during initialization
var originalConsoleLog = console.log;
var originalStdoutWrite = process.stdout.write;
try {
    console.log = function () { };
    process.stdout.write = function () { return true; };
    dotenv_1.default.config();
}
finally {
    console.log = originalConsoleLog;
    process.stdout.write = originalStdoutWrite;
}
var MIDNIGHT_PASSWORD = process.env.MIDNIGHT_PASSWORD || '';
// Create a mutable output stream that can mask password inputs
var mutableStdout = new stream_1.Writable({
    write: function (chunk, encoding, callback) {
        if (!this.muted) {
            process.stdout.write(chunk, encoding);
        }
        callback();
    }
});
mutableStdout.muted = false;
var rl = readline_1.default.createInterface({
    input: process.stdin,
    output: mutableStdout,
    terminal: true
});
function printMotd() {
    console.log("\nWelcome to Velum Secure OS v2.0 (GNU/Linux x86_64)\n\n * Systems:       Operational\n * Integrity:     Verified\n * Cache State:   Ready\n");
}
function bootstrap() {
    printMotd();
    rl.question('velum login: ', function (username) {
        // Unix-style password prompt
        mutableStdout.muted = false;
        process.stdout.write('Password: ');
        mutableStdout.muted = true;
        rl.question('', function (passwd) {
            mutableStdout.muted = false;
            console.log(); // Print newline after hidden input
            // Clean password from readline history to prevent leakage
            var rlAny = rl;
            if (rlAny.history && rlAny.history.length > 0) {
                rlAny.history = rlAny.history.slice(1);
            }
            if (passwd !== MIDNIGHT_PASSWORD) {
                console.log('Login incorrect');
                process.exit(1);
            }
            console.log('Last login: ' + new Date().toUTCString().replace('GMT', 'UTC') + ' from 127.0.0.1');
            console.log('Operator session authenticated successfully.\n');
            var shell = new shell_ts_1.VelumShell();
            shell.start(rl);
        });
    });
}
bootstrap();
