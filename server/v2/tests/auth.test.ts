import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('V2 Auth Endpoints Integration Tests', () => {
  const testUsername = `user_${Date.now()}`;
  const testPassword = 'SecureComplexPass123!';
  let authToken = '';

  it('POST /v2/auth/register - should create user and return session token', async () => {
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

  it('POST /v2/auth/register - should reject weak password', async () => {
    const res = await request(app)
      .post('/v2/auth/register')
      .send({
        username: `weak_${Date.now()}`,
        password: '12345678'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request payload');
  });

  it('POST /v2/auth/login - should authenticate user successfully', async () => {
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

  it('GET /v2/auth/me - should return authenticated user profile', async () => {
    const res = await request(app)
      .get('/v2/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe(testUsername);
  });

  it('POST /v2/auth/logout - should invalidate session', async () => {
    const res = await request(app)
      .post('/v2/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out successfully.');
  });
});
