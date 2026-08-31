import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '../../../server/v2/db/client.js';
import { users } from '../../../server/v2/db/schema/users.js';
import { config } from '../../../server/v2/config.js';
import { currencyConverter } from '../../../server/v2/services/currencyConverter.js';
import { stateManager } from '../state/stateManager.js';
import type { CommandContext } from '../types.js';

export async function handleDevops(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, logAudit } = ctx;

  if (sub === 'config') {
    let dbOk = false;
    let dbUserCount = 0;
    try {
      const uRes = await db.select({ count: sql<number>`count(*)` }).from(users);
      dbUserCount = Number(uRes[0]?.count || 0);
      dbOk = true;
    } catch {
      dbOk = false;
    }
    console.log(`NODE_ENV: ${config.NODE_ENV} | PORT: ${config.PORT} | DB: ${dbOk ? 'ONLINE' : 'OFFLINE'} (${dbUserCount} users)`);
    console.log(`Maintenance: ${stateManager.isMaintenanceMode()} | Tx Fee: ${stateManager.getTxFeePercent()}% | Tax: ${stateManager.getTaxPercent()}% | Escrow Fee: ${stateManager.getEscrowFeePercent()}%`);
    const rates = currencyConverter.getAllRates().map(r => ({ [`${r.baseCurrency}/${r.quoteCurrency}`]: r.rate }));
    console.log(`Exchange Rates: ${JSON.stringify(rates)}`);
    return;
  }

  if (sub === 'flags') {
    console.log(`Maintenance Mode: ${stateManager.isMaintenanceMode() ? 'ENABLED' : 'DISABLED'}`);
    console.log(`Tx Fee: ${stateManager.getTxFeePercent()}%`);
    console.log(`Tax: ${stateManager.getTaxPercent()}%`);
    console.log(`Escrow Fee: ${stateManager.getEscrowFeePercent()}%`);
    return;
  }

  if (sub === 'token') {
    const tok = `ADM-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    console.log(`[OK] Generated support code: ${tok}`);
    await logAudit('/devops/token', tok, 'Generated support access token');
    return;
  }

  if (sub === 'maint') {
    const toggle = rawArgs[0]?.toLowerCase();
    if (toggle === 'on') {
      await stateManager.setMaintenanceMode(true);
      console.log('[OK] Maintenance mode enabled.');
      await logAudit('/devops/maint', 'SYSTEM', 'Enabled maintenance mode');
    } else if (toggle === 'off') {
      await stateManager.setMaintenanceMode(false);
      console.log('[OK] Maintenance mode disabled.');
      await logAudit('/devops/maint', 'SYSTEM', 'Disabled maintenance mode');
    } else {
      console.log('Usage: maint <on|off>');
    }
    return;
  }

  if (sub === 'fee') {
    const pct = rawArgs[0];
    if (!pct) { console.log('Usage: fee <percent>'); return; }
    await stateManager.setTxFeePercent(pct);
    console.log(`[OK] Transaction fee set to ${pct}%.`);
    await logAudit('/devops/fee', pct, `Updated transaction fee to ${pct}%`);
    return;
  }

  if (sub === 'tax') {
    const pct = rawArgs[0];
    if (!pct) { console.log('Usage: tax <percent>'); return; }
    await stateManager.setTaxPercent(pct);
    console.log(`[OK] Transaction tax set to ${pct}%.`);
    await logAudit('/devops/tax', pct, `Updated transaction tax to ${pct}%`);
    return;
  }

  if (sub === 'rate') {
    const [base, quote, val] = rawArgs;
    if (!base || !quote || !val) { console.log('Usage: rate <base_currency> <quote_currency> <rate_value>'); return; }
    const rateValue = parseFloat(val);
    if (isNaN(rateValue) || rateValue <= 0) { console.log('Invalid rate value.'); return; }
    
    currencyConverter.setRate(base.toUpperCase(), quote.toUpperCase(), rateValue);
    console.log(`[OK] Exchange rate updated: ${base.toUpperCase()}/${quote.toUpperCase()} = ${rateValue}`);
    await logAudit('/devops/rate', `${base}/${quote}`, `Set exchange rate ${base}/${quote}=${rateValue}`);
    return;
  }

  if (sub === 'escrow-fee') {
    const pct = rawArgs[0];
    if (!pct) { console.log('Usage: escrow-fee <percent>'); return; }
    await stateManager.setEscrowFeePercent(pct);
    console.log(`[OK] Escrow fee set to ${pct}%.`);
    await logAudit('/devops/escrow-fee', pct, `Updated escrow fee to ${pct}%`);
    return;
  }
}
