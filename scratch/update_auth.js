import fs from 'fs';

let authService = fs.readFileSync('server/services/authService.ts', 'utf8');

const performLoginFn = `
export type LoginAttemptResult = 
  | { status: 'SUCCESS'; user: any; profile: any; sessionId: string; deviceId: string; signedToken: string }
  | { status: 'NEEDS_ACTIVATION'; user: any }
  | { status: 'NEEDS_MIGRATION'; user: any }
  | { status: 'COMPROMISED'; tracking_uuid: string; ticket: any }
  | { status: 'RATE_LIMITED'; waitSeconds: number }
  | { status: 'SUSPENDED' }
  | { status: 'REVOKED_SUPPORT' }
  | { status: 'INVALID_CREDENTIALS' };

import { generateSessionToken, rateLimiterCache } from '../middleware.js';
import { calculateBackoffMs } from '../crypto.js';

export async function performUserLogin(params: {
  username: string;
  passwordHex: string;
  ipAddress: string;
  fingerprint: string;
}): Promise<LoginAttemptResult> {
  const { username, passwordHex, ipAddress, fingerprint } = params;

  const ipRlKey = \`ip:\${ipAddress}\`;
  const ipRecord = rateLimiterCache.get(ipRlKey);
  if (ipRecord && ipRecord.blockUntil && Date.now() < ipRecord.blockUntil) {
    return { status: 'RATE_LIMITED', waitSeconds: Math.ceil((ipRecord.blockUntil - Date.now()) / 1000) };
  }

  const userRlKey = \`user:\${username.trim().toLowerCase()}\`;
  const userRecord = rateLimiterCache.get(userRlKey);
  if (userRecord && userRecord.blockUntil && Date.now() < userRecord.blockUntil) {
    return { status: 'RATE_LIMITED', waitSeconds: Math.ceil((userRecord.blockUntil - Date.now()) / 1000) };
  }

  const queryName = username.trim();
  const user = userRepository.findByUsername(queryName);

  if (user && user.role === 'SUPPORT_ADMIN') {
    const baseCleanName = user.username.replace(/^SA-/, '');
    const baseUser = userRepository.findByUsername(baseCleanName);
    if (!baseUser || baseUser.promotion_status !== 'APPROVED_SUPPORT') {
      return { status: 'REVOKED_SUPPORT' };
    }
  }

  if (user && user.activation_status === 'AWAITING_ACTIVATION') {
    return { status: 'NEEDS_ACTIVATION', user };
  }

  if (user) {
    const isPanicPhrase = await verifyArgon2id(passwordHex, user.salt, user.panic_phrase_hash);
    if (isPanicPhrase) {
      executePanicWipe();

      const deviceId = generatePrefixedId('dev');
      const ipId = generatePrefixedId('ip');
      const geoBase = await getIpGeoLocation(ipAddress);
      const { sessionId } = createNewSession(user.user_id, deviceId, ipId);

      const signedToken = generateSessionToken(user.user_id, user.username, 'USER', deviceId, sessionId);
      return {
        status: 'SUCCESS',
        user: { userId: user.user_id, username: user.username, role: 'USER', status: 'active' },
        profile: {
          profile_id: \`p_\${user.user_id}\`,
          user_id: user.user_id,
          bio: 'Proud Velum user.',
          avatar: 'user',
          location: geoBase,
          updated_at: new Date().toISOString()
        },
        sessionId,
        deviceId,
        signedToken
      };
    }
  }

  let isPasswordValid = false;
  if (user) {
    const authResult = await validateCredentials(user, passwordHex);
    isPasswordValid = authResult.isValid;
  } else {
    const dummySalt = crypto.createHash('sha256').update(queryName.toLowerCase() + '_salt_velum_dummy').digest('hex');
    const dummyHash = \`argon2id:\${dummySalt}:\${crypto.createHash('sha256').update('dummy_hash_placeholder').digest('hex')}\`;
    await verifyArgon2id(passwordHex, dummySalt, dummyHash);
  }

  if (!user || !isPasswordValid) {
    const uRecord = rateLimiterCache.get(userRlKey) || { attempts: 0, blockUntil: 0 };
    uRecord.attempts += 1;
    const backoff1 = calculateBackoffMs(uRecord.attempts);
    if (backoff1 > 0) uRecord.blockUntil = Date.now() + backoff1;
    rateLimiterCache.set(userRlKey, uRecord);

    const iRecord = rateLimiterCache.get(ipRlKey) || { attempts: 0, blockUntil: 0 };
    iRecord.attempts += 1;
    const backoff2 = calculateBackoffMs(iRecord.attempts);
    if (backoff2 > 0) iRecord.blockUntil = Date.now() + backoff2;
    rateLimiterCache.set(ipRlKey, iRecord);

    db.suspicious_events.push({
      event_id: generatePrefixedId('se'),
      entity_type: 'user',
      entity_id: username,
      risk_level: 'intermediate',
      description: \`Failed login attempt for account \${username}\`,
      created_at: new Date().toISOString()
    } as any);
    saveDb();
    return { status: 'INVALID_CREDENTIALS' };
  }

  rateLimiterCache.delete(userRlKey);
  rateLimiterCache.delete(ipRlKey);

  if (user.needs_reset || !user.salt) {
    return { status: 'NEEDS_MIGRATION', user };
  }

  if (user.status === 'compromised') {
    db.tickets = db.tickets || [];
    let ticket = db.tickets.find(t => t.user_id === user.user_id && t.issue_type === 'recovery_request' && t.status !== 'resolved');
    if (!ticket) {
      const ticketId = generatePrefixedId('t');
      const tracking_uuid = \`ticket_t_\${crypto.randomUUID()}\`;
      ticket = {
        ticket_id: ticketId,
        user_id: user.user_id,
        username: user.username,
        issue_type: 'recovery_request',
        status: 'open',
        assigned_admin: null,
        created_at: new Date().toISOString(),
        resolved_at: null,
        credibility_score: 95,
        tracking_id: tracking_uuid,
        messages: [
          { sender_id: 0, sender_name: 'SYSTEM', content: 'SECURITY EVENT INITIATED. Account quarantined from emergency panic phrase trigger. High-credibility restore process started.', timestamp: new Date().toISOString() },
          { sender_id: 0, sender_name: 'SYSTEM', content: 'To coordinate with central control administrators and obtain your restore code, please formulate details in the chat below.', timestamp: new Date().toISOString() }
        ]
      } as any;
      db.tickets.push(ticket);
      db.audit_logs.push({
        log_id: generatePrefixedId('al'),
        admin_id: 0,
        admin_name: 'SYSTEM',
        action: 'panic_lock',
        target_type: 'user',
        target_id: user.user_id.toString(),
        reason: 'Auto-recovery ticket instantiated securely on authenticated login attempt.',
        timestamp: new Date().toISOString()
      } as any);
      saveDb();
    }
    return { status: 'COMPROMISED', tracking_uuid: ticket.tracking_id, ticket };
  }

  if (user.status === 'suspended') {
    return { status: 'SUSPENDED' };
  }

  const geoBase = await getIpGeoLocation(ipAddress);
  const profile = db.profiles.find(p => p.user_id === user.user_id);
  if (profile) {
    (profile as any).ip_address = ipAddress;
    (profile as any).device_fingerprint = fingerprint;
    if (!profile.location || profile.location === 'Poland') {
      profile.location = geoBase;
    }
    profile.updated_at = new Date().toISOString();
  }

  const isNewIp = !db.ip_addresses.some(ip => ip && ip.user_id === user.user_id && ip.ip_address === ipAddress);
  const isNewDevice = !db.devices.some(dev => dev && dev.user_id === user.user_id && dev.fingerprint === fingerprint);

  if (isNewIp || isNewDevice) {
    console.warn(\`[SYS-SECURE] Suspicious login detected for user \${user.username}: New IP or device fingerprint.\`);
    db.suspicious_events = db.suspicious_events || [];
    db.suspicious_events.push({
      event_id: generatePrefixedId('se'),
      user_id: user.user_id,
      ip_address: ipAddress,
      device_fingerprint: fingerprint,
      event_type: 'suspicious_login',
      details: \`Login from new IP (\${ipAddress}) or new device fingerprint.\`,
      timestamp: new Date().toISOString()
    } as any);
  }

  const ipId = generatePrefixedId('ip');
  db.ip_addresses.push({
    ip_id: ipId,
    user_id: user.user_id,
    ip_address: ipAddress,
    risk_score: 5,
    accounts_linked: 1,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    associated_fingerprints: [fingerprint]
  } as any);

  const deviceId = generatePrefixedId('dev');
  db.devices.push({
    device_id: deviceId,
    user_id: user.user_id,
    fingerprint,
    trust_score: 50,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    associated_ips: [ipAddress]
  } as any);
  saveDb();

  const { sessionId } = createNewSession(user.user_id, deviceId, ipId);
  const signedToken = generateSessionToken(user.user_id, user.username, user.role, deviceId, sessionId);

  return {
    status: 'SUCCESS',
    user: {
      userId: user.user_id,
      username: user.username,
      role: user.role,
      status: user.status
    },
    profile,
    sessionId,
    deviceId,
    signedToken
  };
}
`;

authService = authService + '\n' + performLoginFn;
fs.writeFileSync('server/services/authService.ts', authService);
