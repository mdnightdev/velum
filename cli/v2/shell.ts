import readline from 'readline';
import { V2_COMMAND_REGISTRY } from './registry.js';
import { theme } from './theme.js';
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
    const namespaces = Object.keys(V2_COMMAND_REGISTRY).map(n => n.replace(/^\//, ''));
    const globalVerbs = ['cd', 'ls', 'help', 'clear', 'pwd', 'man', 'exit', 'quit'];
    const currentCmds = this.currentPath !== '/' && V2_COMMAND_REGISTRY[this.currentPath]
      ? Object.keys(V2_COMMAND_REGISTRY[this.currentPath])
      : [];

    const candidates = [...new Set([...namespaces, ...globalVerbs, ...currentCmds])];
    const trimmed = line.trimStart();
    const hits = candidates.filter(c => c.startsWith(trimmed));
    return [hits.length ? hits : candidates, trimmed];
  }

  public printPrompt(): void {
    const displayPath = this.currentPath === '/' ? '' : `:${this.currentPath.replace(/^\//, '')}`;
const promptStr = `${theme.cyan}velum${theme.reset}${theme.yellow}${displayPath}${theme.reset}$ `;
    if (this.rl) {
      this.rl.setPrompt(promptStr);
      this.rl.prompt(true);
    } else {
      process.stdout.write(promptStr);
    }
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

  private async confirm(action: string): Promise<boolean> {
    if (!this.rl) return true;
    const answer = await new Promise<string>((resolve) => {
      this.rl!.question(`Proceed with ${action}? (y/n): `, resolve);
    });
    const norm = answer.trim().toLowerCase();
    return norm === 'y' || norm === 'yes';
  }

  public async runCommand(line: string): Promise<void> {
    const parsed = this.parseCommandLine(line);
    if (!parsed) return;
    const { verb: fullCmdRaw, args: rawArgs, flags } = parsed;
    const fullCmd = fullCmdRaw.toLowerCase();

    if (fullCmd === 'exit' || fullCmd === 'quit') {
      process.exit(0);
    }

    if (fullCmd === 'clear' || fullCmd === 'cls') {
      process.stdout.write('\x1b[2J\x1b[3J\x1b[H\x1bc');
      return;
    }

    if (fullCmd === 'pwd') {
      console.log(this.currentPath);
      return;
    }

    if (fullCmd === 'cd') {
      const target = rawArgs[0];
      if (!target || target === '/' || target === '~' || target === '..') {
        this.currentPath = '/';
      } else {
        const normalized = target.startsWith('/') ? target : `/${target}`;
        if (V2_COMMAND_REGISTRY[normalized]) {
          this.currentPath = normalized;
        } else {
          console.log(`Directory "${target}" not found.`);
        }
      }
      return;
    }

    if (fullCmd === 'ls') {
      const items = this.currentPath === '/'
        ? Object.keys(V2_COMMAND_REGISTRY).map(k => k.replace(/^\//, ''))
        : Object.keys(V2_COMMAND_REGISTRY[this.currentPath] || {});
      
      for (let i = 0; i < items.length; i += 4) {
        console.log(items.slice(i, i + 4).map(item => item.padEnd(16)).join(''));
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
        sub = rawArgs[0] || 'list';
        if (rawArgs.length > 0) rawArgs.shift();
      }
    } else if (this.currentPath === '/') {
      if (['list', 'view', 'create', 'deactivate', 'cancel', 'restore', 'pending', 'purge'].includes(fullCmd)) {
        ns = '/users';
      } else if (['wallets', 'tx', 'wire', 'fundc', 'fundt', 'funde', 'bankf', 'bankad'].includes(fullCmd)) {
        ns = '/bank';
      } else if (['config', 'maint', 'fee', 'tax', 'rate'].includes(fullCmd)) {
        ns = '/devops';
      } else if (['integrity', 'orphans', 'clean', 'vacuum', 'wipe'].includes(fullCmd)) {
        ns = '/db';
      }
    }

    // High risk actions simple y/n prompt
    const isHighRisk = sub === 'purge' || sub === 'wipe' || sub === 'clean' || sub === 'vacuum';
    if (isHighRisk) {
      const ok = await this.confirm(`${ns}/${sub}`);
      if (!ok) {
        console.log('Aborted.');
        return;
      }
    }

    // Delegate directly to modular handlers
    if (ns === '/users') return handleUsersCommand(sub, rawArgs, flags);
    if (ns === '/db') return handleDbCommand(sub, rawArgs);
    if (ns === '/devops') return handleDevopsCommand(sub, rawArgs);
    if (ns === '/bank') return handleBankCommand(sub, rawArgs);
    if (ns === '/market') return handleMarketCommand(sub, rawArgs);
    if (ns === '/lounges') return handleLoungesCommand(sub, rawArgs);
    if (ns === '/sanctions') return handleSanctionsCommand(sub, rawArgs);

    console.log(`Command not found: ${fullCmdRaw}`);
  }

  public async start(): Promise<void> {
    this.printPrompt();
    if (this.rl) {
      this.rl.on('line', async (line) => {
        try {
          await this.runCommand(line);
        } catch (err) {
          console.error(`[ERROR] ${(err as Error).message}`);
        }
        this.printPrompt();
      });
    }
  }
}
