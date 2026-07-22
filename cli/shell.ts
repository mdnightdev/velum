import readline from 'readline';
import { COMMAND_REGISTRY, CommandMeta } from './registry.ts';
import { executeCliCommand } from '../server/db.ts';
import { loadDb } from '../server/db/index.ts';

export class VelumShell {
  private currentPath: string = '/';
  private rl: readline.Interface | null = null;
  private isExecuting: boolean = false;

  constructor() {}

  /**
   * Start the interactive readline shell loop
   */
  public start(rlInterface: readline.Interface): void {
    this.rl = rlInterface;
    this.promptUser();
  }

  /**
   * Main prompt loop
   */
  private promptUser(): void {
    if (!this.rl) return;

    // Refresh database caches in real-time before prompting command entry, silencing load progress logging
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    try {
      console.log = () => {};
      console.warn = () => {};
      console.error = () => {};
      loadDb(true);
    } catch (err: any) {
      originalLog(`DATABASE LOAD ERROR: ${err.message || err}`);
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }

    const pathColor = '\x1b[36m'; // Cyan
    const promptColor = '\x1b[32m\x1b[1m'; // Bold Green
    const arrowColor = '\x1b[33m\x1b[1m'; // Bold Yellow
    const resetColor = '\x1b[0m';
    const promptString = `${promptColor}velum-cli${resetColor} ${pathColor}${this.currentPath}${resetColor}${arrowColor}>${resetColor} `;

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

      if (!this.isExecuting) {
        this.promptUser();
      }
    });
  }

  /**
   * Parses inputs, checks for navigation and help requests, then routes to dispatchers
   */
  private async handleInput(line: string): Promise<void> {
    const parsed = this.parseCommandLine(line);
    if (!parsed) return;

    const { verb, args, flags } = parsed;

    // Handle global shell navigation commands
    if (this.handleGlobalShellCommands(verb, args, flags)) {
      return;
    }

    // Resolve command mapping and target namespace
    const resolved = this.resolveCommand(verb);
    if (!resolved) {
      console.log(`Command not recognized in context "${this.currentPath}". Type "help" or "ls" to list valid entries.`);
      return;
    }

    const { cmdName, nsPath, meta } = resolved;

    // Intercept contextual help flags: -h or --help
    if (flags['h'] || flags['help']) {
      this.printCommandHelp(nsPath, cmdName, meta);
      return;
    }

    await this.executeCommand(line, resolved, args, flags);
  }

  /**
   * Handles cd, ls, pwd, clear, exit, help, man
   */
  private handleGlobalShellCommands(verb: string, args: string[], flags: Record<string, any>): boolean {
    const lowerVerb = verb.toLowerCase();

    if (lowerVerb === 'exit' || lowerVerb === 'quit') {
      console.log('Terminating administrative console session.');
      process.exit(0);
    }

    if (lowerVerb === 'clear' || lowerVerb === 'cls') {
      console.clear();
      return true;
    }

    if (lowerVerb === 'pwd') {
      console.log(this.currentPath);
      return true;
    }

    if (lowerVerb === 'help' || lowerVerb === '?') {
      this.printGlobalHelp();
      return true;
    }

    if (lowerVerb === 'cd') {
      let dest = args[0];
      if (!dest) {
        this.currentPath = '/';
        return true;
      }

      if (dest === '/') {
        this.currentPath = '/';
        return true;
      }

      if (dest === '..') {
        if (this.currentPath === '/') return true;
        const segments = this.currentPath.split('/');
        segments.pop();
        this.currentPath = segments.join('/') || '/';
        return true;
      }

      if (!dest.startsWith('/')) {
        dest = (this.currentPath === '/' ? '' : this.currentPath) + '/' + dest;
      }

      if (COMMAND_REGISTRY[dest] || dest === '/') {
        this.currentPath = dest;
      } else {
        console.log(`ERROR: Context path "${dest}" not recognized.`);
      }
      return true;
    }

    if (lowerVerb === 'ls') {
      const isLong = flags['l'] === true;

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
          { name: 'fraud',    desc: 'Fraud Prevention' }
        ];

        if (isLong) {
          console.log();
          console.log('\x1b[90mdrwxr-xr-x\x1b[0m  \x1b[36m%-8s\x1b[0m  \x1b[90m%4s\x1b[0m  \x1b[33m%-12s\x1b[0m  %s'.replace(/%/g, '%-'), 'NAME', 'RISK', 'ACCESS', 'DESCRIPTION'.padEnd(35));
          console.log('\x1b[90m' + '-'.repeat(85) + '\x1b[0m');
          namespaces.forEach((ns, idx) => {
            const riskLevel = ['LOW','LOW','LOW','LOW','LOW','LOW','HIGH','LOW','MEDIUM','HIGH','LOW','MEDIUM'][idx] || 'LOW';
            let riskColor = '\x1b[32m'; // LOW: Green
            if (riskLevel === 'MEDIUM') riskColor = '\x1b[33m';
            else if (riskLevel === 'HIGH') riskColor = '\x1b[91m';
            else if (riskLevel === 'CRITICAL') riskColor = '\x1b[31m\x1b[1m';
            const formattedRisk = `${riskColor}${riskLevel}\x1b[0m`;
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
        const cmds = COMMAND_REGISTRY[this.currentPath];
        if (!cmds) {
          console.log(`ERROR: Context path "${this.currentPath}" not found.`);
          return true;
        }

        if (isLong) {
          console.log();
          console.log('\x1b[90m-r-xr-x---\x1b[0m  \x1b[36m%-25s\x1b[0m  \x1b[90m%8s\x1b[0m  \x1b[33m%-12s\x1b[0m  %s'.replace(/%/g, '%-'), 'COMMAND', 'RISK', 'ACCESS', 'DESCRIPTION'.padEnd(40));
          console.log('\x1b[90m' + '-'.repeat(95) + '\x1b[0m');
          for (const [name, meta] of Object.entries(cmds)) {
            let perm = '\x1b[90m-r-x------\x1b[0m';
            let riskColor = '\x1b[32m'; // LOW: Green
            if (meta.risk === 'MEDIUM') {
              perm = '\x1b[90m-r-xr-x---\x1b[0m';
              riskColor = '\x1b[33m'; // MEDIUM: Yellow
            } else if (meta.risk === 'HIGH') {
              perm = '\x1b[90m-r-xr-x---\x1b[0m';
              riskColor = '\x1b[91m'; // HIGH: Light Red
            } else if (meta.risk === 'CRITICAL') {
              perm = '\x1b[90m-rwxrwxrwx\x1b[0m';
              riskColor = '\x1b[31m\x1b[1m'; // CRITICAL: Bold Red
            }
            const formattedRisk = `${riskColor}[${meta.risk}]\x1b[0m`.padEnd(14);
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
      return true;
    }

    if (lowerVerb === 'man') {
      const target = args[0];
      if (!target) {
        console.log('What manual page do you want?');
        return true;
      }

      const resolved = this.resolveCommand(target);
      if (!resolved) {
        console.log(`No manual entry for ${target}`);
        return true;
      }

      const { cmdName, nsPath, meta } = resolved;
      const fullPath = (nsPath === '/' ? '' : nsPath) + '/' + cmdName;

      console.log(`\n\x1b[33m\x1b[1mVELUM MANUAL PAGE: ${cmdName.toUpperCase()}\x1b[0m`);
      console.log('\x1b[90m' + '='.repeat(50) + '\x1b[0m');
      console.log(`\x1b[32m\x1b[1mNAME\x1b[0m\n    ${cmdName} - ${meta.desc}\n`);
      console.log(`\x1b[32m\x1b[1mPATH\x1b[0m\n    ${fullPath}\n`);
      
      const syntax = meta.args && meta.args.length > 0
        ? `${cmdName} ${meta.args.join(' ')}`
        : cmdName;
      console.log(`\x1b[32m\x1b[1mSYNOPSIS\x1b[0m\n    ${syntax}\n`);
      console.log(`\x1b[32m\x1b[1mRISK LEVEL\x1b[0m\n    ${meta.risk}\n`);

      if (meta.flags && Object.keys(meta.flags).length > 0) {
        console.log('\x1b[32m\x1b[1mOPTIONS\x1b[0m');
        for (const [flag, desc] of Object.entries(meta.flags)) {
          console.log(`    \x1b[36m${flag.padEnd(25)}\x1b[0m ${desc}`);
        }
        console.log();
      }
      console.log('\x1b[90m' + '='.repeat(50) + '\x1b[0m\n');
      return true;
    }

    return false;
  }

  /**
   * Resolves command paths in relative or absolute namespaces
   */
  private resolveCommand(rawVerb: string): { cmdName: string; nsPath: string; meta: CommandMeta } | null {
    let cmdName = '';
    let nsPath = this.currentPath;

    if (rawVerb.startsWith('/')) {
      const segments = rawVerb.split('/');
      cmdName = segments.pop() || '';
      nsPath = segments.join('/');
      if (nsPath === '') nsPath = '/';
    } else {
      cmdName = rawVerb;
    }

    const namespace = COMMAND_REGISTRY[nsPath];
    if (namespace && namespace[cmdName]) {
      return { cmdName, nsPath, meta: namespace[cmdName] };
    }

    return null;
  }

  /**
   * Formats and prints command-specific contextual help
   */
  private printCommandHelp(nsPath: string, cmdName: string, meta: CommandMeta): void {
    const fullCommandPath = (nsPath === '/' ? '' : nsPath) + '/' + cmdName;
    console.log(`\n=== COMMAND REFERENCE HELP ===`);
    console.log(`Path:        ${fullCommandPath}`);
    console.log(`Description: ${meta.desc}`);
    console.log(`Risk Level:  \x1b[1m${meta.risk}\x1b[0m`);

    if (meta.args && meta.args.length > 0) {
      console.log(`Syntax:      ${cmdName} ${meta.args.join(' ')}`);
    } else {
      console.log(`Syntax:      ${cmdName}`);
    }

    if (meta.flags && Object.keys(meta.flags).length > 0) {
      console.log(`Flags:`);
      for (const [flag, desc] of Object.entries(meta.flags)) {
        console.log(`  ${flag.padEnd(25)} - ${desc}`);
        
      }
    }
    console.log(`==============================\n`);
  }

  /**
   * Prints the global catalog of namespaces and commands
   */
  private printGlobalHelp(): void {
    console.log(`
  === VELUM SECURE ADMINISTRATIVE CONSOLE ===
  
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
    
  Tip:
    - You can run absolute commands from anywhere (e.g. /sys/status).
    - Append "-h" or "--help" to any command for specific details (e.g. ban -h).
`);
  }

  /**
   * Command line parser supporting quotes and flag extractions
   */
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

  /**
   * Executes resolved commands and enforces Risk-Tier confirmations locally
   */
  private async executeCommand(
    line: string,
    resolved: { cmdName: string; nsPath: string; meta: CommandMeta },
    args: string[],
    flags: Record<string, any>
  ): Promise<void> {
    const { cmdName, nsPath, meta } = resolved;
    const fullPath = (nsPath === '/' ? '' : nsPath) + '/' + cmdName;

    // Standardize input prefixing for relative paths so the backend executeCliCommand resolves it correctly
    let commandToExec = line;
    if (!line.trim().startsWith('/')) {
      const firstSpace = line.indexOf(' ');
      const verb = firstSpace === -1 ? line : line.substring(0, firstSpace);
      const rest = firstSpace === -1 ? '' : line.substring(firstSpace);
      const prefix = this.currentPath === '/' ? '' : this.currentPath;
      commandToExec = `${prefix}/${verb}${rest}`;
    }

    if (meta.risk === 'LOW') {
      await this.runDbCommand(commandToExec);
      return;
    }

    // Enforce Risk Tier Verification
    console.log(`\n\x1b[1m\x1b[33m[SECURITY VERIFICATION REQUIRED - RISK LEVEL: ${meta.risk}]\x1b[0m`);
    console.log(`Action: \x1b[1m${meta.desc}\x1b[0m`);

    this.isExecuting = true;

    if (meta.risk === 'MEDIUM' || meta.risk === 'HIGH') {
      this.rl!.question(`Do you want to continue? [y/N]: `, async (answer) => {
        const val = answer.trim().toLowerCase();
        if (val === 'y' || val === 'yes') {
          await this.runDbCommand(commandToExec);
        } else {
          console.log(`\x1b[33m Operation cancelled.\x1b[0m`);
        }
        this.isExecuting = false;
        this.promptUser();
      });
    } else if (meta.risk === 'CRITICAL') {
      const targetToken = args[0] || 'CONFIRM';
      console.log(`This is an \x1b[31mIRREVERSIBLE\x1b[0m critical action.`);
      console.log(`Please re-type the target identifier exactly to authorize: '\x1b[1m${targetToken}\x1b[0m'`);
      
      this.rl!.question(`Enter target: `, (ans1) => {
        if (ans1.trim() !== targetToken) {
          console.log(`\x1b[31m Target mismatch. Operation aborted.\x1b[0m`);
          this.isExecuting = false;
          this.promptUser();
          return;
        }

        this.rl!.question(`Enter mandatory administrative audit reason: `, async (ans2) => {
          const reason = ans2.trim();
          if (!reason || reason.length < 5) {
            console.log(`\x1b[31m Invalid audit reason. Minimum 5 characters required.\x1b[0m`);
            this.isExecuting = false;
            this.promptUser();
            return;
          }

          // Append reason to command to pass audit checks
          const commandWithReason = `${commandToExec} --reason "${reason.replace(/"/g, '\\"')}"`;
          await this.runDbCommand(commandWithReason);
          
          this.isExecuting = false;
          this.promptUser();
        });
      });
    }
  }

  /**
   * Helper that executes the finalized command string against the database engine
   */
  private async runDbCommand(command: string): Promise<void> {
    try {
      let result = await executeCliCommand(command, true);
      result = this.colorFormatOutput(result);
      console.log(result);
    } catch (err: any) {
      console.log(`\x1b[31mDATABASE ERROR: ${err.message || err}\x1b[0m`);
    }
  }

  /**
   * Post-processes and formats terminal text with appropriate ANSI color codes
   */
  private colorFormatOutput(text: string): string {
    if (!text) return text;
    
    const lines = text.split('\n');
    const formattedLines = lines.map(line => {
      let trimmed = line.trim();
      
      if (trimmed.startsWith('ERROR:') || trimmed.startsWith('FAIL:') || trimmed.startsWith('ERROR ') || trimmed.startsWith('FAIL ')) {
        return `\x1b[31m${line}\x1b[0m`;
      }
      
      if (trimmed.startsWith('SUCCESS:') || trimmed.startsWith('SUCCESS ') || trimmed.startsWith('SEC_OK:')) {
        return `\x1b[32m${line}\x1b[0m`;
      }
      
      if (trimmed.startsWith('WARNING:') || trimmed.startsWith('WARNING ')) {
        return `\x1b[33m${line}\x1b[0m`;
      }
      
      if (trimmed.startsWith('===') && trimmed.endsWith('===')) {
        return `\x1b[36m\x1b[1m${line}\x1b[0m`;
      }
      
      let formattedLine = line;
      formattedLine = formattedLine.replace(/(@[a-zA-Z0-9_\-\.]+)/g, '\x1b[1m$1\x1b[0m');
      formattedLine = formattedLine.replace(/(SUCCESS)/g, '\x1b[32m$1\x1b[0m');
      formattedLine = formattedLine.replace(/(ERROR|CORRUPTED|LEAK DETECTED|FAIL)/g, '\x1b[31m$1\x1b[0m');
      formattedLine = formattedLine.replace(/(WARNING|FLAGGED)/g, '\x1b[33m$1\x1b[0m');
      
      return formattedLine;
    });
    
    return formattedLines.join('\n');
  }

  /**
   * Helper to format string arrays in neat rows and columns (grid format)
   */
  private printGrid(items: string[], columns = 5, colWidth = 22): void {
    let row: string[] = [];
    for (let i = 0; i < items.length; i++) {
      row.push(items[i].padEnd(colWidth));
      if (row.length === columns || i === items.length - 1) {
        console.log(row.join(''));
        row = [];
      }
    }
  }
}
