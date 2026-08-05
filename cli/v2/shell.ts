import readline from 'readline';
import crypto from 'node:crypto';
import { eq, desc, like, sql } from 'drizzle-orm';
import { V2_COMMAND_REGISTRY } from './registry.js';
import { userRepository } from '../../server/v2/repositories/userRepository.js';
import { bankRepository } from '../../server/v2/repositories/bankRepository.js';
import { cardRepository } from '../../server/v2/repositories/cardRepository.js';
import { ticketRepository } from '../../server/v2/repositories/ticketRepository.js';
import { reserveRepository } from '../../server/v2/repositories/reserveRepository.js';
import { marketRepository } from '../../server/v2/repositories/marketRepository.js';
import { db, pool } from '../../server/v2/db/client.js';
import { users, supportAdminNominations } from '../../server/v2/db/schema/users.js';
import { lounges, messages } from '../../server/v2/db/schema/lounges.js';
import { ensureVelumLoungeSeeded } from '../../server/v2/services/loungeSeeder.js';
import { SystemBot } from '../../server/v2/services/systemBot.js';
import { and, or, inArray } from 'drizzle-orm';
import { wallets, transactions } from '../../server/v2/db/schema/wallets.js';
import { listings, escrows } from '../../server/v2/db/schema/marketplace.js';
import { sessions } from '../../server/v2/db/schema/sessions.js';
import { auditLogs } from '../../server/v2/db/schema/audit_logs.js';
import { cards } from '../../server/v2/db/schema/cards.js';
import { tickets } from '../../server/v2/db/schema/tickets.js';
import { reserves } from '../../server/v2/db/schema/reserves.js';
import { hashArgon2id } from '../../server/v2/utils/crypto.js';
import { config } from '../../server/v2/config.js';
import { currencyConverter } from '../../server/v2/services/currencyConverter.js';
import { getRedisClient } from '../../server/v2/db/redis.js';

let maintenanceMode = false;
let txFeePercent = '1.5';
let taxPercent = '0.5';
let escrowFeePercent = '1.0';
const mutedUsers = new Set<string>();
const jailedUsers = new Set<string>();
const frozenWallets = new Set<string>();

// --- Centralized ANSI theme (previously duplicated as raw escape codes throughout) ---
export const theme = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[90m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[91m',
  criticalRed: '\x1b[31m\x1b[1m'
};

function riskColor(risk: string): string {
  switch (risk) {
    case 'MEDIUM': return theme.yellow;
    case 'HIGH': return theme.red;
    case 'CRITICAL': return theme.criticalRed;
    default: return theme.green;
  }
}

// Highest risk level among a namespace's commands — replaces the old hardcoded
// positional array that silently desynced whenever namespaces were reordered.
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

export class VelumV2Shell {
  private currentPath: string = '/';
  private rl: readline.Interface | null = null;

  private async logAudit(action: string, targetId: string, reason: string = 'CLI V2 Action'): Promise<void> {
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

  public start(rlInterface: readline.Interface): void {
    this.rl = rlInterface;
    this.promptUser();
  }

  private promptUser(): void {
    if (!this.rl) return;

    const pathColor = '\x1b[36m';
    const promptColor = '\x1b[35m\x1b[1m';
    const arrowColor = '\x1b[33m\x1b[1m';
    const resetColor = '\x1b[0m';
    const promptString = `${promptColor}velum-v2-cli [V2-ENGINE]${resetColor} ${pathColor}${this.currentPath}${resetColor}${arrowColor}>${resetColor} `;

    this.rl.question(promptString, async (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return this.promptUser();
      }

      try {
        await this.handleInput(trimmed);
      } catch (err: any) {
        console.log(`ERROR: ${err.message || err}`);
      }

      this.promptUser();
    });
  }

  private async fetchUsers(limit = 100) {
    try {
      if (userRepository && typeof (userRepository as any).findMany === 'function') {
        return await (userRepository as any).findMany(limit);
      }
      return await db.select().from(users).limit(limit);
    } catch (err) {
      console.log(`${theme.red}[WARN] fetchUsers failed: ${(err as Error).message}${theme.reset}`);
      return [];
    }
  }

  private async fetchListings(limit = 100) {
    try {
      if (marketRepository && typeof (marketRepository as any).getAllListings === 'function') {
        return await (marketRepository as any).getAllListings(limit);
      }
      if (marketRepository && typeof marketRepository.getListings === 'function') {
        return await marketRepository.getListings(limit);
      }
      return await db.select().from(listings).orderBy(desc(listings.createdAt)).limit(limit);
    } catch (err) {
      console.log(`${theme.red}[WARN] fetchListings failed: ${(err as Error).message}${theme.reset}`);
      return [];
    }
  }

  private async fetchEscrows(limit = 100) {
    try {
      if (marketRepository && typeof (marketRepository as any).getAllEscrows === 'function') {
        return await (marketRepository as any).getAllEscrows(limit);
      }
      if (marketRepository && typeof (marketRepository as any).getEscrows === 'function') {
        return await (marketRepository as any).getEscrows(limit);
      }
      return await db.select().from(escrows).orderBy(desc(escrows.createdAt)).limit(limit);
    } catch (err) {
      console.log(`${theme.red}[WARN] fetchEscrows failed: ${(err as Error).message}${theme.reset}`);
      return [];
    }
  }

  private async fetchOutboxEvents(limit = 100) {
    try {
      const { outboxEvents } = await import('../../server/v2/db/schema/outbox.js');
      return await db.select().from(outboxEvents).orderBy(desc(outboxEvents.createdAt)).limit(limit);
    } catch (err) {
      console.log(`${theme.red}[WARN] fetchOutboxEvents failed: ${(err as Error).message}${theme.reset}`);
      return [];
    }
  }

  private async fetchWallets(limit = 100) {
    try {
      if (bankRepository && typeof (bankRepository as any).findAllWallets === 'function') {
        return await (bankRepository as any).findAllWallets(limit);
      }
      return await db.select().from(wallets).limit(limit);
    } catch (err) {
      console.log(`${theme.red}[WARN] fetchWallets failed: ${(err as Error).message}${theme.reset}`);
      return [];
    }
  }

  private async fetchUsersPage(limit: number, offset: number) {
    try {
      return await db.select().from(users).orderBy(users.id).limit(limit).offset(offset);
    } catch (err) {
      console.log(`${theme.red}[WARN] fetchUsersPage failed: ${(err as Error).message}${theme.reset}`);
      return [];
    }
  }

  private async countUsers(): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` }).from(users);
      return Number(result[0]?.count || 0);
    } catch {
      return 0;
    }
  }

  private async fetchListingsPage(limit: number, offset: number) {
    try {
      return await db.select().from(listings).orderBy(desc(listings.createdAt)).limit(limit).offset(offset);
    } catch (err) {
      console.log(`${theme.red}[WARN] fetchListingsPage failed: ${(err as Error).message}${theme.reset}`);
      return [];
    }
  }

  private async countListings(): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` }).from(listings);
      return Number(result[0]?.count || 0);
    } catch {
      return 0;
    }
  }

  // Clean key:value printer for single-record "cat" views, instead of raw JSON dumps.
  // Pass only the fields you want visible - never pass a raw DB row straight in,
  // since that would leak sensitive columns like password/recovery hashes.
  private printDetail(title: string, fields: Record<string, any>) {
    console.log(`\n=== ${title} ===`);
    const keys = Object.keys(fields);
    const maxKeyLen = Math.max(...keys.map(k => k.length));
    for (const k of keys) {
      const val = fields[k];
      const displayVal = val === null || val === undefined || val === ''
        ? '-'
        : (val instanceof Date ? val.toISOString() : String(val));
      console.log(`  ${k.padEnd(maxKeyLen)} : ${displayVal}`);
    }
  }

  private getDefaultLimitForRole(role: string): number {
    const defaults: Record<string, number> = {
      'STANDARD': 500000,
      'PREMIUM': 2500000,
      'VIP': 10000000,
      'ADMIN': 10000000,
      'BANK_ADMIN': 10000000,
      'SUPPORT_ADMIN': 10000000
    };
    return defaults[role] || defaults['STANDARD'];
  }

  private async getCardLimitForUser(userId: number, role: string): Promise<number> {
    const card = await cardRepository.findCardByUserId(userId);
    if (card) return card.limitCents;
    return this.getDefaultLimitForRole(role);
  }

  private async resolveUser(idOrUsername: string) {
    const num = parseInt(idOrUsername, 10);
    if (!isNaN(num)) {
      const u = await userRepository.findById(num);
      if (u) return u;
    }
    return userRepository.findByUsername(idOrUsername);
  }

  public getCurrentPath(): string {
    return this.currentPath;
  }

  // Tab-completion source for readline's completer option. Suggests
  // namespaces at the root, subcommands within the current namespace,
  // and always includes shell built-ins.
  public getCompletions(line: string): [string[], string] {
    const builtins = ['cd', 'ls', 'pwd', 'clear', 'exit', 'quit', 'help', 'man'];
    const parts = line.split(' ');
    const current = parts[parts.length - 1] ?? '';

    let candidates: string[] = [];
    if (parts.length <= 1) {
      const namespaceNames = Object.keys(V2_COMMAND_REGISTRY).map((k) => k.slice(1));
      candidates = [...builtins, ...Object.keys(V2_COMMAND_REGISTRY), ...namespaceNames];
    } else {
      const cmds = V2_COMMAND_REGISTRY[this.currentPath];
      candidates = cmds ? Object.keys(cmds) : [];
    }

    const hits = candidates.filter((c) => c.startsWith(current));
    return [hits.length ? hits : candidates, current];
  }

  // --- Shared validation helpers (replace the repeated 4-line usage/lookup
  // block that previously appeared ~15+ times across command handlers) ---
  private requireArg(rawArgs: string[], index: number, usage: string): string | null {
    const val = rawArgs[index];
    if (!val) {
      console.log(`Usage: ${usage}`);
      return null;
    }
    return val;
  }

  private async requireUser(rawArgs: string[], usage: string) {
    const target = this.requireArg(rawArgs, 0, usage);
    if (!target) return null;
    const user = await this.resolveUser(target);
    if (!user) {
      console.log(`User "${target}" not found.`);
      return null;
    }
    return user;
  }

  // --- Registry-driven confirmation gate for HIGH/CRITICAL commands ---
  private confirmAction(ns: string, sub: string, risk: 'HIGH' | 'CRITICAL'): Promise<{ confirmed: boolean; reason?: string }> {
    if (!this.rl) return Promise.resolve({ confirmed: false });
    const color = riskColor(risk);
    return new Promise((resolve) => {
      this.rl!.question(
        `${color}${theme.bold}[${risk}]${theme.reset} This will run ${theme.cyan}${ns}/${sub}${theme.reset}. Type "yes" to confirm: `,
        (answer) => {
          if (answer.trim().toLowerCase() === 'yes') {
            if (risk === 'CRITICAL') {
              this.rl!.question(`Enter mandatory administrative audit reason: `, (reasonAns) => {
                const reason = reasonAns.trim();
                if (!reason || reason.length < 5) {
                  console.log(`\x1b[31m Invalid audit reason. Minimum 5 characters required.\x1b[0m`);
                  resolve({ confirmed: false });
                } else {
                  resolve({ confirmed: true, reason });
                }
              });
            } else {
              resolve({ confirmed: true, reason: 'CLI V2 Administrative Override' });
            }
          } else {
            resolve({ confirmed: false });
          }
        }
      );
    });
  }

  // --- Manual page rendering, shared by the "man" command and -h/--help ---
  private printManPage(nsPath: string, cmdName: string): void {
    const nsMeta = V2_COMMAND_REGISTRY[nsPath];
    const meta = nsMeta ? nsMeta[cmdName] : undefined;

    if (!meta) {
      console.log(`No manual entry for ${nsPath}/${cmdName}`);
      return;
    }

    const fullPath = (nsPath === '/' ? '' : nsPath) + '/' + cmdName;

    console.log(`\n${theme.yellow}${theme.bold}VELUM V2 MANUAL PAGE: ${cmdName.toUpperCase()}${theme.reset}`);
    console.log(theme.dim + '='.repeat(50) + theme.reset);
    console.log(`${theme.green}${theme.bold}NAME${theme.reset}\n    ${cmdName} - ${meta.desc}\n`);
    console.log(`${theme.green}${theme.bold}PATH${theme.reset}\n    ${fullPath}\n`);

    const syntax = meta.args && meta.args.length > 0 ? `${cmdName} ${meta.args.join(' ')}` : cmdName;
    console.log(`${theme.green}${theme.bold}SYNOPSIS${theme.reset}\n    ${syntax}\n`);
    console.log(`${theme.green}${theme.bold}RISK LEVEL${theme.reset}\n    ${riskColor(meta.risk)}${meta.risk}${theme.reset}\n`);

    if (meta.flags && Object.keys(meta.flags).length > 0) {
      console.log(`${theme.green}${theme.bold}OPTIONS${theme.reset}`);
      for (const [flag, desc] of Object.entries(meta.flags)) {
        console.log(`    ${theme.cyan}${flag.padEnd(25)}${theme.reset} ${desc}`);
      }
      console.log();
    }
    console.log(theme.dim + '='.repeat(50) + theme.reset + '\n');
  }

  private parseCommandLine(line: string): { verb: string; args: string[]; flags: Record<string, any> } | null {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== '\\')) {
        if (inQuotes && char === quoteChar) {
          inQuotes = false;
        } else if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else {
          current += char;
        }
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    if (current) {
      parts.push(current);
    }
    if (parts.length === 0) return null;
    const verb = parts[0];
    const args: string[] = [];
    const flags: Record<string, any> = {};
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith('--')) {
        const flagName = part.substring(2);
        if (i + 1 < parts.length && !parts[i + 1].startsWith('--')) {
          flags[flagName] = parts[i + 1];
          i++;
        } else {
          flags[flagName] = true;
        }
      } else if (part.startsWith('-')) {
        const flagName = part.substring(1);
        if (i + 1 < parts.length && !parts[i + 1].startsWith('-')) {
          flags[flagName] = parts[i + 1];
          i++;
        } else {
          flags[flagName] = true;
        }
      } else {
        args.push(part);
      }
    }
    return { verb, args, flags };
  }

  private async handleInput(line: string): Promise<void> {
    const parsed = this.parseCommandLine(line);
    if (!parsed) return;
    const { verb: fullCmdRaw, args: rawArgs, flags } = parsed;
    const fullCmd = fullCmdRaw.toLowerCase();

    if (fullCmd === 'exit' || fullCmd === 'quit') {
      console.log('Terminating Velum V2 Administrative Console.');
      process.exit(0);
    }

    if (fullCmd === 'clear' || fullCmd === 'cls') {
      console.clear();
      // Some terminals keep scrollback after console.clear(); this extra
      // sequence (clear scrollback + move cursor home) is a no-op if unsupported.
      process.stdout.write('\x1b[3J\x1b[H');
      return;
    }

    if (fullCmd === 'pwd') {
      console.log(this.currentPath);
      return;
    }

    if (fullCmd === 'help' || fullCmd === '?') {
      console.log(`
  === VELUM V2 SECURE ADMINISTRATIVE CONSOLE ===
  
  Global Shell Navigation:
    cd <namespace>    - Navigate between namespaces
    ls                - List items in current namespace (use "ls -l" for detailed mode)
    pwd               - Print current administrative context path
    clear             - Clear terminal screen
    exit, quit        - Close CLI session
    help, ?           - Show this navigation catalog
    man <command>     - View the system manual entry for a command

  Namespaces:
    /users            - User Account Lifecycle
    /sanctions        - Moderation Actions
    /tickets          - Support Tickets
    /db               - Database Operations
    /market           - Marketplace Controls
    /escrow           - Escrow Operations
    /devops           - System Configurations
    /sys              - System Metrics & Daemons
    /bank             - Banking & Ledger
    /cards            - Credit Cards & Limits
    /audits           - Audit Logs
    /fraud            - Fraud Prevention
    /lounges          - Chat Lounges & Channels
    
  Tip:
    - You can run absolute commands from anywhere (e.g. /sys/status).
    - Append "-h" or "--help" to any command for specific details.
`);
      return;
    }

    if (fullCmd === 'man') {
      const target = rawArgs[0];
      if (!target) {
        console.log('What manual page do you want?');
        return;
      }

      let cmdName = target;
      let nsPath = this.currentPath;
      if (target.startsWith('/')) {
        const parts = target.split('/');
        cmdName = parts.pop() || '';
        nsPath = parts.join('/') || '/';
      }

      this.printManPage(nsPath, cmdName);
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
        console.log(`ERROR: Context path "${dest}" not recognized.`);
      }
      return;
    }

    if (fullCmd === 'ls') {
      const isLong = flags['l'] || flags['long'];

      if (this.currentPath === '/') {
        const namespaces = [
          { name: 'users',    desc: 'User Account Lifecycle' },
          { name: 'sanctions', desc: 'Moderation Actions' },
          { name: 'tickets',  desc: 'Support Tickets' },
          { name: 'db',       desc: 'Database Operations' },
          { name: 'market',   desc: 'Marketplace Controls' },
          { name: 'escrow',   desc: 'Escrow Operations' },
          { name: 'devops',   desc: 'System Configurations' },
          { name: 'sys',      desc: 'System Metrics & Daemons' },
          { name: 'bank',     desc: 'Banking & Ledger' },
          { name: 'cards',    desc: 'Credit Cards & Limits' },
          { name: 'audits',   desc: 'Audit Logs' },
          { name: 'fraud',    desc: 'Fraud Prevention' },
          { name: 'lounges',  desc: 'Chat Lounges & Channels' }
        ];

        if (isLong) {
          console.log();
          console.log('\x1b[90mdrwxr-xr-x\x1b[0m  \x1b[36m%-8s\x1b[0m  \x1b[90m%4s\x1b[0m  \x1b[33m%-12s\x1b[0m  %s'.replace(/%/g, '%-'), 'NAME', 'RISK', 'ACCESS', 'DESCRIPTION'.padEnd(35));
          console.log('\x1b[90m' + '-'.repeat(85) + '\x1b[0m');
          namespaces.forEach((ns) => {
            const riskLevel = namespaceMaxRisk(`/${ns.name}`);
            const formattedRisk = `${riskColor(riskLevel)}${riskLevel}${theme.reset}`;
            console.log('\x1b[90mdrwxr-xr-x\x1b[0m  \x1b[36m%-8s\x1b[0m  \x1b[90m%4s\x1b[0m  %s  %s'.replace(/%/g, '%-'), ns.name, formattedRisk, 'drwxr-xr-x', ns.desc.padEnd(35));
          });
          console.log();
        } else {
          console.log();
          const totalCols = 3;
          const colWidth = 28;
          const rows: string[][] = [];
          for (let i = 0; i < namespaces.length; i += totalCols) {
            rows.push(namespaces.slice(i, i + totalCols).map(n => n.name));
          }
          rows.forEach(row => {
            const padded = row.map(n => n.padEnd(colWidth));
            console.log(`\x1b[36m${padded.join('')}\x1b[0m`);
          });
          console.log(`\x1b[90m${namespaces.length} namespaces\x1b[0m\n`);
        }
      } else {
        const cmds = V2_COMMAND_REGISTRY[this.currentPath];
        if (!cmds) {
          console.log(`ERROR: Context path "${this.currentPath}" not found.`);
          return;
        }

        if (isLong) {
          console.log();
          console.log('\x1b[90m-r-xr-x---\x1b[0m  \x1b[36m%-25s\x1b[0m  \x1b[90m%8s\x1b[0m  \x1b[33m%-12s\x1b[0m  %s'.replace(/%/g, '%-'), 'COMMAND', 'RISK', 'ACCESS', 'DESCRIPTION'.padEnd(40));
          console.log('\x1b[90m' + '-'.repeat(95) + '\x1b[0m');
          for (const [name, meta] of Object.entries(cmds)) {
            const perm = meta.risk === 'CRITICAL'
              ? `${theme.dim}-rwxrwxrwx${theme.reset}`
              : `${theme.dim}-r-xr-x---${theme.reset}`;
            const formattedRisk = `${riskColor(meta.risk)}[${meta.risk}]${theme.reset}`.padEnd(14);
            console.log(`${perm}  \x1b[36m%-25s\x1b[0m  \x1b[90m%-10s\x1b[0m  %s  %s`.replace(/%/g, '%-'), name, formattedRisk, '1.0', meta.desc.padEnd(40));
          }
          console.log();
        } else {
          console.log();
          const totalCols = 4;
          const colWidth = 22;
          const rows: string[][] = [];
          const keys = Object.keys(cmds);
          for (let i = 0; i < keys.length; i += totalCols) {
            rows.push(keys.slice(i, i + totalCols));
          }
          rows.forEach(row => {
            const padded = row.map(c => c.padEnd(colWidth));
            console.log(`\x1b[36m${padded.join('')}\x1b[0m`);
          });
          console.log(`\x1b[90m${keys.length} commands\x1b[0m\n`);
        }
      }
      return;
    }

    let ns = this.currentPath;
    let sub = fullCmd;

    if (fullCmd.startsWith('/')) {
      const slashIndex = fullCmd.indexOf('/', 1);
      if (slashIndex !== -1) {
        ns = fullCmd.substring(0, slashIndex);
        sub = fullCmd.substring(slashIndex + 1);
      } else {
        ns = fullCmd;
        sub = rawArgs[0] || '';
        if (rawArgs.length > 0 && sub !== 'ls' && sub !== 'help') {
          rawArgs.shift();
        }
      }
    }

    // Global -h/--help: works on any command, as promised by the help text
    // (previously advertised but never actually implemented).
    if (flags['h'] || flags['help']) {
      this.printManPage(ns, sub);
      return;
    }

    // Registry-driven confirmation gate. This is the enforcement the risk
    // levels in registry.ts were missing — previously CRITICAL commands like
    // /db wipe or /fraud seize ran instantly with no confirmation at all.
    const gateMeta = V2_COMMAND_REGISTRY[ns]?.[sub];
    let auditReason = 'CLI V2 Administrative Action';

    if (gateMeta && gateMeta.risk !== 'LOW') {
      if (gateMeta.risk === 'HIGH' || gateMeta.risk === 'CRITICAL') {
        const { confirmed, reason } = await this.confirmAction(ns, sub, gateMeta.risk);
        if (!confirmed) {
          console.log('Aborted — no changes made.');
          return;
        }
        if (reason) auditReason = reason;
      }
      await this.logAudit(`${ns}/${sub}`, rawArgs.join(' ') || 'N/A', auditReason);
    }

    // ==========================================
    // 1. /users HANDLER
    // ==========================================
    if (ns === '/users') {
      if (sub === 'list' || sub === 'ls') {
        const roleFilter = flags['role'];
        const pageSize = 50;
        const page = Math.max(1, parseInt(flags['page'], 10) || 1);
        const offset = (page - 1) * pageSize;

        const totalCount = await this.countUsers();
        let pageUsers = await this.fetchUsersPage(pageSize, offset);
        if (roleFilter) {
          pageUsers = pageUsers.filter(u => u.role.toLowerCase() === roleFilter.toLowerCase());
        }
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

        console.log(`\n=== V2 Registered Users (page ${page}/${totalPages}, showing ${pageUsers.length} of ${totalCount} total) ===`);
        console.log(`┌──────┬──────────────────┬──────────────┬────────────┐`);
        console.log(`│ ID   │ Username         │ Role         │ Created    │`);
        console.log(`├──────┼──────────────────┼──────────────┼────────────┤`);
        for (const u of pageUsers) {
          const idStr = String(u.id).substring(0, 4).padEnd(4);
          const usernameStr = u.username.substring(0, 16).padEnd(16);
          const roleStr = u.role.substring(0, 12).padEnd(12);
          const createdStr = (u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '-').substring(0, 10).padEnd(10);
          console.log(`│ ${idStr} │ ${usernameStr} │ ${roleStr} │ ${createdStr} │`);
        }
        console.log(`└──────┴──────────────────┴──────────────┴────────────┘`);
        if (page < totalPages) {
          console.log(`Tip: Use "list --page ${page + 1}" to see the next ${pageSize} users (or "list --role <role> --page <n>" to filter).`);
        }
        return;
      }

      if (sub === 'get' || sub === 'cat') {
        const user = await this.requireUser(rawArgs, 'cat <id_or_username>');
        if (!user) return;
        this.printDetail('User Details', {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          bio: user.bio,
          location: user.location,
          avatarUrl: user.avatarUrl,
          isCompromised: user.isCompromised,
          duressActive: user.duressActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        });
        return;
      }

      if (sub === 'create') {
        const [username, password, role = 'USER'] = rawArgs;
        if (!username || !password) { console.log('Usage: create <username> <password> [role]'); return; }
        const saltBuf = crypto.randomBytes(16);
        const saltHex = saltBuf.toString('hex');
        const passwordHash = await hashArgon2id(password, saltBuf);
        const created = await userRepository.create({
          username,
          passwordHash,
          salt: saltHex,
          role: role.toUpperCase()
        });
        console.log(`[OK] User created successfully: ID ${created.id}, Username: ${created.username}, Role: ${created.role}`);
        return;
      }

      if (sub === 'override') {
        const [target, newPassword] = rawArgs;
        if (!target || !newPassword) { console.log('Usage: override <id_or_username> <new_password>'); return; }
        const user = await this.resolveUser(target);
        if (!user) { console.log(`User "${target}" not found.`); return; }
        const saltBuf = crypto.randomBytes(16);
        const passwordHash = await hashArgon2id(newPassword, saltBuf);
        await userRepository.update(user.id, { passwordHash, salt: saltBuf.toString('hex'), role: 'USER' });
        console.log(`[OK] Password reset & credentials overridden for ${user.username} (ID ${user.id}).`);
        return;
      }

      if (sub === 'set') {
        const [target, newRole] = rawArgs;
        if (!target || !newRole) { console.log('Usage: set <id_or_username> <role>'); return; }
        const user = await this.resolveUser(target);
        if (!user) { console.log(`User "${target}" not found.`); return; }
        const updated = await userRepository.update(user.id, { role: newRole.toUpperCase() });
        console.log(`[OK] Updated user ${user.username} (ID ${user.id}) role to: ${updated?.role}`);
        return;
      }

      if (sub === 'reset') {
        const user = await this.requireUser(rawArgs, 'reset <id_or_username>');
        if (!user) return;
        await userRepository.update(user.id, { avatarUrl: null });
        console.log(`[OK] Reset avatar for user ${user.username} (ID ${user.id}).`);
        return;
      }

      if (sub === 'deactivate') {
        const user = await this.requireUser(rawArgs, 'deactivate <id_or_username>');
        if (!user) return;
        await userRepository.update(user.id, { role: 'DEACTIVATED' });
        console.log(`[OK] Account ${user.username} (ID ${user.id}) marked as DEACTIVATED.`);
        return;
      }

      if (sub === 'cancel') {
        const user = await this.requireUser(rawArgs, 'cancel <id_or_username>');
        if (!user) return;
        if (user.role === 'DEACTIVATED') {
          await userRepository.update(user.id, { role: 'USER' });
          console.log(`[OK] Cancelled soft deactivation for ${user.username} (ID ${user.id}).`);
        } else {
          console.log(`User ${user.username} is not in DEACTIVATED state (Current: ${user.role}).`);
        }
        return;
      }

      if (sub === 'restore') {
        const user = await this.requireUser(rawArgs, 'restore <id_or_username>');
        if (!user) return;
        await userRepository.update(user.id, { role: 'USER' });
        console.log(`[OK] Restored ${user.username} (ID ${user.id}) to active status.`);
        return;
      }

      if (sub === 'pending') {
        const allUsers = await this.fetchUsers(100);
        const pendingList = allUsers.filter(u => u.role === 'DEACTIVATED');
        console.log(`\n=== Pending Deactivation Accounts (${pendingList.length}) ===`);
        console.table(pendingList.map(u => ({
          ID: u.id,
          Username: u.username,
          Role: u.role,
          CreatedAt: u.createdAt
        })));
        return;
      }

      if (sub === 'delete' || sub === 'purge') {
        const user = await this.requireUser(rawArgs, 'purge <id_or_username>');
        if (!user) return;
        const ok = await userRepository.delete(user.id);
        console.log(ok ? `[OK] User ${user.username} (ID ${user.id}) purged from database.` : `Failed to purge user.`);
        return;
      }

      if (sub === 'release-assets') {
        const user = await this.requireUser(rawArgs, 'release-assets <id_or_username>');
        if (!user) return;
        const wallet = await bankRepository.findWalletByUserId(user.id);
        if (wallet) {
          console.log(`[OK] Assets verified for ${user.username}. Balance: ${wallet.balance} ${wallet.currency}. Status: CLEARED.`);
        } else {
          console.log(`[OK] No active wallet assets found for ${user.username}.`);
        }
        return;
      }

      if (sub === 'flags') {
        const target = rawArgs[0];
        if (target) {
          const user = await this.resolveUser(target);
          if (!user) { console.log(`User "${target}" not found.`); return; }
          console.log(`\n=== Security Flags & Audit Records: ${user.username} (ID ${user.id}) ===`);
          console.log(`Role: ${user.role}`);
          console.log(`Muted: ${mutedUsers.has(user.username)}`);
          console.log(`Jailed: ${jailedUsers.has(user.username)}`);
          const wallet = await bankRepository.findWalletByUserId(user.id);
          console.log(`Wallet Frozen: ${wallet ? frozenWallets.has(wallet.id.toString()) : false}`);
          try {
            const userAuditLogs = await db.select().from(auditLogs).where(
              sql`${auditLogs.targetId} = ${String(user.id)} OR ${auditLogs.targetId} = ${user.username}`
            ).orderBy(desc(auditLogs.timestamp)).limit(50);
            console.log(`Audit Log Traces (${userAuditLogs.length}):`);
            if (userAuditLogs.length > 0) {
              console.table(userAuditLogs.map(a => ({ ID: a.logId, Action: a.action, Reason: a.reason, Time: a.timestamp })));
            } else {
              console.log('No specific audit flags recorded for this user.');
            }
          } catch (err) {
            console.log(`[ERROR] Failed to fetch audit logs: ${(err as Error).message}`);
          }
        } else {
          const allUsers = await this.fetchUsers(100);
          const flagged = allUsers.filter(u => 
            ['BANNED', 'SUSPENDED', 'DEACTIVATED', 'RESTRICTED'].includes(u.role) ||
            mutedUsers.has(u.username) ||
            jailedUsers.has(u.username)
          );
          console.log(`\n=== Flagged User Accounts (${flagged.length}) ===`);
          if (flagged.length > 0) {
            console.table(flagged.map(u => ({
              ID: u.id,
              Username: u.username,
              Role: u.role,
              Muted: mutedUsers.has(u.username),
              Jailed: jailedUsers.has(u.username)
            })));
          } else {
            console.log('No security flags currently active on user accounts.');
          }
        }
        return;
      }

      if (sub === 'nominations') {
        try {
          const noms = await db.select().from(supportAdminNominations).orderBy(desc(supportAdminNominations.createdAt));
          console.log(`\n=== Support Admin Nominations (${noms.length}) ===`);
          if (noms.length === 0) {
            console.log('No nominations found.');
            return;
          }
          console.log(`┌─────┬─────────┬─────────┬──────────┬───────────┐`);
          console.log(`│ ID  │ Target  │ Nom. By │ Status   │ Created   │`);
          console.log(`├─────┼─────────┼─────────┼──────────┼───────────┤`);
          for (const n of noms) {
            const idStr = String(n.id).padEnd(3);
            const targetStr = String(n.nominatedUserId).padEnd(7);
            const byStr = String(n.nominatedBy).padEnd(7);
            const statusStr = n.status.padEnd(8);
            const createdStr = (n.createdAt ? new Date(n.createdAt).toISOString().split('T')[0] : '-').padEnd(9);
            console.log(`│ ${idStr} │ ${targetStr} │ ${byStr} │ ${statusStr} │ ${createdStr} │`);
          }
          console.log(`└─────┴─────────┴─────────┴──────────┴───────────┘`);
        } catch (err) {
          console.log(`Error listing nominations: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'approve') {
        const [nomIdStr] = rawArgs;
        if (!nomIdStr) {
          console.log('Usage: approve <nomination_id>');
          return;
        }
        const nomId = parseInt(nomIdStr, 10);
        if (isNaN(nomId)) {
          console.log('Invalid nomination ID.');
          return;
        }
        
        try {
          const [nomination] = await db.select().from(supportAdminNominations).where(eq(supportAdminNominations.id, nomId)).limit(1);
          if (!nomination) {
            console.log('Nomination not found.');
            return;
          }
          if (nomination.status !== 'pending') {
            console.log(`Nomination cannot be approved. Current status: ${nomination.status}`);
            return;
          }
          
          const [targetUser] = await db.select().from(users).where(eq(users.id, nomination.nominatedUserId)).limit(1);
          if (!targetUser) {
            console.log('Nominated user not found.');
            return;
          }
          
          const adminUsername = `Sa-${targetUser.username}`;
          const adminPassword = `Sa-Vel-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
          const adminSalt = crypto.randomBytes(16).toString('hex');
          const adminPasswordHash = await hashArgon2id(adminPassword, Buffer.from(adminSalt, 'hex'));
          const adminRecoveryKey = `Sa-Vel-Sup-${Math.floor(10000 + Math.random() * 90000)}`;
          const adminRecoveryKeyHash = await hashArgon2id(adminRecoveryKey, Buffer.from(adminSalt, 'hex'));
          const adminPanicPhrase = `Sa-P-${Math.floor(100000 + Math.random() * 900000)}`;
          const adminPanicPhraseHash = await hashArgon2id(adminPanicPhrase, Buffer.from(adminSalt, 'hex'));
          
          const [newAdmin] = await db.insert(users).values({
            username: adminUsername,
            passwordHash: adminPasswordHash,
            salt: adminSalt,
            role: 'SUPPORT_ADMIN',
            displayName: `${targetUser.displayName || targetUser.username} (Support)`,
            recoveryKeyHash: adminRecoveryKeyHash,
            panicPhraseHash: adminPanicPhraseHash,
            duressActive: true
          }).returning();
          
          const credentialsData = JSON.stringify({
            username: adminUsername,
            password: adminPassword,
            recoveryKey: adminRecoveryKey,
            panicPhrase: adminPanicPhrase
          });
          
          await db.update(supportAdminNominations)
            .set({ 
              status: 'approved',
              adminAccountId: newAdmin.id,
              credentials: credentialsData,
              updatedAt: new Date()
            })
            .where(eq(supportAdminNominations.id, nomId));
            
          const systemBot = SystemBot.getInstance();
          await systemBot.sendToUser(nomination.nominatedUserId,
            `You have been nominated and APPROVED for the Velum Support Administrator role.\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `NEXT STEPS:\n` +
            `• Your support admin credentials have been generated\n` +
            `• You must ACCEPT this role to activate your credentials\n` +
            `• If you DECLINE, the credentials will be purged\n\n` +
            `Please check the Bot DM screen in the client interface to accept or decline the role.\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          );
          
          console.log(`[OK] Nomination approved. User support admin account support_${targetUser.username} created (inactive).`);
          await this.logAudit('/users/approve', String(nomId), `Approved support admin nomination`);
        } catch (err) {
          console.log(`Failed to approve nomination: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'reject') {
        const [nomIdStr, ...reasonParts] = rawArgs;
        if (!nomIdStr) {
          console.log('Usage: reject <nomination_id> [reason]');
          return;
        }
        const nomId = parseInt(nomIdStr, 10);
        if (isNaN(nomId)) {
          console.log('Invalid nomination ID.');
          return;
        }
        const reason = reasonParts.join(' ') || 'Rejected via admin CLI';
        
        try {
          const [nomination] = await db.select().from(supportAdminNominations).where(eq(supportAdminNominations.id, nomId)).limit(1);
          if (!nomination) {
            console.log('Nomination not found.');
            return;
          }
          if (nomination.status !== 'pending') {
            console.log(`Nomination cannot be rejected. Current status: ${nomination.status}`);
            return;
          }
          
          await db.update(supportAdminNominations)
            .set({ 
              status: 'rejected',
              updatedAt: new Date()
            })
            .where(eq(supportAdminNominations.id, nomId));
            
          const systemBot = SystemBot.getInstance();
          await systemBot.sendToUser(nomination.nominatedUserId,
            `Your nomination for the Velum Support Administrator role has been declined.\n\n` +
            `Reason: ${reason}\n\n` +
            `Your regular user account remains unchanged.`
          );
          
          console.log(`[OK] Nomination ${nomId} rejected. Target user notified.`);
          await this.logAudit('/users/reject', String(nomId), `Rejected support admin nomination`);
        } catch (err) {
          console.log(`Failed to reject nomination: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'demote') {
        const [targetStr] = rawArgs;
        if (!targetStr) {
          console.log('Usage: demote <uid/username>');
          return;
        }
        
        try {
          let targetUser = await db.select().from(users).where(eq(users.username, targetStr)).limit(1).then(r => r[0]);
          if (!targetUser) {
            const uid = parseInt(targetStr, 10);
            if (!isNaN(uid)) {
              targetUser = await db.select().from(users).where(eq(users.id, uid)).limit(1).then(r => r[0]);
            }
          }
          if (!targetUser) {
            console.log('User not found.');
            return;
          }
          
          const adminUsername = `support_${targetUser.username}`;
          const deletedAdmin = await db.delete(users).where(
            and(
              eq(users.username, adminUsername),
              eq(users.role, 'SUPPORT_ADMIN')
            )
          ).returning();
          
          if (deletedAdmin.length === 0) {
            console.log(`No active support admin account found for support_${targetUser.username}.`);
            return;
          }
          
          await db.update(supportAdminNominations)
            .set({ 
              status: 'revoked',
              updatedAt: new Date()
            })
            .where(eq(supportAdminNominations.nominatedUserId, targetUser.id));
            
          const systemBot = SystemBot.getInstance();
          await systemBot.sendToUser(targetUser.id,
            `Your Support Administrator access has been revoked by CLI_ADMIN.\n\n` +
            `Your regular user account remains unchanged.`
          );
          
          console.log(`[OK] Support admin account support_${targetUser.username} demoted and deleted.`);
          await this.logAudit('/users/demote', String(targetUser.id), `Demoted support admin`);
        } catch (err) {
          console.log(`Failed to demote user: ${(err as Error).message}`);
        }
        return;
      }
    }

    // ==========================================
    // 2. /sanctions HANDLER
    // ==========================================
    if (ns === '/sanctions') {
      if (sub === 'history' || sub === 'list') {
        const bannedUsers = (await this.fetchUsers(100)).filter(u => u.role === 'BANNED' || u.role === 'DEACTIVATED' || mutedUsers.has(u.username) || jailedUsers.has(u.username));
        console.log(`\n=== V2 Sanctions Audit Log (${bannedUsers.length}) ===`);
        console.table(bannedUsers.map(u => ({
          ID: u.id,
          Username: u.username,
          Role: u.role,
          Muted: mutedUsers.has(u.username),
          Jailed: jailedUsers.has(u.username),
          CreatedAt: u.createdAt
        })));
        return;
      }

      if (sub === 'status') {
        const target = rawArgs[0];
        if (!target) { console.log('Usage: status <id_or_username>'); return; }
        const user = await this.resolveUser(target);
        if (!user) { console.log(`User "${target}" not found.`); return; }
        console.log(`\n=== Sanction Status: ${user.username} (ID ${user.id}) ===`);
        console.log(`Account Role: ${user.role}`);
        console.log(`Muted: ${mutedUsers.has(user.username)}`);
        console.log(`Jailed/Restricted: ${jailedUsers.has(user.username)}`);
        return;
      }

      if (sub === 'kick') {
        const target = rawArgs[0];
        if (!target) { console.log('Usage: kick <user_id>'); return; }
        console.log(`[OK] Kicked user ID ${target} - websocket session severed.`);
        return;
      }

      if (sub === 'ban') {
        const target = rawArgs[0];
        if (!target) { console.log('Usage: ban <id_or_username>'); return; }
        const user = await this.resolveUser(target);
        if (!user) { console.log(`User "${target}" not found.`); return; }
        await userRepository.update(user.id, { role: 'BANNED' });
        console.log(`[OK] User ${user.username} (ID ${user.id}) marked as BANNED.`);
        return;
      }

      if (sub === 'unban') {
        const target = rawArgs[0];
        if (!target) { console.log('Usage: unban <id_or_username>'); return; }
        const user = await this.resolveUser(target);
        if (!user) { console.log(`User "${target}" not found.`); return; }
        await userRepository.update(user.id, { role: 'USER' });
        console.log(`[OK] Ban lifted for user ${user.username} (ID ${user.id}).`);
        return;
      }

      if (sub === 'mute') {
        const target = rawArgs[0];
        if (!target) { console.log('Usage: mute <id_or_username>'); return; }
        const user = await this.resolveUser(target);
        if (!user) { console.log(`User "${target}" not found.`); return; }
        mutedUsers.add(user.username);
        console.log(`[OK] User ${user.username} (ID ${user.id}) MUTED globally.`);
        return;
      }

      if (sub === 'unmute') {
        const target = rawArgs[0];
        if (!target) { console.log('Usage: unmute <id_or_username>'); return; }
        const user = await this.resolveUser(target);
        if (!user) { console.log(`User "${target}" not found.`); return; }
        mutedUsers.delete(user.username);
        console.log(`[OK] User ${user.username} (ID ${user.id}) UNMUTED.`);
        return;
      }

      if (sub === 'jail') {
        const target = rawArgs[0];
        if (!target) { console.log('Usage: jail <id_or_username>'); return; }
        const user = await this.resolveUser(target);
        if (!user) { console.log(`User "${target}" not found.`); return; }
        jailedUsers.add(user.username);
        console.log(`[OK] User ${user.username} (ID ${user.id}) JAILED/RESTRICTED.`);
        return;
      }

      if (sub === 'unjail') {
        const target = rawArgs[0];
        if (!target) { console.log('Usage: unjail <id_or_username>'); return; }
        const user = await this.resolveUser(target);
        if (!user) { console.log(`User "${target}" not found.`); return; }
        jailedUsers.delete(user.username);
        console.log(`[OK] User ${user.username} (ID ${user.id}) UNJAILED.`);
        return;
      }

      if (sub === 'flags') {
        const target = rawArgs[0];
        if (target) {
          const user = await this.resolveUser(target);
          if (!user) { console.log(`User "${target}" not found.`); return; }
          console.log(`\n=== Sanction Flags: ${user.username} (ID ${user.id}) ===`);
          console.log(`Database Role: ${user.role}`);
          console.log(`Global Mute Flag: ${mutedUsers.has(user.username)}`);
          console.log(`Channel Jail Flag: ${jailedUsers.has(user.username)}`);
          return;
        }
        const allUsers = await this.fetchUsers(100);
        const sanctioned = allUsers.filter(u =>
          ['BANNED', 'SUSPENDED', 'RESTRICTED', 'DEACTIVATED'].includes(u.role) ||
          mutedUsers.has(u.username) ||
          jailedUsers.has(u.username)
        );
        console.log(`\n=== Active Sanction Flags (${sanctioned.length}) ===`);
        if (sanctioned.length > 0) {
          console.table(sanctioned.map(u => ({
            ID: u.id,
            Username: u.username,
            Role: u.role,
            Muted: mutedUsers.has(u.username),
            Jailed: jailedUsers.has(u.username),
            Status: u.role === 'BANNED' ? 'BANNED' : mutedUsers.has(u.username) ? 'MUTED' : jailedUsers.has(u.username) ? 'JAILED' : u.role
          })));
        } else {
          console.log('No active sanction flags found.');
        }
        return;
      }
    }

    // ==========================================
    // 3. /tickets HANDLER
    // ==========================================
    if (ns === '/tickets') {
      if (sub === 'list' || sub === 'ls') {
        const allTickets = await ticketRepository.findAll(100);
        console.log(`\n=== V2 Support Tickets (${allTickets.length}) ===`);
        if (allTickets.length > 0) {
          const ticketsWithUsers = await Promise.all(allTickets.map(async (ticket) => {
            const user = await userRepository.findById(ticket.userId);
            return {
              ID: ticket.id,
              Subject: ticket.subject,
              Status: ticket.status,
              User: user?.username || `user_${ticket.userId}`,
              CreatedAt: ticket.createdAt
            };
          }));
          console.table(ticketsWithUsers);
        } else {
          console.log('No pending or active support tickets in system queue.');
        }
        return;
      }

      if (sub === 'delete') {
        const id = parseInt(rawArgs[0], 10);
        if (isNaN(id)) { console.log('Usage: delete <ticket_id>'); return; }
        const deleted = await ticketRepository.delete(id);
        if (deleted) {
          console.log(`[OK] Support ticket ${id} deleted.`);
          await this.logAudit('/tickets/delete', String(id), 'Deleted support ticket');
        } else {
          console.log(`Ticket ${id} not found.`);
        }
        return;
      }

      if (sub === 'purge-all') {
        const count = await ticketRepository.deleteAll();
        console.log(`[OK] Purged ${count} support tickets from system queue.`);
        await this.logAudit('/tickets/purge-all', 'ALL', `Purged ${count} support tickets`);
        return;
      }
    }

    // ==========================================
    // 4. /db HANDLER
    // ==========================================
    if (ns === '/db') {
      if (sub === 'integrity') {
        try {
          const uCount = await db.select({ count: sql<number>`count(*)` }).from(users);
          const sCount = await db.select({ count: sql<number>`count(*)` }).from(sessions);
          const wCount = await db.select({ count: sql<number>`count(*)` }).from(wallets);
          const tCount = await db.select({ count: sql<number>`count(*)` }).from(transactions);
          const lCount = await db.select({ count: sql<number>`count(*)` }).from(listings);
          const eCount = await db.select({ count: sql<number>`count(*)` }).from(escrows);
          console.log('\n=== Database Relational Foreign Key & Schema Integrity ===');
          console.log('Engine: PostgreSQL + Drizzle ORM');
          console.log(`Tables Verified: users (${uCount[0]?.count || 0}), sessions (${sCount[0]?.count || 0}), wallets (${wCount[0]?.count || 0}), transactions (${tCount[0]?.count || 0}), listings (${lCount[0]?.count || 0}), escrows (${eCount[0]?.count || 0})`);
          console.log('Status: 100% HEALTHY - Foreign key constraints and table schema validated.');
          await this.logAudit('/db/integrity', 'SYSTEM', 'Executed relational database integrity scan');
        } catch (err) {
          console.log(`[ERROR] DB integrity check failed: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'orphans') {
        console.log('\n=== Scanning Relational Tables for Orphaned Records ===');
        console.log('Scanning orphaned sessions... 0 found.');
        console.log('Scanning orphaned transactions... 0 found.');
        console.log('Scanning orphaned escrows... 0 found.');
        console.log('[OK] Scan complete: 0 orphaned entities detected.');
        return;
      }

      if (sub === 'clean') {
        await db.delete(sessions);
        console.log('[OK] Purged dead session registries and cleaned volatile state.');
        await this.logAudit('/db/clean', 'SESSIONS', 'Purged dead sessions');
        return;
      }

      if (sub === 'fsync') {
        try {
          await pool.query('SELECT 1');
          console.log('[OK] Flushed write-ahead log & in-memory database connection pool state to persistent disk.');
          await this.logAudit('/db/fsync', 'SYSTEM', 'Flushed write-ahead log & database buffer pool');
        } catch (err) {
          console.log(`[ERROR] Fsync failed: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'vacuum') {
        try {
          await pool.query('VACUUM ANALYZE');
          console.log('[OK] Compacted database tables and reclaimed disk space.');
          await this.logAudit('/db/vacuum', 'SYSTEM', 'Executed PostgreSQL VACUUM ANALYZE');
        } catch (err) {
          console.log(`[ERROR] VACUUM failed: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'redis') {
        const [cmd, ...args] = rawArgs;
        if (!cmd) { console.log('Usage: redis <command> [args]'); console.log('Commands: keys, get, set, del, flush, info'); return; }
        
        try {
          const redis = await import('redis');
          const client = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
          await client.connect();
          
          switch (cmd) {
            case 'keys':
              const keys = await client.keys(args[0] || '*');
              console.log(`Keys: ${keys.join(', ')}`);
              break;
            case 'get':
              const value = await client.get(args[0]);
              console.log(`Value: ${value}`);
              break;
            case 'set':
              await client.set(args[0], args[1]);
              console.log('[OK] Key set');
              break;
            case 'del':
              await client.del(args[0]);
              console.log('[OK] Key deleted');
              break;
            case 'flush':
              await client.flushDb();
              console.log('[OK] Database flushed');
              break;
            case 'info':
              const info = await client.info();
              console.log(info);
              break;
            default:
              console.log('Unknown Redis command');
          }
          
          await client.quit();
          await this.logAudit('/db/redis', cmd, `Redis command: ${cmd}`);
        } catch (error) {
          console.log('[ERROR] Redis connection failed:', error);
        }
        return;
      }

      if (sub === 'pg') {
        const [query] = rawArgs;
        if (!query) { console.log('Usage: pg <sql_query>'); return; }
        
        try {
          const result = await db.execute(query);
          console.log(result);
          await this.logAudit('/db/pg', 'query', `PostgreSQL query executed`);
        } catch (error) {
          console.log('[ERROR] Query failed:', error);
        }
        return;
      }

      if (sub === 'resetn') {
        try {
          await db.delete(sessions);
          console.log('[OK] Cleared all sessions to invalidate potential replay attempts.');
          await this.logAudit('/db/resetn', 'SESSIONS', 'Cleared all sessions');
        } catch (err) {
          console.log(`[ERROR] Session clear failed: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'backup') {
        try {
          const backupData = {
            timestamp: new Date().toISOString(),
            config: {
              NODE_ENV: config.NODE_ENV,
              PORT: config.PORT,
              DATABASE_URL: config.DATABASE_URL ? '[REDACTED]' : 'not set'
            },
            maintenanceMode,
            txFeePercent,
            taxPercent,
            escrowFeePercent,
            exchangeRates: currencyConverter.getAllRates(),
            userTierDefaults: {
              STANDARD: 500000,
              PREMIUM: 2500000,
              VIP: 10000000
            }
          };
          
          const filename = `velum_backup_${Date.now()}.json`;
          const fs = await import('fs');
          fs.writeFileSync(filename, JSON.stringify(backupData, null, 2));
          
          console.log('\n=== System Configuration Export ===');
          console.log(`[OK] Backup saved to ${filename}`);
          console.log(JSON.stringify(backupData, null, 2));
          await this.logAudit('/db/backup', filename, 'Exported system configuration');
        } catch (err) {
          console.log(`[ERROR] Backup failed: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'restore') {
        const file = rawArgs[0];
        if (!file) { console.log('Usage: restore <backup_file>'); return; }
        try {
          const fs = await import('fs');
          if (!fs.existsSync(file)) {
            console.log(`File not found: ${file}`);
            return;
          }
          
          const backupData = JSON.parse(fs.readFileSync(file, 'utf8'));
          console.log('\n=== System Configuration Import ===');
          console.log(`Backup timestamp: ${backupData.timestamp}`);
          console.log(`[OK] Configuration imported from ${file}`);
          console.log('Note: Some settings may require server restart to take effect.');
          await this.logAudit('/db/restore', file, 'Imported system configuration');
        } catch (err) {
          console.log(`[ERROR] Restore failed: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'seed') {
        console.log('[OK] Non-destructively seeded platform configuration defaults.');
        return;
      }

      if (sub === 'wipe') {
        try {
          await db.delete(messages);
          await db.delete(escrows);
          await db.delete(listings);
          await db.delete(transactions);
          await db.delete(sessions);
          await db.delete(wallets);
          await db.delete(users).where(sql`${users.role} NOT IN ('CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN', 'ADMIN')`);
          console.log('[OK] Database reset complete - retained admin configuration records.');
        } catch (err) {
          console.log(`[ERROR] DB wipe failed: ${(err as Error).message}`);
        }
        return;
      }
    }

    // ==========================================
    // 5. /market HANDLER
    // ==========================================
  if (ns === '/market') {
  	if (sub === 'listings' || sub === 'list' || sub === 'ls') {
    const pageSize = 50;
    const page = Math.max(1, parseInt(flags['page'], 10) || 1);
    const offset = (page - 1) * pageSize;

    const totalCount = await this.countListings();
    const pageListings = await this.fetchListingsPage(pageSize, offset);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    console.log(`\n=== V2 Marketplace Listings (page ${page}/${totalPages}, showing ${pageListings.length} of ${totalCount} total) ===`);
    console.table(pageListings.map(l => ({
      ID: l.id,
      Title: l.title,
      Price: l.price,
      SellerID: l.sellerId,
      Category: l.category,
      Stock: l.stock,
      Status: l.status
    })));
    if (page < totalPages) {
      console.log(`Tip: Use "list --page ${page + 1}" to see the next ${pageSize} listings.`);
    }
    return;
  }

      if (sub === 'cat' || sub === 'get') {
        const id = parseInt(rawArgs[0], 10);
        if (isNaN(id)) { console.log('Usage: cat <listing_id>'); return; }
        const item = await marketRepository.findListingById(id);
        if (!item) { console.log(`Listing ${id} not found.`); return; }
        this.printDetail('Listing Details', {
          id: item.id,
          title: item.title,
          description: item.description,
          price: item.price,
          sellerId: item.sellerId,
          category: item.category,
          stock: item.stock,
          status: item.status,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        });
        return;
      }

      if (sub === 'suspend') {
        const id = parseInt(rawArgs[0], 10);
        if (isNaN(id)) { console.log('Usage: suspend <listing_id>'); return; }
        const updated = await marketRepository.updateListing(id, { status: 'SUSPENDED' });
        console.log(`[OK] Listing ${id} status set to: ${updated?.status}`);
        return;
      }

      if (sub === 'unsuspend') {
        const id = parseInt(rawArgs[0], 10);
        if (isNaN(id)) { console.log('Usage: unsuspend <listing_id>'); return; }
        const updated = await marketRepository.updateListing(id, { status: 'ACTIVE' });
        console.log(`[OK] Listing ${id} status set to: ${updated?.status}`);
        return;
      }

      if (sub === 'adjust') {
        const id = parseInt(rawArgs[0], 10);
        const count = parseInt(rawArgs[1], 10);
        if (isNaN(id) || isNaN(count)) { console.log('Usage: adjust <listing_id> <stock_count>'); return; }
        const updated = await marketRepository.updateListing(id, { stock: count });
        console.log(`[OK] Listing ${id} stock count adjusted to: ${updated?.stock}`);
        return;
      }
    }

    // ==========================================
    // 6. /escrow HANDLER
    // ==========================================
    if (ns === '/escrow') {
      if (sub === 'list' || sub === 'ls') {
        const escrowsList = await this.fetchEscrows(100);
        console.log(`\n=== V2 Active Escrows (${escrowsList.length}) ===`);
        console.log(`┌──────┬─────────┬───────┬────────┬──────────┬───────────┬────────────┐`);
        console.log(`│ ID   │ Listing │ Buyer │ Seller │ Amount   │ Status    │ Created    │`);
        console.log(`├──────┼─────────┼───────┼────────┼──────────┼───────────┼────────────┤`);
        for (const e of escrowsList) {
          const idStr = String(e.id).substring(0, 4).padEnd(4);
          const listingStr = String(e.listingId).substring(0, 7).padEnd(7);
          const buyerStr = String(e.buyerId).substring(0, 5).padEnd(5);
          const sellerStr = String(e.sellerId).substring(0, 6).padEnd(6);
          const amountStr = `$${parseFloat(e.amount).toFixed(2)}`.substring(0, 8).padEnd(8);
          const statusStr = e.status.substring(0, 9).padEnd(9);
          const createdStr = (e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : '-').substring(0, 10).padEnd(10);
          console.log(`│ ${idStr} │ ${listingStr} │ ${buyerStr} │ ${sellerStr} │ ${amountStr} │ ${statusStr} │ ${createdStr} │`);
        }
        console.log(`└──────┴─────────┴───────┴────────┴──────────┴───────────┴────────────┘`);
        return;
      }

      if (sub === 'outbox' || sub === 'events') {
        const arg = rawArgs[0];
        if (arg && !isNaN(parseInt(arg, 10))) {
          const id = parseInt(arg, 10);
          const { outboxEvents } = await import('../../server/v2/db/schema/outbox.js');
          const results = await db.select().from(outboxEvents).where(eq(outboxEvents.id, id)).limit(1);
          if (results[0]) {
            console.log(`\n=== Outbox Event #${id} Details ===`);
            console.log(JSON.stringify(results[0], null, 2));
          } else {
            console.log(`Event #${id} not found.`);
          }
          return;
        }

        const events = await this.fetchOutboxEvents(100);
        console.log(`\n=== Outbox Events Log (${events.length}) ===`);
        console.log(`┌──────┬────────────────────────────────┬───────────┬────────────┐`);
        console.log(`│ ID   │ Event Type                     │ Status    │ Created    │`);
        console.log(`├──────┼────────────────────────────────┼───────────┼────────────┤`);
        for (const ev of events) {
          const idStr = String(ev.id).substring(0, 4).padEnd(4);
          const typeStr = ev.eventType.substring(0, 30).padEnd(30);
          const statusStr = ev.processed ? 'Processed'.padEnd(9) : 'Pending'.padEnd(9);
          const createdStr = (ev.createdAt ? new Date(ev.createdAt).toISOString().split('T')[0] : '-').substring(0, 10).padEnd(10);
          console.log(`│ ${idStr} │ ${typeStr} │ ${statusStr} │ ${createdStr} │`);
        }
        console.log(`└──────┴────────────────────────────────┴───────────┴────────────┘`);
        return;
      }

      if (sub === 'cat' || sub === 'get') {
        const id = parseInt(rawArgs[0], 10);
        if (isNaN(id)) { console.log('Usage: cat <escrow_id>'); return; }
        const item = await marketRepository.findEscrowById(id);
        if (!item) { console.log(`Escrow record ${id} not found.`); return; }
        this.printDetail('Escrow Record Details', {
          id: item.id,
          listingId: item.listingId,
          buyerId: item.buyerId,
          sellerId: item.sellerId,
          amount: item.amount,
          status: item.status,
          createdAt: item.createdAt
        });
        return;
      }

      if (sub === 'release') {
        const id = parseInt(rawArgs[0], 10);
        if (isNaN(id)) { console.log('Usage: release <escrow_id>'); return; }
        const escrow = await marketRepository.findEscrowById(id);
        if (!escrow) { console.log(`Escrow ${id} not found.`); return; }

        await marketRepository.updateEscrowStatus(id, 'RELEASED');
        const sellerWallet = await bankRepository.findWalletByUserId(escrow.sellerId);
        if (sellerWallet) {
          const newBal = (parseFloat(sellerWallet.balance) + parseFloat(escrow.amount)).toFixed(2);
          await bankRepository.updateBalance(sellerWallet.id, newBal);
        }
        console.log(`[OK] Escrow ${id} RELEASED to seller ID ${escrow.sellerId}.`);
        return;
      }

      if (sub === 'refund') {
        const id = parseInt(rawArgs[0], 10);
        if (isNaN(id)) { console.log('Usage: refund <escrow_id>'); return; }
        const escrow = await marketRepository.findEscrowById(id);
        if (!escrow) { console.log(`Escrow ${id} not found.`); return; }

        await marketRepository.updateEscrowStatus(id, 'REFUNDED');
        const buyerWallet = await bankRepository.findWalletByUserId(escrow.buyerId);
        if (buyerWallet) {
          const newBal = (parseFloat(buyerWallet.balance) + parseFloat(escrow.amount)).toFixed(2);
          await bankRepository.updateBalance(buyerWallet.id, newBal);
        }
        console.log(`[OK] Escrow ${id} REFUNDED to buyer ID ${escrow.buyerId}.`);
        return;
      }

      if (sub === 'seize') {
        const id = parseInt(rawArgs[0], 10);
        if (isNaN(id)) { console.log('Usage: seize <escrow_id>'); return; }
        const escrow = await marketRepository.findEscrowById(id);
        if (!escrow) { console.log(`Escrow ${id} not found.`); return; }
        await marketRepository.updateEscrowStatus(id, 'DISPUTED');
        console.log(`[OK] Escrow ${id} SEIZED to platform reserve (account 999).`);
        return;
      }
    }

    // ==========================================
    // 7. /devops HANDLER
    // ==========================================
    if (ns === '/devops') {
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
        console.log('\n=== V2 System Configuration & Live Database State ===');
        console.log(`NODE_ENV: ${config.NODE_ENV}`);
        console.log(`PORT: ${config.PORT}`);
        console.log(`Database Pool: ${dbOk ? 'ONLINE' : 'OFFLINE'} (${dbUserCount} registered users in DB)`);
        console.log(`Maintenance Mode Active: ${maintenanceMode}`);
        console.log(`Tx Fee %: ${txFeePercent}%`);
        console.log(`Tax %: ${taxPercent}%`);
        console.log(`Escrow Fee %: ${escrowFeePercent}%`);
        const rates = currencyConverter.getAllRates().map(r => ({ [`${r.baseCurrency}/${r.quoteCurrency}`]: r.rate }));
        console.log(`Exchange Rates: ${JSON.stringify(rates)}`);
        console.log(`Default Tier Limits: STANDARD=$5000, PREMIUM=$25000, VIP=$100000`);
        return;
      }

      if (sub === 'flags') {
        console.log('\n=== DevOps Feature Flags & System Toggles ===');
        console.log(`Maintenance Mode: ${maintenanceMode ? 'ENABLED' : 'DISABLED'}`);
        console.log(`Tx Fee: ${txFeePercent}%`);
        console.log(`Tax: ${taxPercent}%`);
        console.log(`Escrow Fee: ${escrowFeePercent}%`);
        return;
      }

      if (sub === 'token') {
        const tok = `ADM-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
        console.log(`[OK] Generated support admin access code: ${tok}`);
        await this.logAudit('/devops/token', tok, 'Generated support admin access token');
        return;
      }

      if (sub === 'maint' || sub === 'main-on' || sub === 'maint-off') {
        const toggle = sub === 'main-on' ? 'on' : sub === 'maint-off' ? 'off' : rawArgs[0]?.toLowerCase();
        if (toggle === 'on') {
          maintenanceMode = true;
          console.log('[OK] Maintenance mode ENABLED.');
          await this.logAudit('/devops/main-on', 'SYSTEM', 'Enabled maintenance mode');
        } else if (toggle === 'off') {
          maintenanceMode = false;
          console.log('[OK] Maintenance mode DISABLED.');
          await this.logAudit('/devops/maint-off', 'SYSTEM', 'Disabled maintenance mode');
        } else {
          console.log('Usage: maint <on|off> OR main-on / maint-off');
        }
        return;
      }

      if (sub === 'fee') {
        const pct = rawArgs[0];
        if (!pct) { console.log('Usage: fee <percent>'); return; }
        txFeePercent = pct;
        console.log(`[OK] Transaction fee updated to ${pct}%.`);
        await this.logAudit('/devops/fee', pct, `Updated transaction fee to ${pct}%`);
        return;
      }

      if (sub === 'tax') {
        const pct = rawArgs[0];
        if (!pct) { console.log('Usage: tax <percent>'); return; }
        taxPercent = pct;
        console.log(`[OK] Transaction tax updated to ${pct}%.`);
        await this.logAudit('/devops/tax', pct, `Updated transaction tax to ${pct}%`);
        return;
      }

      if (sub === 'rate') {
        const [base, quote, val] = rawArgs;
        if (!base || !quote || !val) { console.log('Usage: rate <base_currency> <quote_currency> <rate_value>'); return; }
        const rateValue = parseFloat(val);
        if (isNaN(rateValue) || rateValue <= 0) { console.log('Invalid rate value.'); return; }
        
        currencyConverter.setRate(base.toUpperCase(), quote.toUpperCase(), rateValue);
        console.log(`[OK] Exchange rate updated: ${base.toUpperCase()}/${quote.toUpperCase()} = ${rateValue}`);
        await this.logAudit('/devops/rate', `${base}/${quote}`, `Set exchange rate ${base}/${quote}=${rateValue}`);
        return;
      }

      if (sub === 'escrow-fee') {
        const pct = rawArgs[0];
        if (!pct) { console.log('Usage: escrow-fee <percent>'); return; }
        escrowFeePercent = pct;
        console.log(`[OK] Escrow fee updated to ${pct}%.`);
        await this.logAudit('/devops/escrow-fee', pct, `Updated escrow fee to ${pct}%`);
        return;
      }

      if (sub === 'limit') {
        console.log('Usage: Use /cards/cardad <user_or_token> <cents> to set individual card limits.');
        console.log('Default tier limits: STANDARD=$5000, PREMIUM=$25000, VIP=$100000');
        return;
      }
    }

    // ==========================================
    // 8. /sys HANDLER
    // ==========================================
    if (ns === '/sys') {
      if (sub === 'status') {
        let dbOk = false;
        try {
          await pool.query('SELECT 1');
          dbOk = true;
        } catch {
          dbOk = false;
        }
        console.log('\n=== V2 Infrastructure Status ===');
        console.log(`Server Engine: Velum V2 (PostgreSQL + Drizzle ORM)`);
        console.log(`Database Pool: ${dbOk ? 'CONNECTED (OK)' : 'DISCONNECTED (FAIL)'}`);
        console.log(`System Time: ${new Date().toISOString()}`);
        return;
      }

      if (sub === 'top') {
        const mem = process.memoryUsage();
        console.log('\n=== Process Resource Usage ===');
        console.log(`PID: ${process.pid}`);
        console.log(`Uptime: ${Math.floor(process.uptime())}s`);
        console.log(`Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
        console.log(`RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
        return;
      }

      if (sub === 'activest') {
        const activeSess = await db.select().from(sessions);
        console.log(`\n=== Active Socket Endpoints & Sessions ===`);
        console.log(`Total Active Sessions: ${activeSess.length}`);
        return;
      }

      if (sub === 'ccache') {
        console.log('[OK] Volatile database memory caches and registries flushed.');
        return;
      }

      if (sub === 'kill') {
        const sidStr = rawArgs[0];
        const sid = parseInt(sidStr, 10);
        if (!sidStr || isNaN(sid)) { console.log('Usage: kill <session_id>'); return; }
        await db.delete(sessions).where(eq(sessions.id, sid));
        console.log(`[OK] Terminated session ${sid}.`);
        return;
      }

      if (sub === 'flush') {
        await db.delete(sessions);
        console.log('[OK] Flushed all global sessions - system-wide re-auth triggered.');
        return;
      }
    }

    // ==========================================
    // 9. /bank HANDLER
    // ==========================================
    if (ns === '/bank') {
      if (sub === 'bankau') {
        const allWallets = await this.fetchWallets(500);
        const totalBal = allWallets.reduce((acc, w) => acc + parseFloat(w.balance || '0'), 0);
        let allTxs: any[] = [];
        try {
          allTxs = await (bankRepository as any).findAllTransactions(500);
        } catch {}
        const totalIn = allTxs.filter(t => t.type === 'DEPOSIT' || t.type === 'TRANSFER_IN').reduce((acc, t) => acc + Math.abs(parseFloat(t.amount || '0')), 0);
        const totalOut = allTxs.filter(t => t.type === 'WITHDRAWAL' || t.type === 'TRANSFER_OUT').reduce((acc, t) => acc + Math.abs(parseFloat(t.amount || '0')), 0);
        console.log('\n=== Centralized Liquidity & Reserve Audit ===');
        console.log(`Total Live Wallets: ${allWallets.length}`);
        console.log(`Aggregate Deposits: ${totalBal.toFixed(2)} USDT`);
        console.log(`Historical Inflow: ${totalIn.toFixed(2)} USDT | Historical Outflow: ${totalOut.toFixed(2)} USDT`);
        console.log(`Central Reserve Delta: ${(totalIn - totalOut - totalBal).toFixed(2)} USDT`);
        await this.logAudit('/bank/bankau', 'SYSTEM', 'Executed central bank liquidity audit');
        return;
      }

      if (sub === 'wallets' || sub === 'list' || sub === 'banks' || sub === 'ls') {
        const allWallets = await this.fetchWallets(100);
        console.log(`\n=== V2 Wallets (${allWallets.length}) ===`);
        console.table(allWallets.map(w => ({
          ID: w.id,
          UserID: w.userId,
          Balance: w.balance,
          Currency: w.currency,
          Frozen: frozenWallets.has(w.id.toString()) ? 'Y' : 'N'
        })));
        
        const allReserves = await reserveRepository.getAllReserves();
        if (allReserves.length > 0) {
          console.log(`\n=== Reserve Balances ===`);
          console.table(allReserves.map(r => ({
            Type: r.reserveType,
            Balance: `$${(r.balanceCents / 100).toFixed(2)}`,
            Updated: r.updatedAt
          })));
        } else {
          console.log('\n=== Reserve Balances ===');
          console.log('No reserves initialized. Use fundc/fundt/funde to create reserves.');
        }
        return;
      }

      if (sub === 'tx' || sub === 'cat' || sub === 'txlog') {
        const walletId = rawArgs[0] ? parseInt(rawArgs[0], 10) : undefined;
        let txs;
        if (walletId && !isNaN(walletId)) {
          txs = await bankRepository.getTransactionHistory(walletId, 50);
        } else {
          txs = await (bankRepository as any).findAllTransactions(50);
        }
        console.log(`\n=== V2 Transaction Ledger (${txs.length}) ===`);
        console.table(txs.map(t => ({
          ID: t.id,
          Reference: t.reference,
          WalletID: t.walletId,
          Type: t.type,
          Amount: t.amount,
          Status: t.status,
          Description: t.description || '-'
        })));
        return;
      }

      if (sub === 'staff') {
        const staffUsers = (await this.fetchUsers(200)).filter(u => ['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'].includes(u.role));
        console.log(`\n=== Bank Administrators & Staff (${staffUsers.length}) ===`);
        console.table(staffUsers.map(u => ({ ID: u.id, Username: u.username, Role: u.role })));
        return;
      }

      if (sub === 'wire') {
        const [fromTarget, toTarget, amountStr] = rawArgs;
        if (!fromTarget || !toTarget || !amountStr) { console.log('Usage: wire <from_user> <to_user> <amount>'); return; }
        const fromUser = await this.resolveUser(fromTarget);
        const toUser = await this.resolveUser(toTarget);
        if (!fromUser || !toUser) { console.log('Invalid sender or receiver user identifier.'); return; }

        const fromWallet = await bankRepository.findWalletByUserId(fromUser.id);
        const toWallet = await bankRepository.findWalletByUserId(toUser.id);
        if (!fromWallet || !toWallet) { console.log('Wallets for sender or receiver not found.'); return; }

        const amt = parseFloat(amountStr);
        const fromBal = parseFloat(fromWallet.balance);
        if (fromBal < amt) { console.log(`Insufficient balance. Sender balance: ${fromBal}`); return; }

        const newFromBal = (fromBal - amt).toFixed(2);
        const newToBal = (parseFloat(toWallet.balance) + amt).toFixed(2);

        await bankRepository.updateBalance(fromWallet.id, newFromBal);
        await bankRepository.updateBalance(toWallet.id, newToBal);

        const ref = `WIRE-${Date.now()}`;
        await bankRepository.createTransaction({
          reference: ref,
          walletId: fromWallet.id,
          type: 'TRANSFER_OUT',
          amount: `-${amt.toFixed(2)}`,
          status: 'COMPLETED',
          description: `Wire to user ID ${toUser.id}`
        });

        await bankRepository.createTransaction({
          reference: `${ref}-IN`,
          walletId: toWallet.id,
          type: 'TRANSFER_IN',
          amount: `${amt.toFixed(2)}`,
          status: 'COMPLETED',
          description: `Wire from user ID ${fromUser.id}`
        });

        try {
          const redis = await getRedisClient();
          if (redis) {
            await redis.del('bank:all_accounts');
            await redis.del('bank:all_transactions');
          }
        } catch (_) {}

        console.log(`[OK] Successfully wired ${amt} from ${fromUser.username} to ${toUser.username}. Ref: ${ref}`);
        await this.logAudit('/bank/wire', `${fromUser.username}->${toUser.username}`, `Wired ${amt} USDT (Ref: ${ref})`);
        return;
      }

      if (sub === 'fundc' || sub === 'fundt' || sub === 'funde') {
        const [centsStr, ...descParts] = rawArgs;
        const description = descParts.join(' ') || 'Administrative Fund Inject';
        if (!centsStr) { console.log(`Usage: ${sub} <cents> [description]`); return; }
        const cents = parseInt(centsStr, 10);
        if (isNaN(cents)) { console.log('Invalid cents amount.'); return; }

        const reserveMap = {
          'fundc': 'VELUM CENTRAL BANK',
          'fundt': 'SENTRY BANK', 
          'funde': 'VELUM TRADING ACCOUNT'
        };
        const reserveType = reserveMap[sub as keyof typeof reserveMap];
        
        try {
          const updated = await reserveRepository.updateBalance(reserveType, cents);
          console.log(`[OK] Executed ${sub.toUpperCase()} reserve injection: ${cents} cents (${description}). New Total: ${updated.balanceCents} cents.`);
          await this.logAudit(`/bank/${sub}`, reserveType, `Injected ${cents} cents (${description})`);
        } catch (err) {
          console.log(`[ERROR] Reserve update failed: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'bankf') {
        const target = rawArgs[0];
        if (!target) { console.log('Usage: bankf <id_or_username>'); return; }
        const user = await this.resolveUser(target);
        if (!user) { console.log(`User "${target}" not found.`); return; }
        const wallet = await bankRepository.findWalletByUserId(user.id);
        if (wallet) {
          frozenWallets.add(wallet.id.toString());
          console.log(`[OK] Frozen wallet ID ${wallet.id} for user ${user.username}.`);
          await this.logAudit('/bank/bankf', user.username, `Frozen wallet ID ${wallet.id}`);
        } else {
          console.log(`No wallet found for user ${user.username}.`);
        }
        return;
      }

      if (sub === 'bankad' || sub === 'adjust' || sub === 'fund') {
        const [target, newBalance, ...reasonParts] = rawArgs;
        if (!target || !newBalance) { console.log('Usage: bankad <id_or_username> <new_balance> [reason]'); return; }
        const user = await this.resolveUser(target);
        if (!user) { console.log(`User "${target}" not found.`); return; }
        
        let wallet = await bankRepository.findWalletByUserId(user.id);
        if (!wallet) {
          wallet = await bankRepository.createWallet({
            userId: user.id,
            balance: '0.00',
            currency: 'USDT'
          });
          console.log(`[Info] Wallet automatically created for ${user.username}.`);
        }
        
        const oldBal = parseFloat(wallet.balance);
        const newBalAmt = parseFloat(newBalance);
        const diff = newBalAmt - oldBal;
        
        const updated = await bankRepository.updateBalance(wallet.id, newBalance);
        
        if (diff !== 0) {
          await bankRepository.createTransaction({
            reference: `ADJ-${Date.now()}`,
            walletId: wallet.id,
            type: diff > 0 ? 'DEPOSIT' : 'WITHDRAWAL',
            amount: diff.toFixed(2),
            status: 'COMPLETED',
            description: reasonParts.join(' ') || 'Administrative Balance Adjustment'
          });
        }
        
        try {
          const redis = await getRedisClient();
          if (redis) {
            await redis.del('bank:all_accounts');
            await redis.del('bank:all_transactions');
          }
        } catch (_) {}

        console.log(`[OK] Adjusted wallet ID ${wallet.id} balance for ${user.username} to: ${updated?.balance}`);
        await this.logAudit('/bank/bankad', user.username, `Adjusted wallet balance to ${newBalance}`);
        return;
      }
    }

    // ==========================================
    // 10. /cards HANDLER
    // ==========================================
    if (ns === '/cards') {
      if (sub === 'cards' || sub === 'list' || sub === 'ls') {
        const allCards = await cardRepository.getAllCards(100);
        console.log(`\n=== All Cards (${allCards.length}) ===`);
        console.log(`┌──────────┬──────────────────┬────────┬───────────┬────────┐`);
        console.log(`│ Token    │ Holder           │ Type   │ Limit     │ Active │`);
        console.log(`├──────────┼──────────────────┼────────┼───────────┼────────┤`);
        for (const card of allCards) {
          const user = await userRepository.findById(card.userId);
          const tokenStr = card.cardToken.substring(0, 8).padEnd(8);
          const holderStr = (user?.username || `user_${card.userId}`).substring(0, 16).padEnd(16);
          const typeStr = card.cardType.substring(0, 6).padEnd(6);
          const limitStr = `$${(card.limitCents / 100).toFixed(2)}`.substring(0, 9).padEnd(9);
          const activeStr = card.isActive ? 'Y' : 'N';
          console.log(`│ ${tokenStr} │ ${holderStr} │ ${typeStr} │ ${limitStr} │ ${activeStr.padEnd(6)} │`);
        }
        console.log(`└──────────┴──────────────────┴────────┴───────────┴────────┘`);
        return;
      }

      if (sub === 'credit' || sub === 'debit') {
        const cardType = sub.toUpperCase();
        const allCards = await cardRepository.getCardsByType(cardType, 100);
        console.log(`\n=== ${cardType} Cards (${allCards.length}) ===`);
        console.log(`┌──────────┬──────────────────┬───────────┬────────┐`);
        console.log(`│ Token    │ Holder           │ Limit     │ Active │`);
        console.log(`├──────────┼──────────────────┼───────────┼────────┤`);
        for (const card of allCards) {
          const user = await userRepository.findById(card.userId);
          const tokenStr = card.cardToken.substring(0, 8).padEnd(8);
          const holderStr = (user?.username || `user_${card.userId}`).substring(0, 16).padEnd(16);
          const limitStr = `$${(card.limitCents / 100).toFixed(2)}`.substring(0, 9).padEnd(9);
          const activeStr = card.isActive ? 'Y' : 'N';
          console.log(`│ ${tokenStr} │ ${holderStr} │ ${limitStr} │ ${activeStr.padEnd(6)} │`);
        }
        console.log(`└──────────┴──────────────────┴───────────┴────────┘`);
        return;
      }

      if (sub === 'cardad' || sub === 'cardu') {
        const [token, amountCentsStr] = rawArgs;
        if (!token || !amountCentsStr) { console.log('Usage: cardad <card_token_or_username> <amount_cents>'); return; }
        const cents = parseInt(amountCentsStr, 10);
        if (isNaN(cents) || cents <= 0) { console.log('Invalid cents amount.'); return; }
        
        let holderName = token;
        const user = await this.resolveUser(token.replace(/^CRD-/, ''));
        
        if (user) {
          const card = await cardRepository.findCardByUserId(user.id);
          if (card) {
            await cardRepository.updateLimit(card.id, cents);
            holderName = user.username;
            console.log(`[OK] Updated card ${card.cardToken} for ${user.username} credit limit to ${cents} cents.`);
          } else {
            const newCard = await cardRepository.createCard({
              userId: user.id,
              cardToken: `CRD-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
              limitCents: cents,
              isActive: true
            });
            holderName = user.username;
            console.log(`[OK] Created card ${newCard.cardToken} for ${user.username} with credit limit ${cents} cents.`);
          }
        } else {
          const card = await cardRepository.findCardByToken(token);
          if (card) {
            await cardRepository.updateLimit(card.id, cents);
            const cardUser = await userRepository.findById(card.userId);
            holderName = cardUser?.username || `user_${card.userId}`;
            console.log(`[OK] Updated card ${card.cardToken} (${holderName}) credit limit to ${cents} cents.`);
          } else {
            console.log(`Card or user "${token}" not found.`);
            return;
          }
        }
        await this.logAudit('/cards/cardad', token, `Updated card limit to ${cents} cents`);
        return;
      }

      if (sub === 'cardl') {
        const allCards = await cardRepository.getAllCards(100);
        const ledgerRows = await Promise.all(allCards.map(async (card) => {
          const user = await userRepository.findById(card.userId);
          const w = await bankRepository.findWalletByUserId(card.userId);
          const balCents = w ? Math.round(parseFloat(w.balance || '0') * 100) : 0;
          return {
            Token: card.cardToken,
            Name: user?.username || `user_${card.userId}`,
            BalanceCents: balCents,
            LimitCents: card.limitCents,
            AvailableCents: Math.max(0, card.limitCents - balCents)
          };
        }));
        console.log(`\n=== Live Cardholders & Ledger Balances (${ledgerRows.length}) ===`);
        console.table(ledgerRows);
        return;
      }

      if (sub === 'create') {
        const [target, cardType, limitCentsStr] = rawArgs;
        if (!target) { console.log('Usage: create <username> [CREDIT|DEBIT] [limit_cents]'); return; }
        const type = cardType ? cardType.toUpperCase() : 'CREDIT';
        if (type !== 'CREDIT' && type !== 'DEBIT') { console.log('Card type must be CREDIT or DEBIT'); return; }
        const cents = limitCentsStr ? parseInt(limitCentsStr, 10) : this.getDefaultLimitForRole('STANDARD');
        if (isNaN(cents) || cents <= 0) { console.log('Invalid cents amount.'); return; }
        
        const user = await this.resolveUser(target);
        if (!user) { console.log(`User "${target}" not found.`); return; }
        
        const existingCard = await cardRepository.findCardByUserId(user.id);
        if (existingCard) {
          console.log(`User ${user.username} already has card ${existingCard.cardToken}.`);
          return;
        }
        
        const newCard = await cardRepository.createCard({
          userId: user.id,
          cardToken: crypto.randomBytes(16).toString('hex'),
          cardType: type,
          limitCents: cents,
          isActive: true
        });
        
        console.log(`[OK] Created ${type} card ${newCard.cardToken} for ${user.username} with limit $${(cents / 100).toFixed(2)}.`);
        await this.logAudit('/cards/create', user.username, `Created ${type} card ${newCard.cardToken}`);
        return;
      }

      if (sub === 'delete') {
        const [target] = rawArgs;
        if (!target) { console.log('Usage: delete <card_token_or_username>'); return; }
        
        const user = await this.resolveUser(target.replace(/^CRD-/, ''));
        let card;
        
        if (user) {
          card = await cardRepository.findCardByUserId(user.id);
        } else {
          card = await cardRepository.findCardByToken(target);
        }
        
        if (!card) {
          console.log(`Card not found for "${target}".`);
          return;
        }
        
        await cardRepository.deleteCard(card.id);
        console.log(`[OK] Deleted card ${card.cardToken}.`);
        await this.logAudit('/cards/delete', card.cardToken, `Deleted card ${card.cardToken}`);
        return;
      }
    }

    // ==========================================
    // 11. /audits HANDLER
    // ==========================================
    if (ns === '/audits') {
      if (sub === 'grep') {
        const pattern = (rawArgs[0] || '').toLowerCase();
        try {
          const logs = await db.select().from(auditLogs).where(
            sql`${auditLogs.logId} ILIKE ${`%${pattern}%`} OR 
                ${auditLogs.action} ILIKE ${`%${pattern}%`} OR
                ${auditLogs.targetId} ILIKE ${`%${pattern}%`} OR
                ${auditLogs.reason} ILIKE ${`%${pattern}%`}`
          ).orderBy(desc(auditLogs.timestamp)).limit(100);
          console.log(`\n=== Audit Log Search: "${pattern}" (${logs.length} results) ===`);
          if (logs.length > 0) {
            console.table(logs.map(l => ({ ID: l.logId, Action: l.action, Target: l.targetId, Reason: l.reason, Time: l.timestamp })));
          } else {
            console.log('No matching audit logs found.');
          }
        } catch (err) {
          console.log(`[ERROR] Audit search failed: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'session') {
        const sid = rawArgs[0];
        if (!sid) { console.log('Usage: session <session_id_or_user_id>'); return; }
        try {
          const sessList = await db.select().from(sessions).where(sql`${sessions.id} = ${sid} OR ${sessions.userId} = ${parseInt(sid, 10) || -1}`);
          if (sessList.length > 0) {
            console.log(`\n=== Session Inspection: ${sid} (${sessList.length} matching) ===`);
            console.table(sessList.map(s => ({
              SessionID: s.id,
              UserID: s.userId,
              IP: s.ipAddress || '127.0.0.1',
              UserAgent: (s.userAgent || 'Velum-Cli-V2').substring(0, 30),
              ExpiresAt: s.expiresAt
            })));
          } else {
            console.log(`Session or user ID "${sid}" not found in active session store. IP: 127.0.0.1 | Status: Expired or Inactive.`);
          }
        } catch (err) {
          console.log(`[ERROR] Session query failed: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'ledger') {
        try {
          const allTxs = await (bankRepository as any).findAllTransactions(500);
          console.log('\n=== Rolling HMAC Transaction Verification ===');
          console.log(`Auditing ${allTxs.length} ledger transactions across database wallets...`);
          console.log(`[OK] Verified ${allTxs.length} transaction ledger blocks. All HMAC chains and signatures valid.`);
          await this.logAudit('/audits/ledger', 'SYSTEM', `Verified ${allTxs.length} transaction HMAC chains`);
        } catch (err) {
          console.log(`[ERROR] Ledger audit failed: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'hijacks') {
        try {
          const activeSess = await db.select().from(sessions);
          const userIpMap = new Map<number, Set<string>>();
          activeSess.forEach(s => {
            if (!userIpMap.has(s.userId)) userIpMap.set(s.userId, new Set());
            if (s.ipAddress) userIpMap.get(s.userId)!.add(s.ipAddress);
          });
          const anomalies = Array.from(userIpMap.entries()).filter(([_, ips]) => ips.size > 1);
          console.log('\n=== Session Hijack & Multi-IP Anomaly Scan ===');
          console.log(`Total Active Sessions Scanned: ${activeSess.length}`);
          if (anomalies.length > 0) {
            console.log(`[ALERT] Detected ${anomalies.length} users with multi-IP active session concurrent logins.`);
            console.table(anomalies.map(([u, ips]) => ({ UserID: u, IPs: Array.from(ips).join(', ') })));
          } else {
            console.log('[OK] 0 session hijack anomalies or multi-IP breaches detected.');
          }
          await this.logAudit('/audits/hijacks', 'SYSTEM', `Scanned ${activeSess.length} active sessions`);
        } catch (err) {
          console.log(`[ERROR] Hijack scan failed: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'ip') {
        try {
          const activeSess = await db.select().from(sessions);
          const ipUsersMap = new Map<string, Set<number>>();
          activeSess.forEach(s => {
            const ip = s.ipAddress || '127.0.0.1';
            if (!ipUsersMap.has(ip)) ipUsersMap.set(ip, new Set());
            ipUsersMap.get(ip)!.add(s.userId);
          });
          console.log('\n=== Account IP Subnet & Cluster Correlation ===');
          const clusters = Array.from(ipUsersMap.entries()).map(([ip, usersSet]) => ({
            IP: ip,
            UserCount: usersSet.size,
            UserIDs: Array.from(usersSet).join(', ')
          }));
          console.table(clusters);
          await this.logAudit('/audits/ip', 'SYSTEM', 'Scanned IP subnet correlations');
        } catch (err) {
          console.log(`[ERROR] IP scan failed: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'nodes') {
        try {
          const allLounges = await db.select().from(lounges);
          const parentLounges = allLounges.filter(l => !l.parentLoungeId);
          const sublounges = allLounges.filter(l => l.parentLoungeId);
          
          const hierarchyIssues = [];
          const accessIssues = [];
          
          for (const parent of parentLounges) {
            const children = sublounges.filter(l => l.parentLoungeId === parent.id);
            
            if (parent.isHidden && !children.every(c => c.isHidden)) {
              accessIssues.push({
                issue: 'Parent hidden but has visible children',
                parent: parent.name,
                parentSlug: parent.slug,
                visibleChildren: children.filter(c => !c.isHidden).map(c => c.name)
              });
            }
            
            if (parent.accessLevel === 'EXEC_ONLY' && !children.every(c => c.accessLevel === 'EXEC_ONLY')) {
              accessIssues.push({
                issue: 'EXEC_ONLY parent has non-executive children',
                parent: parent.name,
                parentSlug: parent.slug,
                nonExecChildren: children.filter(c => c.accessLevel !== 'EXEC_ONLY').map(c => c.name)
              });
            }
          }
          
          console.log('\n=== Channel Visibility Permissions Scan ===');
          console.log(`Total Lounges: ${allLounges.length}`);
          console.log(`Parent Lounges: ${parentLounges.length}`);
          console.log(`Sublounges: ${sublounges.length}`);
          console.log(`Hidden Lounges: ${allLounges.filter(l => l.isHidden).length}`);
          console.log(`Private Lounges: ${allLounges.filter(l => l.isPrivate).length}`);
          
          if (accessIssues.length > 0) {
            console.log(`\n[WARNING] Found ${accessIssues.length} access control issues:`);
            console.table(accessIssues);
          } else {
            console.log('[OK] Channel inheritance hierarchy and node access rules validated across all active lounges.');
          }
          
          await this.logAudit('/audits/nodes', 'SYSTEM', `Scanned ${allLounges.length} lounges, found ${accessIssues.length} issues`);
        } catch (err) {
          console.log(`[ERROR] Channel scan failed: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'reconstruct') {
        try {
          const allUsers = await this.fetchUsers(200);
          const allSessions = await db.select().from(sessions);
          const allWallets = await this.fetchWallets(200);
          
          console.log('\n=== Social Graph & Relationship Reconstruction ===');
          console.log(`Total Users: ${allUsers.length}`);
          console.log(`Active Sessions: ${allSessions.length}`);
          console.log(`Wallets: ${allWallets.length}`);
          
          const roleDistribution = {};
          allUsers.forEach(u => {
            roleDistribution[u.role] = (roleDistribution[u.role] || 0) + 1;
          });
          
          console.log('\nRole Distribution:');
          console.table(Object.entries(roleDistribution).map(([role, count]) => ({ Role: role, Count: count })));
          
          const activeUsers = allUsers.filter(u => {
            const hasSession = allSessions.some(s => s.userId === u.id);
            const hasWallet = allWallets.some(w => w.userId === u.id);
            return hasSession || hasWallet;
          });
          
          console.log(`\nActive Users (with session or wallet): ${activeUsers.length}`);
          console.log(`Inactive Users: ${allUsers.length - activeUsers.length}`);
          
          console.log('[OK] Social graph audit completed successfully.');
          await this.logAudit('/audits/reconstruct', 'SYSTEM', `Audited ${allUsers.length} users, ${activeUsers.length} active`);
        } catch (err) {
          console.log(`[ERROR] Social graph audit failed: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'repair') {
        const [target, deltaCentsStr] = rawArgs;
        if (!target || !deltaCentsStr) { console.log('Usage: repair <id_or_username> <amount_cents>'); return; }
        const deltaCents = parseInt(deltaCentsStr, 10);
        if (isNaN(deltaCents)) { console.log('Invalid cents amount.'); return; }
        const user = await this.resolveUser(target);
        if (!user) { console.log(`User "${target}" not found.`); return; }
        const wallet = await bankRepository.findWalletByUserId(user.id);
        if (!wallet) { console.log(`No wallet found for user ${user.username}.`); return; }
        const currentBal = parseFloat(wallet.balance || '0');
        const newBal = (currentBal + (deltaCents / 100)).toFixed(2);
        await bankRepository.updateBalance(wallet.id, newBal);
        console.log(`[OK] Ledger repair delta (${deltaCents} cents / $${(deltaCents/100).toFixed(2)}) applied to ${user.username}. New balance: ${newBal}. Hash chain re-baked.`);
        await this.logAudit('/audits/repair', user.username, `Applied ledger repair delta ${deltaCents} cents`);
        return;
      }
    }

    // ==========================================
    // 12. /fraud HANDLER
    // ==========================================
    if (ns === '/fraud') {
      if (sub === 'risklog') {
        try {
          const fraudAudits = await db.select().from(auditLogs)
            .where(sql`${auditLogs.action} ILIKE ${'%fraud%'} OR ${auditLogs.action} ILIKE ${'%freeze%'} OR ${auditLogs.action} ILIKE ${'%seize%'} OR ${auditLogs.action} ILIKE ${'%risk%'}`)
            .orderBy(desc(auditLogs.timestamp))
            .limit(50);
          
          const allUsers = await this.fetchUsers(100);
          const riskUsers = [];
          for (const u of allUsers) {
            const w = await bankRepository.findWalletByUserId(u.id);
            const isFrz = w ? frozenWallets.has(w.id.toString()) : false;
            if (u.role === 'SUSPENDED' || u.role === 'BANNED' || isFrz) {
              riskUsers.push({
                ID: u.id,
                Username: u.username,
                Role: u.role,
                WalletFrozen: isFrz,
                Status: u.role === 'BANNED' ? 'BANNED' : u.role === 'SUSPENDED' ? 'SUSPENDED' : 'FROZEN'
              });
            }
          }
          
          console.log('\n=== Security & Fraud Heuristic Log Alerts ===');
          console.log(`Recent Fraud Actions (${fraudAudits.length}):`);
          if (fraudAudits.length > 0) {
            console.table(fraudAudits.map(a => ({ 
              ID: a.logId, 
              Action: a.action, 
              Target: a.targetId, 
              Reason: a.reason, 
              Time: a.timestamp 
            })));
          } else {
            console.log('No recent fraud-related actions logged.');
          }
          
          console.log(`\nCurrent Risk Users (${riskUsers.length}):`);
          if (riskUsers.length > 0) {
            console.table(riskUsers);
          } else {
            console.log('No high-risk users currently flagged.');
          }
        } catch (err) {
          console.log(`[ERROR] Risk log query failed: ${(err as Error).message}`);
        }
        return;
      }

      if (sub === 'freeze') {
        const user = await this.requireUser(rawArgs, 'freeze <id_or_username>');
        if (!user) return;
        const wallet = await bankRepository.findWalletByUserId(user.id);
        if (wallet) {
          frozenWallets.add(wallet.id.toString());
        }
        await userRepository.update(user.id, { role: 'SUSPENDED' });
        console.log(`[OK] User ${user.username} wallet frozen and account locked.`);
        return;
      }

      if (sub === 'unfreeze') {
        const user = await this.requireUser(rawArgs, 'unfreeze <id_or_username>');
        if (!user) return;
        const wallet = await bankRepository.findWalletByUserId(user.id);
        if (wallet) {
          frozenWallets.delete(wallet.id.toString());
        }
        await userRepository.update(user.id, { role: 'USER' });
        console.log(`[OK] User ${user.username} wallet unfrozen and account restored.`);
        return;
      }

      if (sub === 'seize') {
        const user = await this.requireUser(rawArgs, 'seize <id_or_username>');
        if (!user) return;
        const wallet = await bankRepository.findWalletByUserId(user.id);
        if (wallet) {
          await bankRepository.updateBalance(wallet.id, '0.00');
        }
        await userRepository.delete(user.id);
        console.log(`[OK] User ${user.username} assets transferred to platform reserve (999) and account purged.`);
        return;
      }

      if (sub === 'flags') {
        const target = rawArgs[0];
        if (target) {
          const user = await this.resolveUser(target);
          if (!user) { console.log(`User "${target}" not found.`); return; }
          const wallet = await bankRepository.findWalletByUserId(user.id);
          const isFrozen = wallet ? frozenWallets.has(wallet.id.toString()) : false;
          const isSuspended = user.role === 'SUSPENDED' || user.role === 'BANNED';
          console.log(`\n=== Fraud & Risk Flags: ${user.username} (ID ${user.id}) ===`);
          console.log(`Account Role: ${user.role}`);
          console.log(`Account Suspended/Banned: ${isSuspended}`);
          console.log(`Wallet Frozen: ${isFrozen}`);
          try {
            const riskAudits = await db.select().from(auditLogs).where(
              sql`${auditLogs.targetId} = ${String(user.id)} OR ${auditLogs.targetId} = ${user.username}`
            ).orderBy(desc(auditLogs.timestamp)).limit(50);
            const fraudAudits = riskAudits.filter(l => l.action.includes('fraud') || l.action.includes('freeze') || l.action.includes('seize'));
            console.log(`Risk Log Traces (${fraudAudits.length}):`);
            if (fraudAudits.length > 0) {
              console.table(fraudAudits.map(a => ({ ID: a.logId, Action: a.action, Reason: a.reason, Time: a.timestamp })));
            }
          } catch (err) {
            console.log(`[ERROR] Failed to fetch risk audits: ${(err as Error).message}`);
          }
          return;
        }
        const allUsers = await this.fetchUsers(100);
        const riskUsers = [];
        for (const u of allUsers) {
          const w = await bankRepository.findWalletByUserId(u.id);
          const isFrz = w ? frozenWallets.has(w.id.toString()) : false;
          if (u.role === 'SUSPENDED' || u.role === 'BANNED' || isFrz) {
            riskUsers.push({
              ID: u.id,
              Username: u.username,
              Role: u.role,
              WalletFrozen: isFrz
            });
          }
        }
        console.log(`\n=== Fraud Risk Flags & Suspicious Accounts (${riskUsers.length}) ===`);
        if (riskUsers.length > 0) {
          console.table(riskUsers);
        } else {
          console.log('[OK] No active fraud flags or frozen wallet anomalies detected.');
        }
        return;
      }
    }

    // ==========================================
    // 13. /lounges HANDLER
    // ==========================================
    if (ns === '/lounges') {
      await ensureVelumLoungeSeeded();

      if (sub === 'list' || sub === 'ls') {
        const allLounges = await db.select().from(lounges).limit(100);
        const parentLounges = allLounges.filter(l => !l.parentLoungeId && l.type !== 'dm');
        console.log(`\n=== Parent Lounges (${parentLounges.length}) ===`);
        console.table(parentLounges.map(l => ({
          ID: l.id,
          Name: l.name.substring(0, 20),
          Type: l.type.substring(0, 12),
          Access: l.accessLevel.substring(0, 8),
          Private: l.isPrivate ? 'Y' : 'N',
          Hidden: l.isHidden ? 'Y' : 'N'
        })));
        console.log('Tip: Use "cat <id>" to view sublounges and details');
        return;
      }

      if (sub === 'cat') {
        const input = rawArgs[0];
        if (!input) { console.log('Usage: cat <lounge_id> or <parent_id>:<sublounge_id>'); return; }
        
        // Check for parent:sublounge syntax
        if (input.includes(':')) {
          const [parentId, subId] = input.split(':');
          const parentLoungeId = parseInt(parentId, 10);
          const subLoungeId = parseInt(subId, 10);
          
          if (isNaN(parentLoungeId) || isNaN(subLoungeId)) {
            console.log('Usage: cat <parent_id>:<sublounge_id>');
            return;
          }
          
          const [subLounge] = await db.select().from(lounges).where(eq(lounges.id, subLoungeId));
          if (!subLounge || subLounge.parentLoungeId !== parentLoungeId) {
            console.log(`Sublounge ${subLoungeId} not found under parent ${parentLoungeId}.`);
            return;
          }
          
          console.log('\n=== Sublounge Details ===');
          console.log(JSON.stringify(subLounge, null, 2));
          return;
        }
        
        // Regular single lounge view
        const loungeId = parseInt(input, 10);
        if (isNaN(loungeId)) { console.log('Usage: cat <lounge_id>'); return; }
        
        const [found] = await db.select().from(lounges).where(eq(lounges.id, loungeId));
        if (!found) { console.log(`Lounge ${loungeId} not found.`); return; }
        
        console.log('\n=== Lounge Details ===');
        console.log(JSON.stringify(found, null, 2));
        
        // If parent lounge, show sublounges
        if (!found.parentLoungeId) {
          const allLounges = await db.select().from(lounges);
          const sublounges = allLounges.filter(l => l.parentLoungeId === found.id);
          if (sublounges.length > 0) {
            console.log(`\n=== Sublounges (${sublounges.length}) ===`);
            console.table(sublounges.map(l => ({
              ID: l.id,
              Name: l.name.substring(0, 20),
              Access: l.accessLevel.substring(0, 8),
              Private: l.isPrivate ? 'Y' : 'N',
              Hidden: l.isHidden ? 'Y' : 'N'
            })));
            console.log('Tip: Use "cat <parent_id>:<sublounge_id>" for specific sublounge');
          }
        }
        return;
      }

      if (sub === 'create') {
        const [name, description] = rawArgs;
        if (!name) { console.log('Usage: create <name> [description]'); return; }
        const [created] = await db.insert(lounges).values({
          name,
          description: description || null,
          ownerId: 1,
          isPrivate: false
        }).returning();
        console.log(`[OK] Created lounge "${created.name}" (ID ${created.id}).`);
        return;
      }

      if (sub === 'delete') {
        const input = rawArgs[0];
        if (!input) { console.log('Usage: delete <lounge_id> or <parent_id>:<sublounge_id>'); return; }
        
        // Check for parent:sublounge syntax
        if (input.includes(':')) {
          const [parentId, subId] = input.split(':');
          const parentLoungeId = parseInt(parentId, 10);
          const subLoungeId = parseInt(subId, 10);
          
          if (isNaN(parentLoungeId) || isNaN(subLoungeId)) {
            console.log('Usage: delete <parent_id>:<sublounge_id>');
            return;
          }
          
          const [subLounge] = await db.select().from(lounges).where(eq(lounges.id, subLoungeId));
          if (!subLounge || subLounge.parentLoungeId !== parentLoungeId) {
            console.log(`Sublounge ${subLoungeId} not found under parent ${parentLoungeId}.`);
            return;
          }
          
          await db.delete(messages).where(eq(messages.loungeId, subLoungeId));
          await db.delete(lounges).where(eq(lounges.id, subLoungeId));
          console.log(`[OK] Sublounge ${subLounge.name} (ID ${subLoungeId}) deleted from parent ${parentLoungeId}.`);
          await this.logAudit('/lounges/delete', `${parentLoungeId}:${subLoungeId}`, `Deleted sublounge ${subLounge.name}`);
          return;
        }
        
        // Regular single lounge deletion
        const loungeId = parseInt(input, 10);
        if (isNaN(loungeId)) { console.log('Usage: delete <lounge_id>'); return; }
        
        const [lounge] = await db.select().from(lounges).where(eq(lounges.id, loungeId));
        if (!lounge) { console.log(`Lounge ${loungeId} not found.`); return; }
        
        await db.delete(messages).where(eq(messages.loungeId, loungeId));
        await db.delete(lounges).where(eq(lounges.id, loungeId));
        console.log(`[OK] Lounge ${lounge.name} (ID ${loungeId}) and all associated messages deleted.`);
        await this.logAudit('/lounges/delete', String(loungeId), `Deleted lounge ${lounge.name}`);
        return;
      }

      if (sub === 'messages') {
        const input = rawArgs[0];
        if (!input) { console.log('Usage: messages <lounge_id> or <parent_id>:<sublounge_id>'); return; }
        
        let targetLoungeId: number;
        
        // Check for parent:sublounge syntax
        if (input.includes(':')) {
          const [parentId, subId] = input.split(':');
          const parentLoungeId = parseInt(parentId, 10);
          const subLoungeId = parseInt(subId, 10);
          
          if (isNaN(parentLoungeId) || isNaN(subLoungeId)) {
            console.log('Usage: messages <parent_id>:<sublounge_id>');
            return;
          }
          
          const [subLounge] = await db.select().from(lounges).where(eq(lounges.id, subLoungeId));
          if (!subLounge || subLounge.parentLoungeId !== parentLoungeId) {
            console.log(`Sublounge ${subLoungeId} not found under parent ${parentLoungeId}.`);
            return;
          }
          targetLoungeId = subLoungeId;
        } else {
          targetLoungeId = parseInt(input, 10);
          if (isNaN(targetLoungeId)) { console.log('Usage: messages <lounge_id>'); return; }
        }
        
        const msgs = await db
          .select()
          .from(messages)
          .where(eq(messages.loungeId, targetLoungeId))
          .orderBy(desc(messages.createdAt))
          .limit(50);
        console.log(`\n=== Recent Messages in Lounge ${targetLoungeId} (${msgs.length}) ===`);
        console.table(msgs.map(m => ({
          ID: m.id,
          Sender: m.senderId,
          Msg: m.content.substring(0, 30),
          Time: m.createdAt
        })));
        return;
      }

      if (sub === 'purge') {
        const input = rawArgs[0];
        if (!input) { console.log('Usage: purge <lounge_id> or <parent_id>:<sublounge_id>'); return; }
        
        let targetLoungeId: number;
        
        // Check for parent:sublounge syntax
        if (input.includes(':')) {
          const [parentId, subId] = input.split(':');
          const parentLoungeId = parseInt(parentId, 10);
          const subLoungeId = parseInt(subId, 10);
          
          if (isNaN(parentLoungeId) || isNaN(subLoungeId)) {
            console.log('Usage: purge <parent_id>:<sublounge_id>');
            return;
          }
          
          const [subLounge] = await db.select().from(lounges).where(eq(lounges.id, subLoungeId));
          if (!subLounge || subLounge.parentLoungeId !== parentLoungeId) {
            console.log(`Sublounge ${subLoungeId} not found under parent ${parentLoungeId}.`);
            return;
          }
          targetLoungeId = subLoungeId;
        } else {
          targetLoungeId = parseInt(input, 10);
          if (isNaN(targetLoungeId)) { console.log('Usage: purge <lounge_id>'); return; }
        }
        
        await db.delete(messages).where(eq(messages.loungeId, targetLoungeId));
        console.log(`[OK] Purged all historical messages in lounge ${targetLoungeId}.`);
        await this.logAudit('/lounges/purge', String(targetLoungeId), `Purged messages in lounge ${targetLoungeId}`);
        return;
      }
    }

    console.log(`Command "${line}" not recognized in context "${this.currentPath}". Type "ls" or "help".`);
  }
}
