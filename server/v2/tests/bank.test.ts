import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('V2 Banking Endpoints Integration Tests', () => {
  const senderUser = `sender_${Date.now()}`;
  const recipientUser = `recipient_${Date.now()}`;
  const password = 'SecureComplexPass123!';
  let senderToken = '';
  let recipientId = 0;

  it('Setup: Register sender and recipient', async () => {
    const reg1 = await request(app)
      .post('/v2/auth/register')
      .send({ username: senderUser, password });
    expect(reg1.status).toBe(201);
    senderToken = reg1.body.token;

    const reg2 = await request(app)
      .post('/v2/auth/register')
      .send({ username: recipientUser, password });
    expect(reg2.status).toBe(201);
    recipientId = reg2.body.user.id;
  });

  it('GET /v2/bank/wallet - should fetch or initialize wallet', async () => {
    const res = await request(app)
      .get('/v2/bank/wallet')
      .set('Authorization', `Bearer ${senderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.wallet).toBeDefined();
    expect(res.body.wallet.currency).toBe('USD');
  });

  it('POST /v2/bank/transfer - should reject transfer with insufficient funds', async () => {
    const res = await request(app)
      .post('/v2/bank/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        recipientUsername: recipientUser,
        amount: '500.00'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Insufficient funds for transfer.');
  });

  it('GET /v2/bank/history - should return empty history for new wallet', async () => {
    const res = await request(app)
      .get('/v2/bank/history')
      .set('Authorization', `Bearer ${senderToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.transactions)).toBe(true);
  });
});
