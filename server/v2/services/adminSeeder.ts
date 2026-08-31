import crypto from 'node:crypto';
import { db, executeWithRetry } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { exchangeRates } from '../db/schema/exchange_rates.js';
import { reserves } from '../db/schema/reserves.js';
import { eq, sql } from 'drizzle-orm';
import { hashArgon2id, verifyArgon2id } from '../utils/crypto.js';
import { reserveRepository } from '../repositories/reserveRepository.js';

const ADMIN_USERS = [
  {
    id: 1,
    username: 'midnight',
    passwordEnv: 'MIDNIGHT_PASSWORD',
    role: 'CLI_ADMIN',
    displayName: 'Midnight Operator'
  },
  {
    id: 2,
    username: 'lexie',
    passwordEnv: 'LEXIE_PASSWORD',
    role: 'LOGIN_ADMIN',
    displayName: 'Lexie Administrator'
  }
];

let isSeeded = false;

export async function ensureExchangeRatesSeeded() {
  try {
    await executeWithRetry(async () => {
      const rawCurrencies = [
        { code: 'VLM', usdVal: 1.33 },
        { code: 'TWD', usdVal: 0.031 },
        { code: 'USD', usdVal: 1.0 },
        { code: 'EUR', usdVal: 1.08 },
        { code: 'GBP', usdVal: 1.28 },
        { code: 'JPY', usdVal: 0.0062 },
        { code: 'CAD', usdVal: 0.73 },
        { code: 'AUD', usdVal: 0.66 },
        { code: 'CHF', usdVal: 1.11 },
        { code: 'CNY', usdVal: 0.14 },
        { code: 'SGD', usdVal: 0.74 },
        { code: 'HKD', usdVal: 0.13 }
      ];

      const existing = await db.select().from(exchangeRates).limit(1);
      if (existing.length === 0) {
        console.log('[AdminSeeder] Seeding exchange rates database table...');
        const ratesToInsert = [];
        for (const base of rawCurrencies) {
          for (const quote of rawCurrencies) {
            if (base.code !== quote.code) {
              const rateVal = base.usdVal / quote.usdVal;
              ratesToInsert.push({
                baseCurrency: base.code,
                quoteCurrency: quote.code,
                rate: rateVal.toFixed(6)
              });
            }
          }
        }
        await db.insert(exchangeRates).values(ratesToInsert);
        console.log(`[AdminSeeder] Successfully seeded ${ratesToInsert.length} exchange rate pairs.`);
      }
    });
  } catch (err) {
    console.error('[AdminSeeder] Failed to seed exchange rates:', err);
  }
}

export async function ensureReservesSeeded() {
  try {
    await executeWithRetry(async () => {
      const legacyClearing = await reserveRepository.getReserve('CLEARING');
      if (legacyClearing) {
        const vcb = await reserveRepository.getReserve('VELUM CENTRAL BANK');
        if (vcb) {
          await db.update(reserves).set({ balanceCents: legacyClearing.balanceCents }).where(eq(reserves.reserveType, 'VELUM CENTRAL BANK'));
        } else {
          await reserveRepository.updateBalance('VELUM CENTRAL BANK', legacyClearing.balanceCents);
        }
        await db.delete(reserves).where(eq(reserves.reserveType, 'CLEARING'));
      }

      const legacyVcbUnderscore = await reserveRepository.getReserve('VELUM_CENTRAL_BANK');
      if (legacyVcbUnderscore) {
        const vcb = await reserveRepository.getReserve('VELUM CENTRAL BANK');
        if (vcb) {
          await db.update(reserves).set({ balanceCents: legacyVcbUnderscore.balanceCents }).where(eq(reserves.reserveType, 'VELUM CENTRAL BANK'));
        } else {
          await reserveRepository.updateBalance('VELUM CENTRAL BANK', legacyVcbUnderscore.balanceCents);
        }
        await db.delete(reserves).where(eq(reserves.reserveType, 'VELUM_CENTRAL_BANK'));
      }

      const legacyTreasury = await reserveRepository.getReserve('TREASURY');
      if (legacyTreasury) {
        const sentry = await reserveRepository.getReserve('SENTRY BANK');
        if (sentry) {
          await db.update(reserves).set({ balanceCents: legacyTreasury.balanceCents }).where(eq(reserves.reserveType, 'SENTRY BANK'));
        } else {
          await reserveRepository.updateBalance('SENTRY BANK', legacyTreasury.balanceCents);
        }
        await db.delete(reserves).where(eq(reserves.reserveType, 'TREASURY'));
      }

      const legacySentryUnderscore = await reserveRepository.getReserve('SENTRY_BANK');
      if (legacySentryUnderscore) {
        const sentry = await reserveRepository.getReserve('SENTRY BANK');
        if (sentry) {
          await db.update(reserves).set({ balanceCents: legacySentryUnderscore.balanceCents }).where(eq(reserves.reserveType, 'SENTRY BANK'));
        } else {
          await reserveRepository.updateBalance('SENTRY BANK', legacySentryUnderscore.balanceCents);
        }
        await db.delete(reserves).where(eq(reserves.reserveType, 'SENTRY_BANK'));
      }

      const legacyEscrow = await reserveRepository.getReserve('ESCROW');
      if (legacyEscrow) {
        const escrow = await reserveRepository.getReserve('VELUM TRADING ACCOUNT');
        if (escrow) {
          await db.update(reserves).set({ balanceCents: legacyEscrow.balanceCents }).where(eq(reserves.reserveType, 'VELUM TRADING ACCOUNT'));
        } else {
          await reserveRepository.updateBalance('VELUM TRADING ACCOUNT', legacyEscrow.balanceCents);
        }
        await db.delete(reserves).where(eq(reserves.reserveType, 'ESCROW'));
      }

      const legacyEscrowUnderscore = await reserveRepository.getReserve('VELUM_TRADING_ACCOUNT');
      if (legacyEscrowUnderscore) {
        const escrow = await reserveRepository.getReserve('VELUM TRADING ACCOUNT');
        if (escrow) {
          await db.update(reserves).set({ balanceCents: legacyEscrowUnderscore.balanceCents }).where(eq(reserves.reserveType, 'VELUM TRADING ACCOUNT'));
        } else {
          await reserveRepository.updateBalance('VELUM TRADING ACCOUNT', legacyEscrowUnderscore.balanceCents);
        }
        await db.delete(reserves).where(eq(reserves.reserveType, 'VELUM_TRADING_ACCOUNT'));
      }

      const vcb = await reserveRepository.getReserve('VELUM CENTRAL BANK');
      if (!vcb) {
        await reserveRepository.updateBalance('VELUM CENTRAL BANK', 0); 
      }
      const sb = await reserveRepository.getReserve('SENTRY BANK');
      if (!sb) {
        await reserveRepository.updateBalance('SENTRY BANK', 0); 
      }
      const escrow = await reserveRepository.getReserve('VELUM TRADING ACCOUNT');
      if (!escrow) {
        await reserveRepository.updateBalance('VELUM TRADING ACCOUNT', 0);
      }
    });
  } catch (err) {
    console.error('[AdminSeeder] Failed to seed/migrate reserves:', err);
  }
}

export async function ensureAdminSeeded() {
  if (isSeeded) return;
  
  try {
    await executeWithRetry(async () => {
      for (const adminUser of ADMIN_USERS) {
        const password = process.env[adminUser.passwordEnv];
        
        if (!password) {
          console.warn(`[AdminSeeder] Skipping ${adminUser.username}: ${adminUser.passwordEnv} not set in environment`);
          continue;
        }

        // Locate existing admin by exact ID or case-insensitive username or role
        const byId = await db.select().from(users).where(eq(users.id, adminUser.id)).limit(1).then(r => r[0]);
        const byUsername = await db.select().from(users).where(sql`lower(${users.username}) = lower(${adminUser.username})`).limit(1).then(r => r[0]);
        const byRole = await db.select().from(users).where(eq(users.role, adminUser.role)).limit(1).then(r => r[0]);

        const existing = byId || byUsername || byRole;
        
        if (!existing) {
          const salt = crypto.randomBytes(16);
          const saltHex = salt.toString('hex');
          const passwordHash = await hashArgon2id(password, Buffer.from(saltHex, 'hex'));
          
          await db.insert(users).values({
            id: adminUser.id,
            username: adminUser.username,
            passwordHash,
            salt: saltHex,
            role: adminUser.role,
            displayName: adminUser.displayName
          }).onConflictDoNothing();
          
          console.log(`[AdminSeeder] Created admin user: ${adminUser.username} (ID: ${adminUser.id})`);
        } else {
          // Check if password matches stored hash (either env password or rotated credentials)
          const isValidWithEnvPassword = await verifyArgon2id(password, existing.salt, existing.passwordHash);
          
          if (!isValidWithEnvPassword && !existing.passwordHash.startsWith('$argon2id$')) {
            const salt = crypto.randomBytes(16);
            const saltHex = salt.toString('hex');
            const passwordHash = await hashArgon2id(password, Buffer.from(saltHex, 'hex'));
            await db.update(users).set({
              passwordHash,
              salt: saltHex,
              role: adminUser.role
            }).where(eq(users.id, existing.id));
            console.log(`[AdminSeeder] Synchronized password hash for admin user: ${existing.username} (ID: ${existing.id})`);
          } else {
            // Ensure role is consistent
            if (existing.role !== adminUser.role) {
              await db.update(users).set({ role: adminUser.role }).where(eq(users.id, existing.id));
            }
          }
        }
      }

      // Ensure Velum bot (ID 999) exists
      const botUser = await db.select().from(users).where(eq(users.id, 999)).limit(1);
      if (botUser.length === 0) {
        await db.insert(users).values({
          id: 999,
          username: 'velum',
          passwordHash: 'system_bot_no_login',
          salt: 'system_bot_salt',
          role: 'ADMIN',
          displayName: 'Velum Bot'
        }).onConflictDoNothing();
        console.log('[AdminSeeder] Seeded Velum Bot user (ID: 999)');
      }

      // Advance sequence past reserved system IDs
      await db.execute(sql`
        SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM users), 1000), true);
      `);
    });
    
    // Seed exchange rates table
    await ensureExchangeRatesSeeded();

    // Seed system reserves table
    await ensureReservesSeeded();
    
    isSeeded = true;
  } catch (err) {
    console.error('[AdminSeeder] Seeding error:', err);
  }
}
