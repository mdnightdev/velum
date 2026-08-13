import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db/client.js';
import { users, wallets, transactions, listings, escrows, sessions } from '../db/schema/index.js';
import { hashArgon2id } from '../utils/crypto.js';
import crypto from 'node:crypto';

export const testRouter = Router();

testRouter.use((_req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Test endpoints disabled in production environment.' });
    return;
  }
  next();
});

testRouter.post('/reset', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await db.delete(escrows);
    await db.delete(transactions);
    await db.delete(listings);
    await db.delete(wallets);
    await db.delete(sessions);
    await db.delete(users);

    res.json({ message: 'Test database reset successful.', timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

testRouter.post('/seed', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const saltA = crypto.randomBytes(16);
    const passHashA = await hashArgon2id('Password123!', saltA);

    const [userA] = await db
      .insert(users)
      .values({
        username: 'test_user_a',
        passwordHash: passHashA,
        salt: saltA.toString('hex'),
        role: 'USER',
        duressActive: false
      })
      .returning();

    const saltB = crypto.randomBytes(16);
    const passHashB = await hashArgon2id('Password123!', saltB);

    const [userB] = await db
      .insert(users)
      .values({
        username: 'test_user_b',
        passwordHash: passHashB,
        salt: saltB.toString('hex'),
        role: 'USER',
        duressActive: false
      })
      .returning();

    const saltAdmin = crypto.randomBytes(16);
    const passHashAdmin = await hashArgon2id('AdminPassword123!', saltAdmin);

    const [adminUser] = await db
      .insert(users)
      .values({
        username: 'test_admin',
        passwordHash: passHashAdmin,
        salt: saltAdmin.toString('hex'),
        role: 'ADMIN',
        duressActive: false
      })
      .returning();

    await db.insert(wallets).values([
      {
        userId: userA.id,
        currency: 'USD',
        balance: '1000.00'
      },
      {
        userId: userB.id,
        currency: 'USD',
        balance: '500.00'
      }
    ]);

    res.json({
      message: 'Test database seeded successfully.',
      users: [
        { userId: userA.id, username: userA.username },
        { userId: userB.id, username: userB.username },
        { userId: adminUser.id, username: adminUser.username }
      ]
    });
  } catch (error) {
    next(error);
  }
});
