import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '../db/client.js';
import { wallets } from '../db/schema/wallets.js';
import { eq, and } from 'drizzle-orm';
import { reserveRepository } from '../repositories/reserveRepository.js';
import { RESERVE_TRADING } from '../services/institutionalBank.js';
import { ensureMarketCurrencySchema, listingPriceInPayCurrency } from '../services/marketplaceService.js';
import { SystemConfigService } from '../services/systemConfigService.js';

describe('Market', () => {
  const uniq = Date.now().toString(36).slice(-5);
  const sellerName = `tSell${uniq}`;
  const buyerName = `tBuy${uniq}`;
  const password = 'SecureComplexPass123!';
  let sellerToken = '';
  let buyerToken = '';
  let sellerId = 0;
  let buyerId = 0;
  let createdListingId = 0;
  let escrowId = 0;

  it('registers seller and buyer', async () => {
    const regS = await request(app)
      .post('/v2/auth/register')
      .send({ username: sellerName, password });
    expect(regS.status).toBe(201);
    sellerToken = regS.body.token;
    sellerId = regS.body.user.userId;

    const regB = await request(app)
      .post('/v2/auth/register')
      .send({ username: buyerName, password });
    expect(regB.status).toBe(201);
    buyerToken = regB.body.token;
    buyerId = regB.body.user.userId;
  });

  it('POST /v2/marketplace/listings creates EUR listing by default', async () => {
    await ensureMarketCurrencySchema();
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
    expect(res.body.listing.currency).toBe('EUR');
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
    expect(parseFloat(res.body.listing.price)).toBe(30);
  });

  it('spot FX helper converts listing EUR price into VLM pay amount', () => {
    const { paymentAmount, rate } = listingPriceInPayCurrency(30, 'EUR', 'VLM');
    expect(rate).toBeGreaterThan(0);
    expect(paymentAmount).toBeGreaterThan(0);
    expect(paymentAmount).not.toBe(30);
  });

  it('POST purchase with payCurrency=VLM holds escrow and debits VLM', async () => {
    const { paymentAmount } = listingPriceInPayCurrency(30, 'EUR', 'VLM');
    await db
      .update(wallets)
      .set({ balance: (paymentAmount + 50).toFixed(2), updatedAt: new Date() })
      .where(and(eq(wallets.userId, buyerId), eq(wallets.currency, 'VLM')));

    // ensure VLM wallet exists (may need create via wallets ensure)
    const existing = await db
      .select()
      .from(wallets)
      .where(and(eq(wallets.userId, buyerId), eq(wallets.currency, 'VLM')))
      .limit(1);
    if (!existing[0]) {
      await db.insert(wallets).values({
        userId: buyerId,
        balance: (paymentAmount + 50).toFixed(2),
        currency: 'VLM',
      });
    } else {
      await db
        .update(wallets)
        .set({ balance: (paymentAmount + 50).toFixed(2), updatedAt: new Date() })
        .where(eq(wallets.id, existing[0].id));
    }

    const res = await request(app)
      .post(`/v2/marketplace/listings/${createdListingId}/purchase`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ payCurrency: 'VLM' });

    expect(res.status).toBe(201);
    expect(res.body.escrow).toBeDefined();
    expect(res.body.escrow.currency).toBe('EUR');
    expect(res.body.escrow.paymentCurrency).toBe('VLM');
    expect(res.body.payment_currency).toBe('VLM');
    expect(parseFloat(res.body.escrow.amount)).toBe(30);
    escrowId = res.body.escrow.id;

    const vlm = await db
      .select()
      .from(wallets)
      .where(and(eq(wallets.userId, buyerId), eq(wallets.currency, 'VLM')))
      .limit(1);
    expect(parseFloat(vlm[0].balance)).toBeCloseTo(50, 1);
  });

  it('POST escrow RELEASE credits seller net and Trading Account fee in EUR', async () => {
    await SystemConfigService.setEscrowFee(1.0);
    const tradingBefore = (await reserveRepository.getReserve(RESERVE_TRADING))?.balanceCents ?? 0;

    const res = await request(app)
      .post('/v2/marketplace/escrow/action')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ transactionId: String(escrowId), action: 'RELEASE' });

    expect(res.status).toBe(200);
    expect(res.body.escrow.status).toBe('RELEASED');
    expect(res.body.feePercent).toBe(1);
    expect(res.body.sellerNet).toBe(29.7);
    expect(res.body.feeMajor).toBe(0.3);
    expect(res.body.feeEurCents).toBe(30);

    const tradingAfter = (await reserveRepository.getReserve(RESERVE_TRADING))!.balanceCents;
    expect(tradingAfter - tradingBefore).toBe(30);

    const sellerEur = await db
      .select()
      .from(wallets)
      .where(and(eq(wallets.userId, sellerId), eq(wallets.currency, 'EUR')))
      .limit(1);
    expect(parseFloat(sellerEur[0].balance)).toBeCloseTo(29.7, 2);
  });
});
