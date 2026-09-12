import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { currencyConverter } from '../services/currencyConverter.js';
import { db } from '../db/client.js';
import { wallets } from '../db/schema/wallets.js';
import { cards } from '../db/schema/cards.js';
import { eq, and } from 'drizzle-orm';
import { reserveRepository } from '../repositories/reserveRepository.js';
import { cardRepository } from '../repositories/cardRepository.js';
import {
  ensureInstitutionalReservesEur,
  RESERVE_VCB,
  RESERVE_SENTRY,
  RESERVE_TRADING,
  WITHDRAWAL_FEE_PCT,
} from '../services/institutionalBank.js';

describe('Bank', () => {
  const uniq = Date.now().toString(36).slice(-5);
  const senderUser = `tSend${uniq}`;
  const recipientUser = `tRecv${uniq}`;
  const password = 'SecureComplexPass123!';
  let senderToken = '';
  let recipientId = 0;
  let senderId = 0;
  let debitCardId = 0;
  let creditCardId = 0;

  it('registers sender and recipient', async () => {
    const reg1 = await request(app)
      .post('/v2/auth/register')
      .send({ username: senderUser, password });
    expect(reg1.status).toBe(201);
    senderToken = reg1.body.token;
    senderId = reg1.body.user.userId;

    const reg2 = await request(app)
      .post('/v2/auth/register')
      .send({ username: recipientUser, password });
    expect(reg2.status).toBe(201);
    recipientId = reg2.body.user.userId;
  });

  it('GET /v2/bank/wallet fetches or initializes EUR primary wallet', async () => {
    const res = await request(app)
      .get('/v2/bank/wallet')
      .set('Authorization', `Bearer ${senderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.wallet).toBeDefined();
    expect(res.body.wallet.currency).toBe('EUR');
  });

  it('GET /v2/bank/wallets returns multi-currency accounts with EUR + VLM flags', async () => {
    const res = await request(app)
      .get('/v2/bank/wallets')
      .set('Authorization', `Bearer ${senderToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.wallets)).toBe(true);
    expect(res.body.wallets.length).toBeGreaterThanOrEqual(2);

    const eur = res.body.wallets.find((w: { currency: string }) => w.currency === 'EUR');
    const vlm = res.body.wallets.find((w: { currency: string }) => w.currency === 'VLM');
    expect(eur).toBeDefined();
    expect(eur.isPrimary).toBe(true);
    expect(vlm).toBeDefined();
    expect(vlm.isPlatformNative).toBe(true);
  });

  it('CurrencyConverter applies 3% VLM fee and 4% fiat fee', () => {
    const vlm = currencyConverter.calculateExchange(10_000, 'EUR', 'VLM');
    expect(vlm.feePct).toBe(0.03);
    expect(vlm.netCredited).toBe(vlm.grossConverted - vlm.platformSpread);

    const fiat = currencyConverter.calculateExchange(10_000, 'EUR', 'USD');
    expect(fiat.feePct).toBe(0.04);
  });

  it('institutional reserves exist in EUR', async () => {
    await ensureInstitutionalReservesEur();
    const vcb = await reserveRepository.getReserve(RESERVE_VCB);
    const sb = await reserveRepository.getReserve(RESERVE_SENTRY);
    const trading = await reserveRepository.getReserve(RESERVE_TRADING);
    expect(vcb).toBeTruthy();
    expect(sb).toBeTruthy();
    expect(trading).toBeTruthy();
    expect(vcb!.currency).toBe('EUR');
    expect(sb!.currency).toBe('EUR');
    expect(trading!.currency).toBe('EUR');
  });

  it('POST /v2/bank/convert performs atomic EUR→USD convert with ledger', async () => {
    await db
      .update(wallets)
      .set({ balance: '100.00', updatedAt: new Date() })
      .where(and(eq(wallets.userId, senderId), eq(wallets.currency, 'EUR')));

    const res = await request(app)
      .post('/v2/bank/convert')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ fromCurrency: 'EUR', toCurrency: 'USD', amount: '10.00' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.conversion_id).toMatch(/^exc_/);
    expect(res.body.fee_pct).toBe(0.04);
    expect(res.body.debited).toBe(10);
    expect(res.body.credited).toBeGreaterThan(0);
    expect(Array.isArray(res.body.balances)).toBe(true);
  });

  it('POST /v2/bank/convert rejects insufficient funds', async () => {
    const res = await request(app)
      .post('/v2/bank/convert')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ fromCurrency: 'EUR', toCurrency: 'USD', amount: '999999.00' });

    expect(res.status).toBe(400);
  });

  it('POST /v2/payments/recharge credits EUR from Sentry (debit) and VCB (credit)', async () => {
    await ensureInstitutionalReservesEur();
    await reserveRepository.updateBalance(RESERVE_SENTRY, 50_000_00);
    await reserveRepository.updateBalance(RESERVE_VCB, 50_000_00);

    // cards.user_id is unique — one method row, mutate type between flows
    const card = await cardRepository.createCard({
      userId: senderId,
      cardToken: `tok_debit_${uniq}`,
      cardType: 'DEBIT:TestBank',
      limitCents: 1_000_000,
      isActive: true,
    });
    debitCardId = card.id;
    creditCardId = card.id;

    const sbBefore = (await reserveRepository.getReserve(RESERVE_SENTRY))!.balanceCents;
    const debitRecharge = await request(app)
      .post('/v2/payments/recharge')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ amount_cents: 2500, payment_method_id: `card_${debitCardId}` });

    expect(debitRecharge.status).toBe(200);
    expect(debitRecharge.body.currency).toBe('EUR');
    expect(debitRecharge.body.funded_from).toBe('SENTRY BANK');
    const sbAfter = (await reserveRepository.getReserve(RESERVE_SENTRY))!.balanceCents;
    expect(sbAfter).toBe(sbBefore - 2500);

    await db
      .update(cards)
      .set({ cardType: 'CREDIT:Velum', cardToken: `tok_credit_${uniq}`, updatedAt: new Date() })
      .where(eq(cards.id, card.id));

    const vcbBefore = (await reserveRepository.getReserve(RESERVE_VCB))!.balanceCents;
    const creditRecharge = await request(app)
      .post('/v2/payments/recharge')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ amount_cents: 1500, payment_method_id: `card_${creditCardId}` });

    expect(creditRecharge.status).toBe(200);
    expect(creditRecharge.body.funded_from).toBe('VELUM CENTRAL BANK');
    const vcbAfter = (await reserveRepository.getReserve(RESERVE_VCB))!.balanceCents;
    expect(vcbAfter).toBe(vcbBefore - 1500);

    const eur = await db
      .select()
      .from(wallets)
      .where(and(eq(wallets.userId, senderId), eq(wallets.currency, 'EUR')))
      .limit(1);
    expect(parseFloat(eur[0].balance)).toBeGreaterThanOrEqual(40);
  });

  it('POST /v2/payments/withdraw debits EUR to Sentry retaining 1.5% fee', async () => {
    await db
      .update(wallets)
      .set({ balance: '200.00', updatedAt: new Date() })
      .where(and(eq(wallets.userId, senderId), eq(wallets.currency, 'EUR')));

    const sbBefore = (await reserveRepository.getReserve(RESERVE_SENTRY))!.balanceCents;
    const amountCents = 10_000;
    const feeCents = Math.round(amountCents * WITHDRAWAL_FEE_PCT);

    const res = await request(app)
      .post('/v2/payments/withdraw')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ amount_cents: amountCents, payout_method_id: `card_${debitCardId}` });

    expect(res.status).toBe(200);
    expect(res.body.currency).toBe('EUR');
    expect(res.body.fee_pct).toBe(WITHDRAWAL_FEE_PCT);
    expect(res.body.fee_cents).toBe(feeCents);
    expect(res.body.net_payout_cents).toBe(amountCents - feeCents);

    const sbAfter = (await reserveRepository.getReserve(RESERVE_SENTRY))!.balanceCents;
    expect(sbAfter - sbBefore).toBe(feeCents);

    const eur = await db
      .select()
      .from(wallets)
      .where(and(eq(wallets.userId, senderId), eq(wallets.currency, 'EUR')))
      .limit(1);
    expect(parseFloat(eur[0].balance)).toBe(100);
  });

  it('POST /v2/bank/transfer rejects insufficient funds', async () => {
    const res = await request(app)
      .post('/v2/bank/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        recipientUsername: recipientUser,
        amount: '500000.00',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Insufficient funds for transfer.');
  });

  it('GET /v2/bank/history returns history for primary wallet', async () => {
    const res = await request(app)
      .get('/v2/bank/history')
      .set('Authorization', `Bearer ${senderToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.transactions)).toBe(true);
  });
});
