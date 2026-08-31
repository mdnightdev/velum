import { db } from '../../../server/v2/db/client.js';
import { systemConfig } from '../../../server/v2/db/schema/system_config.js';
import { exchangeRates } from '../../../server/v2/db/schema/exchange_rates.js';
import { currencyConverter } from '../../../server/v2/services/currencyConverter.js';
import { logAudit } from '../helpers.js';
import { printDetail } from '../table.js';
import { theme } from '../theme.js';
import { eq } from 'drizzle-orm';

export async function handleDevopsCommand(sub: string, rawArgs: string[]): Promise<void> {
  if (sub === 'status' || sub === 'config') {
    const configs = await db.select().from(systemConfig);
    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    const isMaint = configMap['maintenance_mode'] === 'true' || configMap['maintenance_mode'] === '1';

    printDetail('DevOps Configuration', {
      'Maintenance Mode': isMaint ? 'ACTIVE' : 'DISABLED',
      'Platform Transaction Fee': `${configMap['tx_fee_percent'] || '1.5'}%`,
      'Transaction Tax Rate': `${configMap['tax_percent'] || '0.5'}%`,
      'Escrow Service Fee': `${configMap['escrow_fee_percent'] || '1.0'}%`,
      'Active Node Version': process.version,
      'Memory Usage (RSS)': `${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB`
    });
    return;
  }

  if (sub === 'maintenance' || sub === 'maint') {
    const stateArg = rawArgs[0]?.toLowerCase();
    if (!stateArg || (stateArg !== 'on' && stateArg !== 'off')) {
      console.log('Usage: maintenance <on|off>');
      return;
    }
    const isEnabled = stateArg === 'on';
    const val = isEnabled ? 'true' : 'false';

    await db.insert(systemConfig).values({
      key: 'maintenance_mode',
      value: val,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: val, updatedAt: new Date() }
    });

    console.log(`[OK] Maintenance mode set to: ${isEnabled ? 'ON (Active)' : 'OFF (Disabled)'}.`);
    await logAudit('/devops/maintenance', 'SYSTEM', `Maintenance mode changed to ${stateArg}`);
    return;
  }

  if (sub === 'fee' || sub === 'set-fee') {
    const percentStr = rawArgs[0];
    if (!percentStr || isNaN(parseFloat(percentStr))) {
      console.log('Usage: fee <percent>');
      return;
    }
    const val = parseFloat(percentStr).toFixed(2);
    await db.insert(systemConfig).values({
      key: 'tx_fee_percent',
      value: val,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: val, updatedAt: new Date() }
    });
    console.log(`[OK] Platform transaction fee updated to ${val}%.`);
    await logAudit('/devops/fee', 'SYSTEM', `Transaction fee updated to ${val}%`);
    return;
  }

  if (sub === 'tax' || sub === 'set-tax') {
    const percentStr = rawArgs[0];
    if (!percentStr || isNaN(parseFloat(percentStr))) {
      console.log('Usage: tax <percent>');
      return;
    }
    const val = parseFloat(percentStr).toFixed(2);
    await db.insert(systemConfig).values({
      key: 'tax_percent',
      value: val,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: val, updatedAt: new Date() }
    });
    console.log(`[OK] Platform tax rate updated to ${val}%.`);
    await logAudit('/devops/tax', 'SYSTEM', `Tax rate updated to ${val}%`);
    return;
  }

  if (sub === 'escrow-fee' || sub === 'set-escrow-fee') {
    const percentStr = rawArgs[0];
    if (!percentStr || isNaN(parseFloat(percentStr))) {
      console.log('Usage: escrow-fee <percent>');
      return;
    }
    const val = parseFloat(percentStr).toFixed(2);
    await db.insert(systemConfig).values({
      key: 'escrow_fee_percent',
      value: val,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: val, updatedAt: new Date() }
    });
    console.log(`[OK] Escrow service fee updated to ${val}%.`);
    await logAudit('/devops/escrow-fee', 'SYSTEM', `Escrow fee updated to ${val}%`);
    return;
  }

  if (sub === 'rate' || sub === 'set-rate') {
    const [base, quote, valStr] = rawArgs;
    if (!base || !quote || !valStr) {
      console.log('Usage: rate <BASE_CURRENCY> <QUOTE_CURRENCY> <RATE_VALUE>');
      return;
    }
    const rateVal = parseFloat(valStr);
    if (isNaN(rateVal) || rateVal <= 0) {
      console.log(`[ERROR] Invalid rate value: "${valStr}"`);
      return;
    }

    await currencyConverter.setRate(base.toUpperCase(), quote.toUpperCase(), rateVal);
    console.log(`[OK] Exchange rate updated: 1 ${base.toUpperCase()} = ${rateVal} ${quote.toUpperCase()}`);
    await logAudit('/devops/rate', `${base}/${quote}`, `Rate updated to ${rateVal}`);
    return;
  }

  console.log(`Unknown command: "${sub}"`);
}
