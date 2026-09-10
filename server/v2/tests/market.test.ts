import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Market', () => {
  const uniq = Date.now().toString(36).slice(-5);
  const sellerName = `tSell${uniq}`;
  const password = 'SecureComplexPass123!';
  let sellerToken = '';
  let createdListingId = 0;

  it('registers seller', async () => {
    const reg = await request(app)
      .post('/v2/auth/register')
      .send({ username: sellerName, password });
    expect(reg.status).toBe(201);
    sellerToken = reg.body.token;
  });

  it('POST /v2/marketplace/listings creates listing', async () => {
    const res = await request(app)
      .post('/v2/marketplace/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        title: 'HoldA',
        description: 'License for tests.',
        price: 25.0,
        category: 'Software',
        stock: 5,
        digitalDelivery: true,
        digitalPayload: 'KEY-12345-ABCDE',
      });

    expect(res.status).toBe(201);
    expect(res.body.listing).toBeDefined();
    expect(res.body.listing.title).toBe('HoldA');
    createdListingId = res.body.listing.id;
  });

  it('GET /v2/marketplace/listings lists active items', async () => {
    const res = await request(app).get('/v2/marketplace/listings');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.listings)).toBe(true);
  });

  it('PATCH /v2/marketplace/listings/:id updates listing', async () => {
    const res = await request(app)
      .patch(`/v2/marketplace/listings/${createdListingId}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        price: 30.0,
        stock: 10,
      });

    expect(res.status).toBe(200);
    expect(res.body.listing.stock).toBe(10);
  });
});
