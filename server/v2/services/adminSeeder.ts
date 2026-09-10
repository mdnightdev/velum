import crypto from 'node:crypto';
import { db, executeWithRetry } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { exchangeRates } from '../db/schema/exchange_rates.js';
import { reserves } from '../db/schema/reserves.js';
import { eq, sql } from 'drizzle-orm';
import { hashArgon2id } from '../utils/crypto.js';
import { reserveRepository } from '../repositories/reserveRepository.js';
import { logger } from '../utils/logger.js';
import { userRepository } from '../repositories/userRepository.js';
import { MIN_PUBLIC_USER_ID } from '../constants/systemIds.js';

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
        { code: 'VLM', usdVal: 1.33 }, // Pegged at EUR + 0.25 (EUR is 1.08)
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
        logger.info('[AdminSeeder] Seeding exchange rates database table...');
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
        logger.info(`[AdminSeeder] Successfully seeded ${ratesToInsert.length} exchange rate pairs.`);
      }
    });
  } catch (err) {
    logger.error('[AdminSeeder] Failed to seed exchange rates:', err);
  }
}

export async function ensureReservesSeeded() {
  try {
    await executeWithRetry(async () => {
      // 1. Check for legacy reserve rows to migrate and clean up
      const legacyClearing = await reserveRepository.getReserve('CLEARING');
      if (legacyClearing) {
        console.log(`[AdminSeeder] Migrating balance from legacy CLEARING (${legacyClearing.balanceCents} cents) to Main Account...`);
        const vcb = await reserveRepository.getReserve('Main Account');
        if (vcb) {
          await db.update(reserves).set({ balanceCents: legacyClearing.balanceCents }).where(eq(reserves.reserveType, 'Main Account'));
        } else {
          await reserveRepository.updateBalance('Main Account', legacyClearing.balanceCents);
        }
        await db.delete(reserves).where(eq(reserves.reserveType, 'CLEARING'));
      }

      const legacyVcbUnderscore = await reserveRepository.getReserve('VELUM_CENTRAL_BANK');
      if (legacyVcbUnderscore) {
        console.log(`[AdminSeeder] Migrating balance from legacy VELUM_CENTRAL_BANK (${legacyVcbUnderscore.balanceCents} cents) to Main Account...`);
        const vcb = await reserveRepository.getReserve('Main Account');
        if (vcb) {
          await db.update(reserves).set({ balanceCents: legacyVcbUnderscore.balanceCents }).where(eq(reserves.reserveType, 'Main Account'));
        } else {
          await reserveRepository.updateBalance('Main Account', legacyVcbUnderscore.balanceCents);
        }
        await db.delete(reserves).where(eq(reserves.reserveType, 'VELUM_CENTRAL_BANK'));
      }

      const legacyTreasury = await reserveRepository.getReserve('TREASURY');
      if (legacyTreasury) {
        console.log(`[AdminSeeder] Migrating balance from legacy TREASURY (${legacyTreasury.balanceCents} cents) to Reserve Account...`);
        const sb = await reserveRepository.getReserve('Reserve Account');
        if (sb) {
          await db.update(reserves).set({ balanceCents: legacyTreasury.balanceCents }).where(eq(reserves.reserveType, 'Reserve Account'));
        } else {
          await reserveRepository.updateBalance('Reserve Account', legacyTreasury.balanceCents);
        }
        await db.delete(reserves).where(eq(reserves.reserveType, 'TREASURY'));
      }

      const legacySbUnderscore = await reserveRepository.getReserve('SENTRY_BANK');
      if (legacySbUnderscore) {
        console.log(`[AdminSeeder] Migrating balance from legacy SENTRY_BANK (${legacySbUnderscore.balanceCents} cents) to Reserve Account...`);
        const sb = await reserveRepository.getReserve('Reserve Account');
        if (sb) {
          await db.update(reserves).set({ balanceCents: legacySbUnderscore.balanceCents }).where(eq(reserves.reserveType, 'Reserve Account'));
        } else {
          await reserveRepository.updateBalance('Reserve Account', legacySbUnderscore.balanceCents);
        }
        await db.delete(reserves).where(eq(reserves.reserveType, 'SENTRY_BANK'));
      }

      const legacyEscrow = await reserveRepository.getReserve('ESCROW');
      if (legacyEscrow) {
        console.log(`[AdminSeeder] Migrating balance from legacy ESCROW (${legacyEscrow.balanceCents} cents) to Trading Account...`);
        const escrow = await reserveRepository.getReserve('Trading Account');
        if (escrow) {
          await db.update(reserves).set({ balanceCents: legacyEscrow.balanceCents }).where(eq(reserves.reserveType, 'Trading Account'));
        } else {
          await reserveRepository.updateBalance('Trading Account', legacyEscrow.balanceCents);
        }
        await db.delete(reserves).where(eq(reserves.reserveType, 'ESCROW'));
      }

      const legacyEscrowUnderscore = await reserveRepository.getReserve('VELUM_TRADING_ACCOUNT');
      if (legacyEscrowUnderscore) {
        console.log(`[AdminSeeder] Migrating balance from legacy VELUM_TRADING_ACCOUNT (${legacyEscrowUnderscore.balanceCents} cents) to Trading Account...`);
        const escrow = await reserveRepository.getReserve('Trading Account');
        if (escrow) {
          await db.update(reserves).set({ balanceCents: legacyEscrowUnderscore.balanceCents }).where(eq(reserves.reserveType, 'Trading Account'));
        } else {
          await reserveRepository.updateBalance('Trading Account', legacyEscrowUnderscore.balanceCents);
        }
        await db.delete(reserves).where(eq(reserves.reserveType, 'VELUM_TRADING_ACCOUNT'));
      }

      // 2. Ensure standard V2 reserve rows exist with default balances if not migrated
      const vcb = await reserveRepository.getReserve('Main Account');
      if (!vcb) {
        await reserveRepository.updateBalance('Main Account', 0);
        logger.info('[AdminSeeder] Seeded default central bank reserve: Main Account ($0.00)');
      }
      const sb = await reserveRepository.getReserve('Reserve Account');
      if (!sb) {
        await reserveRepository.updateBalance('Reserve Account', 0);
        logger.info('[AdminSeeder] Seeded default sentry bank reserve: Reserve Account ($0.00)');
      }
      const escrow = await reserveRepository.getReserve('Trading Account');
      if (!escrow) {
        await reserveRepository.updateBalance('Trading Account', 0);
        logger.info('[AdminSeeder] Seeded default escrow reserve: Trading Account ($0.00)');
      }
    });
  } catch (err) {
    logger.error('[AdminSeeder] Failed to seed/migrate reserves:', err);
  }
}

export async function ensureAdminSeeded() {
  if (isSeeded) return;
  
  try {
    await executeWithRetry(async () => {
      for (const adminUser of ADMIN_USERS) {
        const password = process.env[adminUser.passwordEnv];
        
        if (!password) {
          logger.warn(`[AdminSeeder] Skipping ${adminUser.username}: ${adminUser.passwordEnv} not set in environment`);
          continue;
        }

        const existingById = await db.select().from(users).where(eq(users.id, adminUser.id)).limit(1).then(r => r[0]);
        const existingByName = await db.select().from(users).where(eq(users.username, adminUser.username)).limit(1).then(r => r[0]);

        // Reclaim reserved ID if a non-system account squatted on it.
        if (
          existingById &&
          existingById.username.toLowerCase() !== adminUser.username.toLowerCase()
        ) {
          logger.warn(
            `[AdminSeeder] Reclaiming reserved ID ${adminUser.id} from squatter "${existingById.username}"`
          );
          await userRepository.purgeUserCompletely(
            existingById.id,
            `RECLAIM_SYSTEM_ID_${adminUser.id}`
          );
        }

        // If the correct username exists on a non-reserved ID, purge the duplicate so we can seed the locked ID.
        const nameAfterReclaim = await db
          .select()
          .from(users)
          .where(eq(users.username, adminUser.username))
          .limit(1)
          .then((r) => r[0]);
        if (nameAfterReclaim && nameAfterReclaim.id !== adminUser.id) {
          logger.warn(
            `[AdminSeeder] Moving "${adminUser.username}" from ID ${nameAfterReclaim.id} onto locked ID ${adminUser.id}`
          );
          await userRepository.purgeUserCompletely(
            nameAfterReclaim.id,
            `RELOCATE_TO_SYSTEM_ID_${adminUser.id}`
          );
        }

        const existing = await db
          .select()
          .from(users)
          .where(eq(users.id, adminUser.id))
          .limit(1)
          .then((r) => r[0]);
        
        if (!existing) {
          const salt = crypto.randomBytes(16);
          const saltHex = salt.toString('hex');
          const passwordHash = await hashArgon2id(password, Buffer.from(saltHex, 'hex'));
          
          await userRepository.create(
            {
              id: adminUser.id,
              username: adminUser.username,
              passwordHash,
              salt: saltHex,
              role: adminUser.role,
              displayName: adminUser.displayName
            },
            { allowSystemId: true }
          );
          
          logger.info(`[AdminSeeder] Created admin user: ${adminUser.username} (ID: ${adminUser.id})`);
        } else {
          // Check if password needs update by re-hashing with existing salt
          const passwordHash = await hashArgon2id(password, Buffer.from(existing.salt, 'hex'));
          
          if (passwordHash !== existing.passwordHash) {
            await db.update(users).set({ passwordHash }).where(eq(users.id, existing.id));
            logger.info(`[AdminSeeder] Updated password for admin user: ${existing.username} (ID: ${existing.id})`);
          } else {
            logger.info(`[AdminSeeder] Admin user already exists and password is current: ${existing.username} (ID: ${existing.id})`);
          }
        }
      }

      // Ensure Velum bot (ID 999) exists on the locked slot
      const botUser = await db.select().from(users).where(eq(users.id, 999)).limit(1).then(r => r[0]);
      if (botUser && botUser.username.toLowerCase() !== 'velum') {
        logger.warn(`[AdminSeeder] Reclaiming reserved ID 999 from squatter "${botUser.username}"`);
        await userRepository.purgeUserCompletely(botUser.id, 'RECLAIM_SYSTEM_ID_999');
      }
      const botAfter = await db.select().from(users).where(eq(users.id, 999)).limit(1).then(r => r[0]);
      if (!botAfter) {
        await userRepository.create(
          {
            id: 999,
            username: 'velum',
            passwordHash: 'system_bot_no_login',
            salt: 'system_bot_salt',
            role: 'ADMIN',
            displayName: 'Velum Bot'
          },
          { allowSystemId: true }
        );
        logger.info('[AdminSeeder] Seeded Velum Bot user (ID: 999)');
      }

      // Advance sequence past reserved system IDs so regular registrations start at 1000+
      await db.execute(sql`
        SELECT setval(
          pg_get_serial_sequence('users', 'id'),
          GREATEST((SELECT COALESCE(MAX(id), 1) FROM users), ${MIN_PUBLIC_USER_ID}),
          true
        );
      `);
    });
    
    // Seed exchange rates table
    await ensureExchangeRatesSeeded();

    // Seed system reserves table
    await ensureReservesSeeded();
    
    isSeeded = true;
  } catch (err) {
    logger.error('[AdminSeeder] Seeding error:', err);
  }
}
