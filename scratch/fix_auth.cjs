const fs = require('fs');

let authService = fs.readFileSync('server/services/authService.ts', 'utf8');

authService = authService.replace(
  "export async function performUserLogin(params: {\n  username: string;\n  passwordHex: string;\n  ipAddress: string;\n  fingerprint: string;\n}): Promise<LoginAttemptResult> {\n  const { username, passwordHex, ipAddress, fingerprint } = params;",
  "export async function performUserLogin(params: {\n  username: string;\n  passwordHex: string;\n  ipAddress: string;\n  fingerprint: string;\n  generateSessionToken: any;\n  rateLimiterCache: any;\n  calculateBackoffMs: any;\n}): Promise<LoginAttemptResult> {\n  const { username, passwordHex, ipAddress, fingerprint, generateSessionToken, rateLimiterCache, calculateBackoffMs } = params;"
);

// Fix the undefined ticket errors around line 423
authService = authService.replace(
  "db.tickets.push(ticket);",
  "if (ticket) db.tickets.push(ticket as any);"
);
authService = authService.replace(
  "return { status: 'COMPROMISED', tracking_uuid: ticket.tracking_id, ticket };",
  "return { status: 'COMPROMISED', tracking_uuid: ticket?.tracking_id || '', ticket: ticket! };"
);

fs.writeFileSync('server/services/authService.ts', authService);
console.log("Fixed authService.ts");
