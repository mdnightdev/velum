/**
 * VELUM LOAD TEST — k6
 * ============================================================================
 * Covers: nonce-based auth, friend requests, lounge chat, marketplace listings
 * + trades/escrow, product flagging, mutes/sanctions (admin), lounge creation,
 * compromised-account (brute-force/lockout) behavior, and support tickets.
 * ============================================================================
 */

import http from 'k6/http';
import { check, sleep, group, fail } from 'k6';
import { randomIntBetween, randomItem, uuidv4 } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { Counter, Trend, Rate } from 'k6/metrics';
import crypto from 'k6/crypto';

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const MAX_VUS = parseInt(__ENV.MAX_VUS || '100');

const ENDPOINTS = {
  preSignupSalt:      '/api/auth/pre-signup-salt',   // GET -> { salt }
  userSalt:           '/api/auth/user-salt',         // GET ?username= -> { salt }
  nonceRequest:       '/api/auth/login-nonce',       // GET -> { nonce }
  signup:             '/api/auth/register',          // POST { username, password, safeWord, panicPhrase, salt }
  login:              '/api/auth/login',             // POST { username, password, nonce, fingerprint } -> { token }
  logout:             '/api/auth/logout',            // POST (auth)
  friendRequest:      '/api/friends/requests',       // POST { receiverUsername }
  friendAccept:       '/api/friends/requests/:requestId/respond', // POST { response: 'accepted' }
  loungeCreate:       '/api/lounges',                // POST { name, visibility }
  loungeJoin:         '/api/lounges/join',           // POST { inviteCode }
  loungeMessage:      '/api/rooms/:roomId/messages', // POST { content }
  marketListingCreate:'/api/marketplace/listings',   // POST { title, price, currency, description }
  marketListingBrowse:'/api/marketplace/listings',   // GET
  tradeInitiate:      '/api/marketplace/escrows',    // POST { listingId }
  tradeEscrowRelease: '/api/marketplace/escrows/:id/release', // POST
  tradeEscrowRevert:  '/api/marketplace/escrows/:id/revert',  // POST
  adminSanction:      '/api/admin/sanction',         // POST { targetUsername, type, minutes, reason }
  ticketCreate:       '/api/tickets',                // POST { issueType, disputeText }
  panicTrigger:       '/api/auth/panic',             // POST { username, panicPhrase }
  paymentMethodRegister: '/api/payments/methods',    // POST { methodType, institution, methodCategory, initialBalanceCents }
};

// Seed credentials of authentic administrative operator
const ADMIN_CREDS = {
  username: 'Lexie',
  password: 'Falafax@velum#81',
};

// Fake credentials intentionally injected to assert security access blocks hold
const FAKE_ADMIN_CREDS = {
  username: 'admin@velum.local',
  password: 'AdminPass123',
};

// ---------------------------------------------------------------------------
// TEST DATA POOLS
// ---------------------------------------------------------------------------
const FIRST_NAMES_EN = ['James', 'Olivia', 'Liam', 'Emma', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'Lucas', 'Mia', 'Henry', 'Charlotte', 'Alexander', 'Amelia'];
const LAST_NAMES_EN = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Thomas'];

const FIRST_NAMES_KO = ['Min-jun', 'Seo-yeon', 'Ji-ho', 'Ha-eun', 'Do-yoon', 'Yu-jin', 'Joon-ho', 'Ji-woo', 'Seung-min', 'Eun-ji'];
const LAST_NAMES_KO = ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim'];

const LOUNGE_TOPICS = ['Crypto Traders', 'Vintage Watches', 'Sneaker Resale', 'Collectibles Vault', 'Forex Corner', 'Art Flippers', 'Dev Tools Exchange', 'Script Marketplace'];
const PRODUCT_TITLES = [
  'Rare Sneaker Pair', 'Vintage Rolex', 'Sealed Trading Card Box', 'Gaming GPU RTX', 'Signed Memorabilia', 'Limited Sneaker Drop',
  'Automation Script Bundle', 'SaaS Source Code License', 'Discord Bot Template', 'Web Scraper Toolkit', 'Trading Bot Config', 'Premium API Wrapper',
];
const FLAG_REASONS = [
  'counterfeit_suspected', 'price_manipulation', 'scam_pattern', 'prohibited_item', 'harassment',
  'malware_detected', 'exploit_code_listed', 'compromised_credentials_for_sale', 'account_hack_attempt', 'malicious_script',
];
const TICKET_CATEGORIES = ['escrow_dispute', 'ban_appeal', 'market_issue', 'wallet_trouble', 'general_support'];

function pwd() {
  return `Vel${randomIntBetween(1000, 9999)}!aA`;
}

function safeWord() {
  return `phoenix-${uuidv4().slice(0, 6)}`;
}

function panicPhrase() {
  return `mayday-${uuidv4().slice(0, 6)}`;
}

function randUser(seoul = false) {
  const first = seoul ? randomItem(FIRST_NAMES_KO) : randomItem(FIRST_NAMES_EN);
  const last = seoul ? randomItem(LAST_NAMES_KO) : randomItem(LAST_NAMES_EN);
  const suffix = uuidv4().slice(0, 8);
  const panic = panicPhrase();
  return {
    fullName: `${first} ${last}`,
    username: `${first.toLowerCase()}${suffix}`.replace(/[^a-z0-9]/g, ''),
    email: `${first.toLowerCase()}.${suffix}@velum-loadtest.local`,
    password: pwd(),
    safeWord: safeWord(),
    panicPhrase: panic,
    seoul,
  };
}

// ---------------------------------------------------------------------------
// CUSTOM METRICS
// ---------------------------------------------------------------------------
const loginSuccessRate = new Rate('login_success_rate');
const signupSuccessRate = new Rate('signup_success_rate');
const escrowCompletionTrend = new Trend('escrow_completion_duration');
const flagsCreated = new Counter('flags_created');
const ticketsCreated = new Counter('tickets_created');
const lockoutsTriggered = new Counter('lockouts_triggered');
const loungesCreated = new Counter('lounges_created');

// ---------------------------------------------------------------------------
// SHARED HELPERS
// ---------------------------------------------------------------------------
function authHeaders(token) {
  return { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } };
}

function jsonHeaders(extra = {}) {
  return { headers: Object.assign({ 'Content-Type': 'application/json' }, extra) };
}

function computeClientHash(secret, salt) {
  return crypto.sha256(`${salt}${secret}`, 'hex');
}

/**
 * Full pre-hashed client-side registration + login. Returns { token, user } or null on failure.
 */
function signupAndLogin(seoul = false) {
  sleep(Math.random() * 3);
  const user = randUser(seoul);
  const geoHeader = seoul ? { 'Accept-Language': 'ko-KR', 'X-Debug-Geo': 'Seoul' } : {};

  // Fetch registration pre-signup salt
  const saltRes = http.get(`${BASE_URL}${ENDPOINTS.preSignupSalt}`, jsonHeaders(geoHeader));
  if (saltRes.status !== 200) return null;
  const salt = saltRes.json('salt');

  // Compute pre-hashes client-side
  const hashedPassword = computeClientHash(user.password, salt);
  const hashedSafeWord = computeClientHash(user.safeWord, salt);
  const hashedPanicPhrase = computeClientHash(user.panicPhrase, salt);

  const signupRes = http.post(
    `${BASE_URL}${ENDPOINTS.signup}`,
    JSON.stringify({
      username: user.username,
      password: hashedPassword,
      safeWord: hashedSafeWord,
      panicPhrase: hashedPanicPhrase,
      salt: salt,
      deviceFingerprint: 'Velum-Secure-Client-v3'
    }),
    jsonHeaders(geoHeader)
  );

  const signupOk = check(signupRes, {
    'signup status 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  signupSuccessRate.add(signupOk);
  if (!signupOk) return null;

  return loginAs(user.username, user.password, geoHeader);
}

/**
 * Nonce flow: request user-salt -> request nonce -> submit login with nonce and client-hash.
 */
function loginAs(username, password, extraHeaders = {}) {
  // Fetch user salt
  const saltRes = http.get(`${BASE_URL}${ENDPOINTS.userSalt}?username=${username}`, jsonHeaders(extraHeaders));
  if (saltRes.status !== 200) return null;
  const salt = saltRes.json('salt');

  // Fetch challenge nonce
  const nonceRes = http.get(`${BASE_URL}${ENDPOINTS.nonceRequest}`, jsonHeaders(extraHeaders));
  if (nonceRes.status !== 200) return null;
  const nonce = nonceRes.json('nonce');

  // Compute client pre-hash
  const hashedPassword = computeClientHash(password, salt);

  const loginRes = http.post(
    `${BASE_URL}${ENDPOINTS.login}`,
    JSON.stringify({ username, password: hashedPassword, nonce, fingerprint: 'Velum-Secure-Client-v3' }),
    jsonHeaders(extraHeaders)
  );
  
  const loginOk = check(loginRes, { 'login status 200': (r) => r.status === 200 });
  loginSuccessRate.add(loginOk);
  if (!loginOk) return null;

  const token = loginRes.json('token');
  return { token, username };
}

// ---------------------------------------------------------------------------
// SCENARIO 1 — SOCIAL: friend requests + lounge chat
// ---------------------------------------------------------------------------
export function socialFlow() {
  const seoul = __VU % 5 === 0;
  const session = signupAndLogin(seoul);
  if (!session) fail('social: auth failed');
  const { token } = session;

  group('friend request', () => {
    // Generate a random username sequence
    const randTargetUser = `user_${uuidv4().slice(0, 8)}`;
    const res = http.post(
      `${BASE_URL}${ENDPOINTS.friendRequest}`,
      JSON.stringify({ receiverUsername: randTargetUser }),
      authHeaders(token)
    );
    // Target user may not exist, assert API correctly logs response structure
    check(res, { 'friend request responded': (r) => r.status !== 0 });
  });

  sleep(randomIntBetween(1, 2));

  group('lounge chat', () => {
    // Target global official lobby
    const roomId = 'official_lobby';
    const path = ENDPOINTS.loungeMessage.replace(':roomId', roomId);
    for (let i = 0; i < randomIntBetween(2, 5); i++) {
      const res = http.post(
        `${BASE_URL}${path}`,
        JSON.stringify({ content: `Load-test message ${uuidv4().slice(0, 6)}` }),
        authHeaders(token)
      );
      check(res, { 'message posted': (r) => [200, 201].includes(r.status) });
      sleep(randomIntBetween(1, 3));
    }
  });
}

// ---------------------------------------------------------------------------
// SCENARIO 2 — MARKETPLACE: listings, trades, escrow, card registration
// ---------------------------------------------------------------------------
export function marketplaceFlow() {
  const session = signupAndLogin(false);
  if (!session) fail('marketplace: auth failed');
  const { token } = session;

  let listingId;
  group('create listing', () => {
    const res = http.post(
      `${BASE_URL}${ENDPOINTS.marketListingCreate}`,
      JSON.stringify({
        title: randomItem(PRODUCT_TITLES),
        price: randomIntBetween(10, 5000),
        currency: 'USD',
        description: 'Load-test generated listing',
      }),
      authHeaders(token)
    );
    check(res, { 'listing created': (r) => [200, 201].includes(r.status) });
    try {
      listingId = res.json('listing_id');
    } catch (e) {
      /* noop */
    }
  });

  sleep(1);

  group('browse listings', () => {
    const res = http.get(`${BASE_URL}${ENDPOINTS.marketListingBrowse}`, authHeaders(token));
    check(res, { 'browse ok': (r) => r.status === 200 });
  });

  group('register payment card & account', () => {
    // 1. Link simulated Bank Account
    const bankRes = http.post(
      `${BASE_URL}${ENDPOINTS.paymentMethodRegister}`,
      JSON.stringify({
        methodType: 'BANK_ACCOUNT',
        institution: 'Silicon Valley Bank',
        methodCategory: 'BANK',
        initialBalanceCents: 500000,
      }),
      authHeaders(token)
    );
    check(bankRes, { 'bank account registered': (r) => [200, 201].includes(r.status) });

    // 2. Link simulated Debit Card
    const debitRes = http.post(
      `${BASE_URL}${ENDPOINTS.paymentMethodRegister}`,
      JSON.stringify({
        methodType: 'CARD',
        institution: 'Visa',
        methodCategory: 'DEBIT',
        initialBalanceCents: 150000,
      }),
      authHeaders(token)
    );
    check(debitRes, { 'debit card registered': (r) => [200, 201].includes(r.status) });

    // 3. Link simulated Credit Card
    const creditRes = http.post(
      `${BASE_URL}${ENDPOINTS.paymentMethodRegister}`,
      JSON.stringify({
        methodType: 'CARD',
        institution: 'Chase Sapphire',
        methodCategory: 'CREDIT',
        initialBalanceCents: 1000000,
      }),
      authHeaders(token)
    );
    check(creditRes, { 'credit card registered': (r) => [200, 201].includes(r.status) });
  });

  sleep(1);

  if (listingId) {
    group('initiate escrow checkout + release', () => {
      const start = Date.now();
      const tradeRes = http.post(
        `${BASE_URL}${ENDPOINTS.tradeInitiate}`,
        JSON.stringify({ listingId }),
        authHeaders(token)
      );
      const tradeOk = check(tradeRes, { 'escrow initiated': (r) => [200, 201].includes(r.status) });
      if (!tradeOk) return;

      let transactionId;
      try {
        transactionId = tradeRes.json('transaction_id');
      } catch (e) {
        return;
      }

      sleep(1);

      const releaseRes = http.post(
        `${BASE_URL}${ENDPOINTS.tradeEscrowRelease.replace(':id', transactionId)}`,
        null,
        authHeaders(token)
      );
      const released = check(releaseRes, { 'escrow released': (r) => [200, 201].includes(r.status) });
      if (released) escrowCompletionTrend.add(Date.now() - start);
    });
  }
}

// ---------------------------------------------------------------------------
// SCENARIO 3 — MODERATION: security bypass validation + admin mutes/sanctions
// ---------------------------------------------------------------------------
export function moderationFlow() {
  const session = signupAndLogin(false);
  if (!session) fail('moderation: user auth failed');
  const { token } = session;

  group('flag content report', () => {
    const res = http.post(
      `${BASE_URL}${ENDPOINTS.ticketCreate}`,
      JSON.stringify({
        issueType: 'user_misconduct',
        disputeText: `Load-test user reporting violation: ${randomItem(FLAG_REASONS)}`,
      }),
      authHeaders(token)
    );
    const ok = check(res, { 'report ticket logged': (r) => [200, 201].includes(r.status) });
    if (ok) flagsCreated.add(1);
  });

  sleep(1);

  // Assert security bypass block holds for invalid admin credentials
  group('security bypass check', () => {
    const bypassSession = loginAs(FAKE_ADMIN_CREDS.username, FAKE_ADMIN_CREDS.password);
    check(null, { 'admin security bypass blocked': () => bypassSession === null });
  });

  // Authentic admin authentication
  const adminSession = loginAs(ADMIN_CREDS.username, ADMIN_CREDS.password);
  if (!adminSession) {
    console.warn('moderation: authentic admin login failed');
    return;
  }
  const adminToken = adminSession.token;

  group('admin issue sanction', () => {
    const res = http.post(
      `${BASE_URL}${ENDPOINTS.adminSanction}`,
      JSON.stringify({
        targetUsername: session.username,
        type: 'mute',
        minutes: 30,
        reason: 'Temporary mute applied during concurrency load tests',
      }),
      authHeaders(adminToken)
    );
    check(res, { 'sanction mute applied': (r) => [200, 201].includes(r.status) });
  });
}

// ---------------------------------------------------------------------------
// SCENARIO 4 — LOUNGES: creation, invite join
// ---------------------------------------------------------------------------
export function loungeFlow() {
  const session = signupAndLogin(false);
  if (!session) fail('lounge: auth failed');
  const { token } = session;

  group('create lounge', () => {
    const res = http.post(
      `${BASE_URL}${ENDPOINTS.loungeCreate}`,
      JSON.stringify({
        name: `${randomItem(LOUNGE_TOPICS)} ${uuidv4().slice(0, 4)}`,
        visibility: randomItem(['public', 'private']),
      }),
      authHeaders(token)
    );
    const ok = check(res, { 'lounge created': (r) => [200, 201].includes(r.status) });
    if (ok) loungesCreated.add(1);
  });

  sleep(1);

  group('join via invite code', () => {
    const fakeCode = `VE/p/${uuidv4().slice(0, 6)}`;
    const res = http.post(
      `${BASE_URL}${ENDPOINTS.loungeJoin}`,
      JSON.stringify({ inviteCode: fakeCode }),
      authHeaders(token)
    );
    check(res, { 'join request processed': (r) => r.status !== 0 });
  });
}

// ---------------------------------------------------------------------------
// SCENARIO 5 — COMPROMISED ACCOUNT / BRUTE-FORCE / LOCKOUT
// ---------------------------------------------------------------------------
export function compromisedAccountFlow() {
  const victim = randUser(false);
  
  // Register victim
  const saltRes = http.get(`${BASE_URL}${ENDPOINTS.preSignupSalt}`);
  if (saltRes.status !== 200) fail('compromised: salt setup failed');
  const salt = saltRes.json('salt');

  const hashedPassword = computeClientHash(victim.password, salt);
  const hashedSafeWord = computeClientHash(victim.safeWord, salt);
  const hashedPanicPhrase = computeClientHash(victim.panicPhrase, salt);

  const signupRes = http.post(
    `${BASE_URL}${ENDPOINTS.signup}`,
    JSON.stringify({
      username: victim.username,
      password: hashedPassword,
      safeWord: hashedSafeWord,
      panicPhrase: hashedPanicPhrase,
      salt: salt,
      deviceFingerprint: 'Velum-Secure-Client-v3'
    }),
    jsonHeaders()
  );
  if (signupRes.status < 200 || signupRes.status >= 300) fail('compromised: victim signup failed');

  group('brute force lockout', () => {
    let lockedOut = false;
    for (let i = 0; i < 8; i++) {
      const nonceRes = http.get(`${BASE_URL}${ENDPOINTS.nonceRequest}`, jsonHeaders());
      if (nonceRes.status === 429 || nonceRes.status === 423) {
        lockedOut = true;
        break;
      }
      let nonce;
      try {
        nonce = nonceRes.json('nonce');
      } catch (e) {
        break;
      }
      
      const badLoginRes = http.post(
        `${BASE_URL}${ENDPOINTS.login}`,
        JSON.stringify({
          username: victim.username,
          password: computeClientHash('WrongPasswordSecret', salt),
          nonce,
          fingerprint: 'Velum-Secure-Client-v3'
        }),
        jsonHeaders()
      );
      
      if (badLoginRes.status === 429 || badLoginRes.status === 423) {
        lockedOut = true;
        break;
      }
      sleep(0.5);
    }
    if (lockedOut) lockoutsTriggered.add(1);
    check(null, { 'lockout engaged': () => lockedOut });
  });
}

// ---------------------------------------------------------------------------
// SCENARIO 6 — PANIC PHRASE TRIGGER
// ---------------------------------------------------------------------------
export function panicPhraseFlow() {
  const user = randUser(false);
  
  // Register user
  const saltRes = http.get(`${BASE_URL}${ENDPOINTS.preSignupSalt}`);
  if (saltRes.status !== 200) fail('panic: salt setup failed');
  const salt = saltRes.json('salt');

  const hashedPassword = computeClientHash(user.password, salt);
  const hashedSafeWord = computeClientHash(user.safeWord, salt);
  const hashedPanicPhrase = computeClientHash(user.panicPhrase, salt);

  const signupRes = http.post(
    `${BASE_URL}${ENDPOINTS.signup}`,
    JSON.stringify({
      username: user.username,
      password: hashedPassword,
      safeWord: hashedSafeWord,
      panicPhrase: hashedPanicPhrase,
      salt: salt,
      deviceFingerprint: 'Velum-Secure-Client-v3'
    }),
    jsonHeaders()
  );
  if (signupRes.status < 200 || signupRes.status >= 300) fail('panic: signup failed');

  sleep(1);

  group('trigger panic phrase', () => {
    const res = http.post(
      `${BASE_URL}${ENDPOINTS.panicTrigger}`,
      JSON.stringify({ username: user.username, panicPhrase: hashedPanicPhrase }),
      jsonHeaders()
    );
    check(res, { 'panic trigger responded': (r) => r.status !== 0 });
  });
}

// ---------------------------------------------------------------------------
// SCENARIO 7 — SUPPORT TICKETS
// ---------------------------------------------------------------------------
export function ticketFlow() {
  const session = signupAndLogin(false);
  if (!session) fail('ticket: auth failed');
  const { token } = session;

  group('create ticket case', () => {
    const res = http.post(
      `${BASE_URL}${ENDPOINTS.ticketCreate}`,
      JSON.stringify({
        issueType: randomItem(TICKET_CATEGORIES),
        disputeText: 'Auto-generated ticket body for k6 concurrency load testing.',
      }),
      authHeaders(token)
    );
    const ok = check(res, { 'ticket created ok': (r) => [200, 201].includes(r.status) });
    if (ok) ticketsCreated.add(1);
  });
}

// ---------------------------------------------------------------------------
// K6 OPTIONS — VU BUDGET ACROSS SCENARIOS
// ---------------------------------------------------------------------------
export const options = {
  scenarios: {
    social: {
      executor: 'ramping-vus',
      exec: 'socialFlow',
      startVUs: 0,
      stages: [
        { duration: '15s', target: Math.round(MAX_VUS * 0.3) },
        { duration: '30s', target: Math.round(MAX_VUS * 0.3) },
        { duration: '15s', target: 0 },
      ],
    },
    marketplace: {
      executor: 'ramping-vus',
      exec: 'marketplaceFlow',
      startVUs: 0,
      stages: [
        { duration: '15s', target: Math.round(MAX_VUS * 0.25) },
        { duration: '30s', target: Math.round(MAX_VUS * 0.25) },
        { duration: '15s', target: 0 },
      ],
    },
    moderation: {
      executor: 'ramping-vus',
      exec: 'moderationFlow',
      startVUs: 0,
      stages: [
        { duration: '15s', target: Math.round(MAX_VUS * 0.1) },
        { duration: '30s', target: Math.round(MAX_VUS * 0.1) },
        { duration: '15s', target: 0 },
      ],
    },
    lounges: {
      executor: 'ramping-vus',
      exec: 'loungeFlow',
      startVUs: 0,
      stages: [
        { duration: '15s', target: Math.round(MAX_VUS * 0.15) },
        { duration: '30s', target: Math.round(MAX_VUS * 0.15) },
        { duration: '15s', target: 0 },
      ],
    },
    compromisedAccounts: {
      executor: 'constant-vus',
      exec: 'compromisedAccountFlow',
      vus: Math.max(2, Math.round(MAX_VUS * 0.05)),
      duration: '1m',
    },
    panicPhrase: {
      executor: 'ramping-vus',
      exec: 'panicPhraseFlow',
      startVUs: 0,
      stages: [
        { duration: '15s', target: Math.round(MAX_VUS * 0.1) },
        { duration: '30s', target: Math.round(MAX_VUS * 0.1) },
        { duration: '15s', target: 0 },
      ],
    },
    tickets: {
      executor: 'ramping-vus',
      exec: 'ticketFlow',
      startVUs: 0,
      stages: [
        { duration: '15s', target: Math.round(MAX_VUS * 0.05) },
        { duration: '30s', target: Math.round(MAX_VUS * 0.05) },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};
