const fs = require('fs');

let authCtrlLines = fs.readFileSync('server/controllers/auth.ts', 'utf8').split('\n');

const newLoginUser = `export const loginUser = async (req: Request, res: Response) => {
  try {
    const { username, password, fingerprint, nonce } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password.' });
    }

    if (!nonce || !verifyAndConsumeNonce(nonce)) {
      return res.status(400).json({ error: 'Cryptographic challenge handshake expired or replayed. Please retry.' });
    }

    if (!/^[0-9a-fA-F]{64}$/.test(password)) {
      return res.status(400).json({ error: 'Invalid password credential structure.' });
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || 'local-client';
    const ipStr = Array.isArray(ip) ? ip[0] : String(ip);

    const resolvedFingerprint = (fingerprint || req.headers['user-agent'] || 'Generic Web User Agent') as string;

    loadDb();

    const result = await performUserLogin({
      username,
      passwordHex: password,
      ipAddress: ipStr,
      fingerprint: resolvedFingerprint,
      generateSessionToken,
      rateLimiterCache,
      calculateBackoffMs
    });

    if (result.status === 'RATE_LIMITED') {
      return res.status(429).json({ error: \`Too many login failures. Please wait \${result.waitSeconds} seconds.\` });
    }

    if (result.status === 'REVOKED_SUPPORT') {
      return res.status(403).json({ error: 'FAIL: Security credentials revoked. Companion support operator nomination status is invalid.' });
    }

    if (result.status === 'NEEDS_ACTIVATION') {
      return res.json({
        needsActivation: true,
        userId: result.user.user_id,
        username: result.user.username,
        role: result.user.role
      });
    }

    if (result.status === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (result.status === 'NEEDS_MIGRATION') {
      return res.json({ needsMigration: true, userId: result.user.user_id, username: result.user.username });
    }

    if (result.status === 'COMPROMISED') {
      return res.status(403).json({ 
        error: 'SECURITY LOCK: This account is flagged as COMPROMISED. A priority support escalation ticket is online.',
        compromisedPortalActive: true,
        ticket: {
          ticket_id: result.ticket.ticket_id,
          status: result.ticket.status,
          issue_type: result.ticket.issue_type,
          created_at: result.ticket.created_at,
          resolved_at: result.ticket.resolved_at,
          credibility_score: result.ticket.credibility_score,
          tracking_id: result.ticket.tracking_id,
          provided_recovery_key: result.ticket.provided_recovery_key || null,
          messages: (result.ticket.messages || []).map((m: any) => ({
            sender_name: m.sender_id === 0 ? 'System' : (m.sender_name.startsWith('SA-') || m.sender_name === 'Admin' || m.sender_name === 'cli_admin' || m.sender_name === 'Midnight' || m.sender_name === 'Lexie' || m.sender_name === 'lexie' || m.sender_name === '午夜兔子' || m.sender_name === 'LEXIE' ? 'Support operator' : 'Client'),
            content: m.content,
            timestamp: m.timestamp
          }))
        }
      });
    }

    if (result.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Your account has been suspended by system administrators.' });
    }

    res.json({
      success: true,
      user: result.user,
      profile: result.profile,
      sessionId: result.signedToken,
      deviceId: result.deviceId
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(400).json({ error: err.message || 'Login sequence failed.' });
  }
};`;

authCtrlLines.splice(95, 390 - 95, newLoginUser);
let result = authCtrlLines.join('\n');
result = result.replace(
  "import { validateCredentials, executePanicWipe, createNewSession, performUserRegistration } from '../services/authService.js';",
  "import { validateCredentials, executePanicWipe, createNewSession, performUserRegistration, performUserLogin } from '../services/authService.js';"
);

fs.writeFileSync('server/controllers/auth.ts', result);
