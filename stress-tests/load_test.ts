import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import crypto from 'k6/crypto';

export const options = {
  stages: [
    { duration: '15s', target: 30 }, // Ramp up to 30 users over 15s
    { duration: '30s', target: 30 }, // Stay at 30 users for 30s
    { duration: '15s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<10000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = 'http://localhost:3000'; // Assuming server runs here

// Endpoints
const ENDPOINTS = {
  preSignupSalt: '/api/auth/pre-signup-salt',
  userSalt:      '/api/auth/user-salt',
  nonceRequest:  '/api/auth/login-nonce',
  signup:        '/api/auth/register',
  login:         '/api/auth/login',
  lounges:       '/api/lounges',
  tickets:       '/api/tickets',
};

function computeClientHash(secret, salt) {
  return crypto.sha256(`${salt}${secret}`, 'hex');
}

function randUser() {
  const rand = Math.floor(Math.random() * 10000000);
  return {
    username: `user${rand}`,
    password: `Pass_${rand}!`,
    safeWord: `safeword_${rand}`,
    panicPhrase: `panic_${rand}`,
  };
}

export default function () {
  const user = randUser();
  const headers = { 'Content-Type': 'application/json' };

  // 1. Fetch pre-signup salt
  const saltRes = http.get(`${BASE_URL}${ENDPOINTS.preSignupSalt}`, { headers });
  if (saltRes.status !== 200) fail('Failed to fetch registration salt');
  const salt = saltRes.json('salt');

  // Compute pre-hashes client-side
  const hashedPassword = computeClientHash(user.password, salt);
  const hashedSafeWord = computeClientHash(user.safeWord, salt);
  const hashedPanicPhrase = computeClientHash(user.panicPhrase, salt);

  // 2. Register user
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
    { headers }
  );

  const signupOk = check(signupRes, { 'Registered successfully': (r) => r.status === 200 });
  if (!signupOk) return;

  // 3. Login Flow
  // Request user-salt
  const userSaltRes = http.get(`${BASE_URL}${ENDPOINTS.userSalt}?username=${user.username}`, { headers });
  if (userSaltRes.status !== 200) return;
  const userSalt = userSaltRes.json('salt');

  // Fetch challenge nonce
  const nonceRes = http.get(`${BASE_URL}${ENDPOINTS.nonceRequest}`, { headers });
  if (nonceRes.status !== 200) return;
  const nonce = nonceRes.json('nonce');

  // Login
  const loginRes = http.post(
    `${BASE_URL}${ENDPOINTS.login}`,
    JSON.stringify({
      username: user.username,
      password: hashedPassword,
      nonce: nonce,
      fingerprint: 'Velum-Secure-Client-v3'
    }),
    { headers }
  );

  const loginOk = check(loginRes, { 'Logged in': (r) => r.status === 200 });
  if (!loginOk) return;

  const token = loginRes.json('sessionId');
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 4. Lounge interaction
  const loungesRes = http.get(`${BASE_URL}${ENDPOINTS.lounges}`, { headers: authHeaders });
  check(loungesRes, { 'Fetched lounges': (r) => r.status === 200 });

  sleep(Math.random() * 2); // Simulating think time

  // 5. Ticket submission
  const ticketRes = http.post(
    `${BASE_URL}${ENDPOINTS.tickets}`,
    JSON.stringify({
      username: user.username,
      issueType: 'general_support',
      disputeText: `Stress test issue description from VU ${__VU}`
    }),
    { headers: authHeaders }
  );
  check(ticketRes, { 'Submitted ticket': (r) => r.status === 200 || r.status === 201 });

  sleep(Math.random() * 2); // Random think time
}
