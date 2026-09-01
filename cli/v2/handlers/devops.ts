import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '../../../server/v2/db/client.js';
import { users } from '../../../server/v2/db/schema/users.js';
import { config } from '../../../server/v2/config.js';
import { currencyConverter } from '../../../server/v2/services/currencyConverter.js';
import { stateManager } from '../state/stateManager.js';
import { printTable, printDetail } from '../table.js';
import type { CommandContext } from '../types.js';

export async function handleDevops(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, logAudit } = ctx;

  // Unified SET command: set <param> <value...>
  if (sub === 'set') {
    const [param, ...rest] = rawArgs;
    const target = (param || '').toLowerCase();

    if (target === 'fee' || target === 'tx-fee' || target === 'txfee') {
      const pct = rest[0];
      if (!pct) { console.log('Usage: set fee <percent>'); return; }
      await stateManager.setTxFeePercent(pct);
      console.log(`[OK] Transaction fee set to ${pct}%.`);
      await logAudit('/devops/set', `fee:${pct}`, `Updated transaction fee to ${pct}%`);
      return;
    }

    if (target === 'tax') {
      const pct = rest[0];
      if (!pct) { console.log('Usage: set tax <percent>'); return; }
      await stateManager.setTaxPercent(pct);
      console.log(`[OK] Platform tax set to ${pct}%.`);
      await logAudit('/devops/set', `tax:${pct}`, `Updated platform tax to ${pct}%`);
      return;
    }

    if (target === 'escrow-fee' || target === 'escrowfee' || target === 'escrow') {
      const pct = rest[0];
      if (!pct) { console.log('Usage: set escrow-fee <percent>'); return; }
      await stateManager.setEscrowFeePercent(pct);
      console.log(`[OK] Escrow fee set to ${pct}%.`);
      await logAudit('/devops/set', `escrow-fee:${pct}`, `Updated escrow fee to ${pct}%`);
      return;
    }

    if (target === 'rate') {
      const [base, quote, val] = rest;
      if (!base || !quote || !val) { console.log('Usage: set rate <base_currency> <quote_currency> <rate_value>'); return; }
      const rateValue = parseFloat(val);
      if (isNaN(rateValue) || rateValue <= 0) { console.log('Invalid rate value.'); return; }
      currencyConverter.setRate(base.toUpperCase(), quote.toUpperCase(), rateValue);
      console.log(`[OK] Exchange rate updated: ${base.toUpperCase()}/${quote.toUpperCase()} = ${rateValue}`);
      await logAudit('/devops/set', `rate:${base}/${quote}`, `Set exchange rate ${base}/${quote}=${rateValue}`);
      return;
    }

    if (target === 'maint' || target === 'maintenance') {
      const toggle = rest[0]?.toLowerCase();
      if (toggle === 'on' || toggle === 'enable') {
        if (stateManager.isMaintenanceMode()) {
          const remainingMs = stateManager.getMaintenanceGraceRemainingMs();
          const mins = Math.floor(remainingMs / 60000);
          const secs = Math.ceil((remainingMs % 60000) / 1000);
          console.log(`[Info] Maintenance mode is already active (${mins}m ${secs}s remaining). Active countdown preserved.`);
          return;
        }
        await stateManager.setMaintenanceMode(true);
        console.log('[OK] Maintenance mode enabled (5-minute countdown started).');
        await logAudit('/devops/set', 'maintenance:on', 'Enabled maintenance mode');
      } else if (toggle === 'off' || toggle === 'disable') {
        if (!stateManager.isMaintenanceMode()) {
          console.log('[Info] Maintenance mode is already disabled.');
          return;
        }
        await stateManager.setMaintenanceMode(false);
        console.log('[OK] Maintenance mode disabled.');
        await logAudit('/devops/set', 'maintenance:off', 'Disabled maintenance mode');
      } else {
        console.log('Usage: set maint <on|off>');
      }
      return;
    }

    console.log('Usage: set <fee|tax|escrow-fee|rate|maint> <value...>');
    return;
  }

  // CONFIG / LIST / STATUS command
  if (sub === 'config' || sub === 'ls' || sub === 'flags' || sub === 'status') {
    const target = (rawArgs[0] || '').toLowerCase();

    if (target === 'fee' || target === 'tx-fee') {
      console.log(`Transaction Fee: ${stateManager.getTxFeePercent()}%`);
      return;
    }
    if (target === 'tax') {
      console.log(`Platform Tax: ${stateManager.getTaxPercent()}%`);
      return;
    }
    if (target === 'escrow-fee' || target === 'escrow') {
      console.log(`Escrow Fee: ${stateManager.getEscrowFeePercent()}%`);
      return;
    }
    if (target === 'maint' || target === 'maintenance') {
      console.log(`Maintenance Mode: ${stateManager.isMaintenanceMode() ? 'ENABLED' : 'DISABLED'}`);
      return;
    }
    if (target === 'rates' || target === 'rate') {
      const rates = currencyConverter.getAllRates().map(r => ({ Pair: `${r.baseCurrency}/${r.quoteCurrency}`, Rate: r.rate }));
      printTable(rates);
      return;
    }

    let dbOk = false;
    let dbUserCount = 0;
    try {
      const uRes = await db.select({ count: sql<number>`count(*)` }).from(users);
      dbUserCount = Number(uRes[0]?.count || 0);
      dbOk = true;
    } catch {
      dbOk = false;
    }

    printDetail('DevOps System Configuration', {
      Environment: config.NODE_ENV,
      ServerPort: config.PORT,
      DatabaseStatus: `${dbOk ? 'ONLINE' : 'OFFLINE'} (${dbUserCount} registered accounts)`,
      MaintenanceMode: stateManager.isMaintenanceMode() ? 'ENABLED' : 'DISABLED',
      TransactionFee: `${stateManager.getTxFeePercent()}%`,
      PlatformTax: `${stateManager.getTaxPercent()}%`,
      EscrowFee: `${stateManager.getEscrowFeePercent()}%`
    });

    const rates = currencyConverter.getAllRates().map(r => ({ Pair: `${r.baseCurrency}/${r.quoteCurrency}`, Rate: r.rate }));
    if (rates.length > 0) {
      console.log('Exchange Rates:');
      printTable(rates);
    }
    return;
  }

  if (sub === 'token') {
    const tok = `ADM-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    console.log(`[OK] Generated support code: ${tok}`);
    await logAudit('/devops/token', tok, 'Generated support access token');
    return;
  }

  // Legacy fallback aliases for backward compatibility
  if (sub === 'maint') {
    const toggle = rawArgs[0]?.toLowerCase();
    if (toggle === 'on') {
      if (stateManager.isMaintenanceMode()) {
        const remainingMs = stateManager.getMaintenanceGraceRemainingMs();
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.ceil((remainingMs % 60000) / 1000);
        console.log(`[Info] Maintenance mode is already active (${mins}m ${secs}s remaining). Active countdown preserved.`);
        return;
      }
      await stateManager.setMaintenanceMode(true);
      console.log('[OK] Maintenance mode enabled (5-minute countdown started).');
      await logAudit('/devops/maint', 'SYSTEM', 'Enabled maintenance mode');
    } else if (toggle === 'off') {
      if (!stateManager.isMaintenanceMode()) {
        console.log('[Info] Maintenance mode is already disabled.');
        return;
      }
      await stateManager.setMaintenanceMode(false);
      console.log('[OK] Maintenance mode disabled.');
      await logAudit('/devops/maint', 'SYSTEM', 'Disabled maintenance mode');
    } else {
      console.log('Usage: set maint <on|off>');
    }
    return;
  }

  if (sub === 'fee') {
    const pct = rawArgs[0];
    if (!pct) { console.log('Usage: set fee <percent>'); return; }
    await stateManager.setTxFeePercent(pct);
    console.log(`[OK] Transaction fee set to ${pct}%.`);
    await logAudit('/devops/fee', pct, `Updated transaction fee to ${pct}%`);
    return;
  }

  if (sub === 'tax') {
    const pct = rawArgs[0];
    if (!pct) { console.log('Usage: set tax <percent>'); return; }
    await stateManager.setTaxPercent(pct);
    console.log(`[OK] Transaction tax set to ${pct}%.`);
    await logAudit('/devops/tax', pct, `Updated transaction tax to ${pct}%`);
    return;
  }

  if (sub === 'rate') {
    const [base, quote, val] = rawArgs;
    if (!base || !quote || !val) { console.log('Usage: set rate <base_currency> <quote_currency> <rate_value>'); return; }
    const rateValue = parseFloat(val);
    if (isNaN(rateValue) || rateValue <= 0) { console.log('Invalid rate value.'); return; }
    currencyConverter.setRate(base.toUpperCase(), quote.toUpperCase(), rateValue);
    console.log(`[OK] Exchange rate updated: ${base.toUpperCase()}/${quote.toUpperCase()} = ${rateValue}`);
    await logAudit('/devops/rate', `${base}/${quote}`, `Set exchange rate ${base}/${quote}=${rateValue}`);
    return;
  }

  if (sub === 'escrow-fee') {
    const pct = rawArgs[0];
    if (!pct) { console.log('Usage: set escrow-fee <percent>'); return; }
    await stateManager.setEscrowFeePercent(pct);
    console.log(`[OK] Escrow fee set to ${pct}%.`);
    await logAudit('/devops/escrow-fee', pct, `Updated escrow fee to ${pct}%`);
    return;
  }
}
