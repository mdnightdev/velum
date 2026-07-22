import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 users over 30s
    { duration: '1m', target: 50 },  // Stay at 50 users for 1m
    { duration: '30s', target: 0 },  // Ramp down
  ],
};

const BASE_URL = 'http://localhost:3000'; // Assuming server runs here

export default function () {
  // 1. User Journey: Login
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    username: 'test_user_' + Math.floor(Math.random() * 1000), // Dynamic user
    password: 'secure_password_123',
    fingerprint: 'Velum-Secure-Client-v3'
  }), { headers: { 'Content-Type': 'application/json' } });

  check(loginRes, { 'Logged in': (r) => r.status === 200 });

  if (loginRes.status === 200) {
    const sessionId = loginRes.json('sessionId');

    // 2. User Journey: Chat / Lounge interaction
    http.get(`${BASE_URL}/api/lounges`, {
      headers: { 'X-Session-ID': sessionId }
    });

    sleep(1); // Simulating think time

    // 3. User Journey: Ticket submission
    http.post(`${BASE_URL}/api/tickets`, JSON.stringify({
      content: 'Stress test message from ' + __VU // Virtual User ID
    }), {
      headers: { 'Content-Type': 'application/json', 'X-Session-ID': sessionId }
    });
  }

  sleep(Math.random() * 2); // Random think time
}
