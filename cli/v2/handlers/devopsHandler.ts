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
    const maintRow = await db.select().from(systemConfig).where(eq(systemConfig.key, 'maintenance_mode')).limit(1);
    const isMaint = maintRow[0]?.value === 'true' || maintRow[0]?.value === '1';

    printDetail('DevOps Configuration', {
      'Maintenance Mode': isMaint ? `${theme.red}ACTIVE${theme.reset}` : `${theme.green}DISABLED${theme.reset}`,
      'Platform Transaction Fee': '1.5%',
      'Transaction Tax Rate': '0.5%',
      'Escrow Service Fee': '1.0%',
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

  if (sub === 'rate' || sub === 'set-rate') {
    const [base, quote, valStr] = rawArgs;
    if (!base || !quote || !valStr) {
      console.log('Usage: rate <BASE_CURRENCY> <QUOTE_CURRENCY> <RATE_VALUE>');
      return;
    }
    const rateVal = parseFloat(valStr);
    if (isNaN(rateVal) || rateVal <= 0) {
      console.log(`${theme.red}[ERROR] Invalid rate value: "${valStr}"${theme.reset}`);
      return;
    }

    await currencyConverter.setRate(base.toUpperCase(), quote.toUpperCase(), rateVal);
    console.log(`[OK] Exchange rate updated: 1 ${base.toUpperCase()} = ${rateVal} ${quote.toUpperCase()}`);
    await logAudit('/devops/rate', `${base}/${quote}`, `Rate updated to ${rateVal}`);
    return;
  }

  console.log(`Unknown /devops subcommand: "${sub}". Type "help" or "ls" to view commands.`);
}
