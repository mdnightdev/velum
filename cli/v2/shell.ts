import readline from 'readline';
import { V2_COMMAND_REGISTRY } from './registry.js';
import { theme, riskColor, namespaceMaxRisk } from './theme.js';
import { formatTable, printDetail } from './table.js';
import { logAudit } from './helpers.js';
import { handleUsersCommand } from './handlers/usersHandler.js';
import { handleDbCommand } from './handlers/dbHandler.js';
import { handleDevopsCommand } from './handlers/devopsHandler.js';
import { handleBankCommand } from './handlers/bankHandler.js';
import { handleMarketCommand } from './handlers/marketHandler.js';
import { handleLoungesCommand } from './handlers/loungesHandler.js';
import { handleSanctionsCommand } from './handlers/sanctionsHandler.js';

export class VelumV2Shell {
  private currentPath: string = '/';
  private rl: readline.Interface | null = null;

  public setReadline(rl: readline.Interface) {
    this.rl = rl;
  }

  public getCompletions(line: string): [string[], string] {
    const namespaces = Object.keys(V2_COMMAND_REGISTRY);
    const globalVerbs = ['cd', 'ls', 'help', 'clear', 'pwd', 'man', 'exit', 'quit'];

    const trimmed = line.trimStart();
    const parts = trimmed.split(/\s+/);

    if (parts.length <= 1) {
      const candidates = [
        ...namespaces,
        ...globalVerbs,
        ...(V2_COMMAND_REGISTRY[this.currentPath] ? Object.keys(V2_COMMAND_REGISTRY[this.currentPath]) : [])
      ];
      const hits = candidates.filter((c) => c.startsWith(trimmed));
      return [hits.length ? hits : candidates, trimmed];
    }

    if (parts[0] === 'cd' || parts[0] === 'man') {
      const hits = namespaces.filter((n) => n.startsWith(parts[1] || ''));
      return [hits.length ? hits : namespaces, parts[1] || ''];
    }

    let targetNs = this.currentPath;
    let cmdPrefix = parts[1] || '';
    if (parts[0].startsWith('/')) {
      targetNs = parts[0];
    } else {
      cmdPrefix = parts[0];
    }

    const available = V2_COMMAND_REGISTRY[targetNs]
      ? Object.keys(V2_COMMAND_REGISTRY[targetNs])
      : [];
    const hits = available.filter((c) => c.startsWith(cmdPrefix));
    return [hits.length ? hits : available, cmdPrefix];
  }

  public printPrompt(): void {
    const nsRisk = namespaceMaxRisk(this.currentPath);
    const riskBadge =
      this.currentPath !== '/'
        ? ` ${riskColor(nsRisk)}[${nsRisk}]${theme.reset}`
        : '';
    process.stdout.write(
      `${theme.cyan}velum-v2${theme.reset}:${theme.yellow}${this.currentPath}${theme.reset}${riskBadge}$ `
    );
  }

  private parseCommandLine(line: string): { verb: string; args: string[]; flags: Record<string, any> } | null {
    const trimmed = line.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(/\s+/);
    const verb = parts[0];
    const args: string[] = [];
    const flags: Record<string, any> = {};

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith('--')) {
        const flagName = part.substring(2);
        if (i + 1 < parts.length && !parts[i + 1].startsWith('-')) {
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

  private printManPage(ns: string, sub: string): void {
    const meta = V2_COMMAND_REGISTRY[ns]?.[sub];
    if (!meta) {
      console.log(`No manual entry for "${ns}/${sub}".`);
      return;
    }
    printDetail(`Manual: ${ns}/${sub}`, {
      Description: meta.desc,
      Risk: `${riskColor(meta.risk)}${meta.risk}${theme.reset}`,
      Arguments: meta.args?.length ? meta.args.join(' ') : 'None',
      Flags: meta.flags ? Object.keys(meta.flags).join(', ') : 'None'
    });
  }

  private async confirmAction(
    ns: string,
    sub: string,
    risk: 'HIGH' | 'CRITICAL'
  ): Promise<{ confirmed: boolean; reason?: string }> {
    if (!this.rl) return { confirmed: true };
    const color = riskColor(risk);
    console.log(
      `\n${color}⚠️  SECURITY WARNING: [${risk}] Action "${ns}/${sub}" requires confirmation.${theme.reset}`
    );

    const answer = await new Promise<string>((resolve) => {
      this.rl!.question(`Type "CONFIRM" to execute: `, resolve);
    });

    if (answer.trim() !== 'CONFIRM') {
      return { confirmed: false };
    }

    const reason = await new Promise<string>((resolve) => {
      this.rl!.question(`Enter reason for audit log: `, resolve);
    });

    return { confirmed: true, reason: reason.trim() || 'CLI Operator Confirmation' };
  }

  public async runCommand(line: string): Promise<void> {
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
    /users            - User Account Lifecycle & Deletions
    /sanctions        - Moderation Actions & Audit Logs
    /db               - Database Health & Read-Only Diagnostics
    /market           - Marketplace Controls & Listings
    /lounges          - Community & Lounge Moderation
    /devops           - System Configuration & Maintenance
    /bank             - Banking, Wallets & Reserves
`);
      return;
    }

    if (fullCmd === 'cd') {
      const target = rawArgs[0];
      if (!target || target === '/' || target === '~') {
        this.currentPath = '/';
      } else if (target === '..') {
        this.currentPath = '/';
      } else {
        const normalized = target.startsWith('/') ? target : `/${target}`;
        if (V2_COMMAND_REGISTRY[normalized]) {
          this.currentPath = normalized;
        } else {
          console.log(`Namespace "${target}" does not exist.`);
        }
      }
      return;
    }

    if (fullCmd === 'man') {
      const target = rawArgs[0];
      if (!target) {
        console.log('Usage: man <command> or man <namespace> <command>');
        return;
      }
      let targetNs = this.currentPath;
      let targetSub = target;
      if (rawArgs.length > 1) {
        targetNs = target.startsWith('/') ? target : `/${target}`;
        targetSub = rawArgs[1];
      }
      this.printManPage(targetNs, targetSub);
      return;
    }

    if (fullCmd === 'ls') {
      if (this.currentPath === '/') {
        console.log('\nAvailable Administrative Namespaces:');
        for (const [nsPath] of Object.entries(V2_COMMAND_REGISTRY)) {
          const maxR = namespaceMaxRisk(nsPath);
          console.log(`  ${theme.cyan}${nsPath.padEnd(16)}${theme.reset} ${riskColor(maxR)}[${maxR}]${theme.reset}`);
        }
      } else {
        const commands = V2_COMMAND_REGISTRY[this.currentPath] || {};
        console.log(`\nCommands in ${this.currentPath}:`);
        for (const [cmdName, meta] of Object.entries(commands)) {
          console.log(`  ${theme.green}${cmdName.padEnd(18)}${theme.reset} ${riskColor(meta.risk)}[${meta.risk.padEnd(8)}]${theme.reset} ${meta.desc}`);
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

    if (flags['h'] || flags['help']) {
      this.printManPage(ns, sub);
      return;
    }

    const gateMeta = V2_COMMAND_REGISTRY[ns]?.[sub];
    let auditReason = 'CLI V2 Administrative Action';

    if (gateMeta && (gateMeta.risk === 'HIGH' || gateMeta.risk === 'CRITICAL')) {
      const { confirmed, reason } = await this.confirmAction(ns, sub, gateMeta.risk);
      if (!confirmed) {
        console.log('Aborted — no changes made.');
        return;
      }
      if (reason) auditReason = reason;
      await logAudit(`${ns}/${sub}`, rawArgs.join(' ') || 'SYSTEM', auditReason);
    }

    // Namespace Dispatchers
    if (ns === '/users') {
      await handleUsersCommand(sub, rawArgs, flags);
      return;
    }

    if (ns === '/db') {
      await handleDbCommand(sub, rawArgs);
      return;
    }

    if (ns === '/devops') {
      await handleDevopsCommand(sub, rawArgs);
      return;
    }

    if (ns === '/bank') {
      await handleBankCommand(sub, rawArgs);
      return;
    }

    if (ns === '/market') {
      await handleMarketCommand(sub, rawArgs);
      return;
    }

    if (ns === '/lounges') {
      await handleLoungesCommand(sub, rawArgs);
      return;
    }

    if (ns === '/sanctions') {
      await handleSanctionsCommand(sub, rawArgs);
      return;
    }

    console.log(`Unknown command "${fullCmdRaw}". Type "help" or "ls" to view commands.`);
  }

  public async start(): Promise<void> {
    this.printPrompt();
    if (this.rl) {
      this.rl.on('line', async (line) => {
        try {
          await this.runCommand(line);
        } catch (err) {
          console.error(`${theme.red}[UNHANDLED CLI ERROR] ${(err as Error).message}${theme.reset}`);
        }
        this.printPrompt();
      });
    }
  }
}
