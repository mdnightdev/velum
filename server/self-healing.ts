/**
 * CLI entry: `npm run heal` / `tsx server/self-healing.ts [--fix|--report]`
 * Default: --fix
 */
import { runHeal } from './v2/services/healRunner.js';

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--report') ? 'report' : 'fix';
  console.log(`[heal] Starting HealRunner mode=${mode}`);
  const report = await runHeal({ mode, triggeredBy: 'cli' });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.status === 'critical' ? 1 : 0);
}

main().catch((err) => {
  console.error('[heal] Failed:', err);
  process.exit(1);
});
