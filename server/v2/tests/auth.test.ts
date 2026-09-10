import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Auth', () => {
  const uniq = Date.now().toString(36).slice(-5);
  const testUsername = `tAuth${uniq}`;
  const testPassword = 'SecureComplexPass123!';
  let authToken = '';

  it('POST /v2/auth/register creates user and session', async () => {
    const res = await request(app)
      .post('/v2/auth/register')
      .send({
        username: testUsername,
        password: testPassword
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe(testUsername);
    authToken = res.body.token;
  });

  it('POST /v2/auth/register rejects weak password', async () => {
    const res = await request(app)
      .post('/v2/auth/register')
      .send({
        username: `tWeak${uniq}`,
        password: '12345678'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request payload');
  });

  it('POST /v2/auth/login authenticates', async () => {
    const res = await request(app)
      .post('/v2/auth/login')
      .send({
        username: testUsername,
        password: testPassword
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    authToken = res.body.token;
    expect(res.body.user.username).toBe(testUsername);
  });

  it('GET /v2/auth/me returns profile', async () => {
    const res = await request(app)
      .get('/v2/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe(testUsername);
  });

  it('POST /v2/auth/logout invalidates session', async () => {
    const res = await request(app)
      .post('/v2/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out successfully.');
  });

  it('POST /v2/auth/login intercepts scheduled deletion', async () => {
    // 1. Log back in to get active session
    const loginRes = await request(app)
      .post('/v2/auth/login')
      .send({
        username: testUsername,
        password: testPassword
      });
    expect(loginRes.status).toBe(200);
    const activeToken = loginRes.body.token;

    // 2. Request account deactivation / deletion
    const deactRes = await request(app)
      .post('/v2/user/delete')
      .set('Authorization', `Bearer ${activeToken}`)
      .send({ reason: 'Testing deletion flow' });
    expect(deactRes.status).toBe(200);
    expect(deactRes.body.success).toBe(true);

    // 3. Attempt login - must be intercepted with scheduledDeletion info and NO session token
    const interceptRes = await request(app)
      .post('/v2/auth/login')
      .send({
        username: testUsername,
        password: testPassword
      });
    expect(interceptRes.status).toBe(200);
    expect(interceptRes.body.scheduledDeletion).toBe(true);
    expect(interceptRes.body.cancelToken).toBeDefined();
    expect(interceptRes.body.timeRemainingMs).toBeGreaterThan(0);
    expect(interceptRes.body.token).toBeUndefined();

    const cancelToken = interceptRes.body.cancelToken;

    // 4. Cancel deletion using cancelToken
    const cancelRes = await request(app)
      .post('/v2/auth/cancel-deletion')
      .send({
        username: testUsername,
        cancelToken
      });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.success).toBe(true);
    expect(cancelRes.body.token).toBeDefined();
    expect(cancelRes.body.user.role).toBe('USER');

    // 5. Normal login should now succeed again
    const normalLoginRes = await request(app)
      .post('/v2/auth/login')
      .send({
        username: testUsername,
        password: testPassword
      });
    expect(normalLoginRes.status).toBe(200);
    expect(normalLoginRes.body.token).toBeDefined();
    expect(normalLoginRes.body.scheduledDeletion).toBeUndefined();
  });
});

