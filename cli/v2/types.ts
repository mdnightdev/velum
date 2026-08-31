import type { RequireArgOptions } from './parser.js';

export interface CommandContext {
  ns: string;
  sub: string;
  rawArgs: string[];
  flags: Record<string, string | boolean>;
  requireArg: (rawArgs: string[], index: number, usage: string, options?: RequireArgOptions) => string | null;
  requireIntArg: (rawArgs: string[], index: number, usage: string) => number | null;
  requireUser: (rawArgs: string[], usage: string) => Promise<any | null>;
  resolveUser: (idOrUsername: string) => Promise<any | null>;
  logAudit: (action: string, targetId: string, reason?: string) => Promise<void>;
  confirmAction: (ns: string, sub: string, risk: 'HIGH' | 'CRITICAL') => Promise<{ confirmed: boolean; reason?: string }>;
}

export type CommandHandler = (ctx: CommandContext) => Promise<void>;
