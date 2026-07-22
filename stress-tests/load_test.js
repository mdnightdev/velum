import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 20 },  // Ramp-up to 20 virtual users
    { duration: '1m',  target: 50 },  // Hold at 50 virtual users
    { duration: '20s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],     // Error rate must be under 2%
    http_req_duration: ['p(95)<500'],   // 95% of requests must complete within 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const headers = { 'Content-Type': 'application/json' };
  const userId = `test_user_${__VU}_${Math.floor(Math.random() * 1000)}`;

  // 1. Authentication
  group('Auth Flow', () => {
    const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      username: userId,
      password: 'secure_password_123',
      fingerprint: 'Velum-K6-LoadTest',
    }), { headers });

    check(res, {
      'auth response ok': (r) => r.status === 200 || r.status === 201,
    });
  });

  sleep(1);

  // 2. Fetch Lounges / Channels
  group('Lounge Fetch', () => {
    const res = http.get(`${BASE_URL}/api/lounges`, { headers });
    check(res, {
      'lounges response 200': (r) => r.status === 200,
    });
  });

  sleep(1);

  // 3. Post Message / Ticket
  group('Ticket Submission', () => {
    const res = http.post(`${BASE_URL}/api/tickets`, JSON.stringify({
      content: `Load test payload from VU ${__VU} at ${Date.now()}`,
    }), { headers });

    check(res, {
      'ticket created': (r) => r.status === 200 || r.status === 201,
    });
  });

  sleep(2);
}
