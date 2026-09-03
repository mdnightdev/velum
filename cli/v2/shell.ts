import readline from 'readline';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../../server/v2/db/client.js';
import { auditLogs } from '../../server/v2/db/schema/audit_logs.js';
import { users } from '../../server/v2/db/schema/users.js';
import { wallets, transactions } from '../../server/v2/db/schema/wallets.js';
import { tickets } from '../../server/v2/db/schema/tickets.js';
import { cards } from '../../server/v2/db/schema/cards.js';
import { listings } from '../../server/v2/db/schema/marketplace.js';
import { lounges } from '../../server/v2/db/schema/lounges.js';
import { userRepository } from '../../server/v2/repositories/userRepository.js';
import { V2_COMMAND_REGISTRY } from './registry.js';
import { theme, riskColor } from './theme.js';
import { printTable, printDetail, printGrid } from './table.js';
import { parseCommandLine, requireArg, requireIntArg } from './parser.js';
import { stateManager } from './state/stateManager.js';
import { HANDLERS } from './handlers/index.js';
import type { CommandContext } from './types.js';

export { theme };

function namespaceMaxRisk(nsPath: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const cmds = V2_COMMAND_REGISTRY[nsPath];
  if (!cmds) return 'LOW';
  let max = 0;
  for (const meta of Object.values(cmds)) {
    max = Math.max(max, order.indexOf(meta.risk));
  }
  return order[max] as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

const REDACTED_FIELDS = new Set([
  'passwordHash',
  'pinHash',
  'passcodeHash',
  'salt',
  'panicPhraseHash',
  'recoveryKeyHash',
  'loginRecoveryKeyHash',
  'recoveryKey',
  'tempRestoreCode',
  'refreshToken',
  'twoFactorSecret',
  'backupCodes',
  'sessionSecret'
]);

const SCHEMA_MAP: Record<string, { table: any; name: string; usernameCol?: any }> = {
  '/users': { table: users, name: 'User', usernameCol: users.username },
  '/bank': { table: wallets, name: 'Wallet' },
  '/tickets': { table: tickets, name: 'Ticket' },
  '/cards': { table: cards, name: 'Card' },
  '/market': { table: listings, name: 'Listing' },
  '/lounges': { table: lounges, name: 'Lounge' },
  '/audits': { table: auditLogs, name: 'AuditLog' }
};

export class VelumV2Shell {
  private currentPath: string = '/';
  private rl: readline.Interface | null = null;

  public async logAudit(action: string, targetId: string, reason: string = 'CLI Action'): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        logId: `al_${crypto.randomUUID().substring(0, 8)}_audit`,
        adminId: 1,
        adminName: 'cli_admin',
        action,
        targetId,
        reason
      });
    } catch (err) {
      console.log(`${theme.red}[WARN] Failed to log audit: ${(err as Error).message}${theme.reset}`);
    }
  }

  public async start(rlInterface: readline.Interface): Promise<void> {
    this.rl = rlInterface;
    await stateManager.initialize();
    this.promptUser();
  }

  private promptUser(): void {
    if (!this.rl) return;

    const promptPath = this.currentPath === '/' ? '~' : `~${this.currentPath}`;
    const promptString = `${theme.boldTeal}velum${theme.boldAmber}:${promptPath}$${theme.reset} `;

    this.rl.question(promptString, async (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return this.promptUser();
      }

      try {
        await this.handleInput(trimmed);
      } catch (err: any) {
        console.log(`${theme.red}[ERROR] ${err.message || err}${theme.reset}`);
      }

      this.promptUser();
    });
  }

  public async resolveUser(idOrUsername: string) {
    const num = parseInt(idOrUsername, 10);
    if (!isNaN(num)) {
      const u = await userRepository.findById(num);
      if (u) return u;
    }
    return userRepository.findByUsername(idOrUsername);
  }

  public async requireUser(rawArgs: string[], usage: string) {
    const target = requireArg(rawArgs, 0, usage);
    if (!target) return null;
    const user = await this.resolveUser(target);
    if (!user) {
      console.log(`User "${target}" not found.`);
      return null;
    }
    return user;
  }

  public getCurrentPath(): string {
    return this.currentPath;
  }

  public getCompletions(line: string): [string[], string] {
    const builtins = ['cd', 'ls', 'cat', 'pwd', 'clear', 'exit', 'quit', 'help', 'man'];
    const parts = line.split(' ');
    const current = parts[parts.length - 1] || '';

    let candidates: string[] = [];

    if (parts.length > 1 && parts[0] === 'man') {
      const allCmds = Object.values(V2_COMMAND_REGISTRY).flatMap((ns) => Object.keys(ns));
      candidates = Array.from(new Set(allCmds));
    } else if (parts.length > 1 && parts[0] === 'cd') {
      candidates = ['..', '/', ...Object.keys(V2_COMMAND_REGISTRY), ...Object.keys(V2_COMMAND_REGISTRY).map((k) => k.slice(1))];
    } else if (this.currentPath === '/') {
      const namespaceNames = Object.keys(V2_COMMAND_REGISTRY).map((k) => k.slice(1));
      candidates = [...builtins, ...Object.keys(V2_COMMAND_REGISTRY), ...namespaceNames];
    } else {
      const cmds = V2_COMMAND_REGISTRY[this.currentPath];
      const namespaceNames = Object.keys(V2_COMMAND_REGISTRY).map((k) => k.slice(1));
      candidates = [...builtins, ...Object.keys(V2_COMMAND_REGISTRY), ...namespaceNames, ...(cmds ? Object.keys(cmds) : [])];
    }

    const hits = candidates.filter((c) => c.startsWith(current));
    return [hits.length ? hits : candidates, current];
  }

  public confirmAction(ns: string, sub: string, risk: 'HIGH' | 'CRITICAL'): Promise<{ confirmed: boolean; reason?: string }> {
    return new Promise((resolve) => {
      if (!this.rl) {
        resolve({ confirmed: false });
        return;
      }

      const promptMsg = `${riskColor(risk)}[${risk} RISK ACTION]${theme.reset} Are you sure you want to execute "${ns}/${sub}"? (y/N): `;
      this.rl.question(promptMsg, (answer) => {
        const confirmed = answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
        if (confirmed) {
          if (risk === 'CRITICAL') {
            this.rl!.question(`${theme.boldAmber}Enter audit reason for CRITICAL override: ${theme.reset}`, (reason) => {
              resolve({ confirmed: true, reason: reason.trim() || 'Manual CLI action' });
            });
          } else {
            resolve({ confirmed: true, reason: 'CLI Override' });
          }
        } else {
          console.log(`Aborted.`);
          resolve({ confirmed: false });
        }
      });
    });
  }

  private async handleInput(line: string): Promise<void> {
    const parsed = parseCommandLine(line);
    if (!parsed) return;
    const { verb: fullCmdRaw, args: rawArgs, flags } = parsed;
    const fullCmd = fullCmdRaw.toLowerCase();

    if (fullCmd === 'exit' || fullCmd === 'quit') {
      console.log('Goodbye.');
      process.exit(0);
    }

    if (fullCmd === 'clear') {
      process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
      return;
    }

    if (fullCmd === 'pwd') {
      console.log(this.currentPath);
      return;
    }

    if (fullCmd === 'help' || fullCmd === '?') {
      console.log(`
  Navigation:
    cd <namespace>    - Change namespace
    ls                - List commands (use "ls -l" for details)
    pwd               - Print current context
    clear             - Clear screen
    exit, quit        - Exit CLI
    help, ?           - Show this help

  Namespaces:
    /users            - User Accounts
    /sanctions        - Moderation
    /tickets          - Support Tickets
    /db               - Database
    /market           - Marketplace
    /escrow           - Escrow
    /devops           - Configurations
    /sys              - System Status
    /bank             - Banking & Ledger
    /cards            - Cards & Limits
    /audits           - Audit Logs
    /fraud            - Fraud Controls
    /lounges          - Channels & Lounges
`);
      return;
    }

    if (fullCmd === 'cat') {
      const target = rawArgs[0];
      if (!target) {
        console.log(`Usage: cat <id_or_username> [--export <json|txt>]`);
        return;
      }

      let targetNs = this.currentPath;
      let targetId = target;

      if (target.startsWith('/')) {
        const parts = target.split('/');
        targetId = parts.pop() || '';
        targetNs = parts.join('/') || '/';
      }

      await this.handleUniversalCat(targetNs, targetId, flags);
      return;
    }

    if (fullCmd === 'cd') {
      let dest = rawArgs[0] || '/';
      if (dest === '..' || dest === '/') {
        if (dest === '..' && this.currentPath !== '/') {
          const segments = this.currentPath.split('/');
          segments.pop();
          this.currentPath = segments.join('/') || '/';
        } else {
          this.currentPath = '/';
        }
        return;
      }
      if (!dest.startsWith('/')) {
        dest = (this.currentPath === '/' ? '' : this.currentPath) + '/' + dest;
      }
      if (V2_COMMAND_REGISTRY[dest]) {
        this.currentPath = dest;
      } else {
        console.log(`Context path "${dest}" not found.`);
      }
      return;
    }

    if (fullCmd === 'ls') {
      const isLong = flags['l'] || flags['long'];

      if (this.currentPath === '/') {
        const namespaces = [
          { name: 'users',    desc: 'User Accounts' },
          { name: 'sanctions',desc: 'Moderation' },
          { name: 'tickets',  desc: 'Support Tickets' },
          { name: 'db',       desc: 'Database' },
          { name: 'market',   desc: 'Marketplace' },
          { name: 'escrow',   desc: 'Escrow' },
          { name: 'devops',   desc: 'Configurations' },
          { name: 'sys',      desc: 'System Status' },
          { name: 'bank',     desc: 'Banking & Ledger' },
          { name: 'cards',    desc: 'Cards & Limits' },
          { name: 'audits',   desc: 'Audit Logs' },
          { name: 'fraud',    desc: 'Fraud Controls' },
          { name: 'lounges',  desc: 'Channels & Lounges' }
        ];

        if (isLong) {
          console.log();
          namespaces.forEach((ns) => {
            const riskLevel = namespaceMaxRisk(`/${ns.name}`);
            const formattedRisk = `${riskColor(riskLevel)}${riskLevel.padEnd(8)}${theme.reset}`;
            console.log(`  ${theme.boldWhite}%-12s${theme.reset}  %s  %s`.replace(/%/g, '%-'), ns.name, formattedRisk, ns.desc);
          });
          console.log();
        } else {
          console.log();
          printGrid(namespaces.map(n => n.name), 5, 14);
          console.log();
        }
      } else {
        const cmds = V2_COMMAND_REGISTRY[this.currentPath];
        if (!cmds) {
          console.log(`Context path "${this.currentPath}" not found.`);
          return;
        }

        if (isLong) {
          console.log();
          for (const [cmd, meta] of Object.entries(cmds)) {
            const syntax = meta.args && meta.args.length > 0 ? `${cmd} ${meta.args.join(' ')}` : cmd;
            const rColor = riskColor(meta.risk);
            console.log(`  ${theme.boldWhite}%-30s${theme.reset}  %s  %s`.replace(/%/g, '%-'), syntax, `${rColor}${meta.risk.padEnd(8)}${theme.reset}`, meta.desc);
          }
          console.log();
        } else {
          console.log();
          printGrid(Object.keys(cmds), 5, 14);
          console.log();
        }
      }
      return;
    }

    let ns = this.currentPath;
    let sub = fullCmd;

    if (fullCmd.startsWith('/')) {
      const parts = fullCmd.split('/');
      sub = parts.pop() || '';
      ns = parts.join('/') || '/';
    } else if (V2_COMMAND_REGISTRY[`/${fullCmd}`]) {
      ns = `/${fullCmd}`;
      sub = rawArgs.shift() || '';
      if (!sub) {
        console.log(`Context changed to ${ns}.`);
        this.currentPath = ns;
        return;
      }
    }

    if (flags['h'] || flags['help']) {
      this.printManPage(ns, sub);
      return;
    }

    const gateMeta = V2_COMMAND_REGISTRY[ns]?.[sub];
    if (gateMeta && (gateMeta.risk === 'HIGH' || gateMeta.risk === 'CRITICAL')) {
      const { confirmed, reason } = await this.confirmAction(ns, sub, gateMeta.risk);
      if (!confirmed) return;
      if (reason) {
        await this.logAudit(`${ns}/${sub}`, 'GATE_CONFIRMED', `Reason: ${reason}`);
      }
    }

    const handler = HANDLERS[ns];
    if (handler) {
      const ctx: CommandContext = {
        ns,
        sub,
        rawArgs,
        flags,
        requireArg,
        requireIntArg,
        requireUser: (args, usage) => this.requireUser(args, usage),
        resolveUser: (id) => this.resolveUser(id),
        logAudit: (act, tgt, rsn) => this.logAudit(act, tgt, rsn),
        confirmAction: (n, s, r) => this.confirmAction(n, s, r)
      };

      await handler(ctx);
      return;
    }

    console.log(`Command "${line}" not recognized in context "${this.currentPath}". Type "ls" or "help".`);
  }

  private async handleUniversalCat(targetNs: string, targetId: string, flags: Record<string, string | boolean>): Promise<void> {
    const ns = targetNs === '/' ? '/users' : targetNs;
    const schema = SCHEMA_MAP[ns];
    if (!schema) {
      console.log(`Namespace "${targetNs}" does not support entity inspection.`);
      return;
    }

    const numId = parseInt(targetId, 10);
    let row: any = null;

    if (!isNaN(numId)) {
      const [r] = await db.select().from(schema.table).where(eq(schema.table.id, numId)).limit(1);
      row = r;
    } else if (schema.usernameCol) {
      const [r] = await db.select().from(schema.table).where(eq(schema.usernameCol, targetId)).limit(1);
      row = r;
    }

    if (!row) {
      console.log(`Record "${targetId}" not found in ${ns}.`);
      return;
    }

    const auditRow: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (REDACTED_FIELDS.has(k)) continue;
      auditRow[k] = v instanceof Date ? v.toISOString().replace('T', ' ').substring(0, 19) : v ?? '-';
    }

    printDetail(`${schema.name} #${row.id ?? targetId}`, auditRow);

    if (flags['export']) {
      const ext = flags['export'] === 'txt' ? 'txt' : 'json';
      const catDir = path.resolve(process.cwd(), 'Cat');
      if (!fs.existsSync(catDir)) fs.mkdirSync(catDir, { recursive: true });
      const file = path.join(catDir, `${schema.name.toLowerCase()}_${row.id ?? targetId}_${Date.now()}.${ext}`);
      fs.writeFileSync(file, ext === 'json' ? JSON.stringify(auditRow, null, 2) : Object.entries(auditRow).map(([k, v]) => `${k}: ${v}`).join('\n'), 'utf-8');
      console.log(`[OK] Saved to Cat/${path.basename(file)}`);
    }
  }

  private printManPage(ns: string, sub: string): void {
    const meta = V2_COMMAND_REGISTRY[ns]?.[sub];
    if (!meta) {
      console.log(`No manual entry for ${ns}/${sub}`);
      return;
    }
    const syntax = meta.args && meta.args.length > 0 ? `${sub} ${meta.args.join(' ')}` : sub;
    console.log(`\nNAME\n  ${ns}/${sub} - ${meta.desc}\n\nSYNOPSIS\n  ${syntax}\n\nRISK\n  ${meta.risk}\n`);
  }
}
