import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('V2 Marketplace Endpoints Integration Tests', () => {
  const sellerName = `seller_${Date.now()}`;
  const password = 'SecureComplexPass123!';
  let sellerToken = '';
  let createdListingId = 0;

  it('Setup: Register seller user', async () => {
    const reg = await request(app)
      .post('/v2/auth/register')
      .send({ username: sellerName, password });
    expect(reg.status).toBe(201);
    sellerToken = reg.body.token;
  });

  it('POST /v2/marketplace/listings - should create a new listing', async () => {
    const res = await request(app)
      .post('/v2/marketplace/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        title: 'Test Software License Key',
        description: 'Verified license key for testing purposes.',
        price: 25.00,
        category: 'Software',
        stock: 5,
        digitalDelivery: true,
        digitalPayload: 'KEY-12345-ABCDE'
      });

    expect(res.status).toBe(201);
    expect(res.body.listing).toBeDefined();
    expect(res.body.listing.title).toBe('Test Software License Key');
    createdListingId = res.body.listing.id;
  });

  it('GET /v2/marketplace/listings - should list active items', async () => {
    const res = await request(app).get('/v2/marketplace/listings');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.listings)).toBe(true);
  });

  it('PATCH /v2/marketplace/listings/:id - should update listing details', async () => {
    const res = await request(app)
      .patch(`/v2/marketplace/listings/${createdListingId}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        price: 30.00,
        stock: 10
      });

    expect(res.status).toBe(200);
    expect(res.body.listing.stock).toBe(10);
  });
});
