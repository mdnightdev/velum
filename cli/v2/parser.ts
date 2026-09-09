export interface RequireArgOptions {
  type?: 'string' | 'number' | 'username' | 'id';
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
}

export interface ParsedCommandLine {
  verb: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

export function parseCommandLine(line: string): ParsedCommandLine | null {
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
  const flags: Record<string, string | boolean> = {};

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
    } else if (part.startsWith('-') && part.length > 1) {
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

export function requireArg(
  rawArgs: string[],
  index: number,
  usage: string,
  options?: RequireArgOptions
): string | null {
  const val = rawArgs[index];
  if (!val) {
    console.log(`Usage: ${usage}`);
    return null;
  }

  const trimmed = val.trim();

  if (options?.minLength !== undefined && trimmed.length < options.minLength) {
    console.log(`[ERROR] Argument too short (minimum ${options.minLength} characters required)`);
    return null;
  }

  if (options?.maxLength !== undefined && trimmed.length > options.maxLength) {
    console.log(`[ERROR] Argument too long (maximum ${options.maxLength} characters allowed)`);
    return null;
  }

  if (options?.type === 'number') {
    const num = Number(trimmed);
    if (isNaN(num)) {
      console.log('[ERROR] Expected a numeric argument');
      return null;
    }
  }

  if (options?.type === 'id') {
    const parsed = parseInt(trimmed, 10);
    if (isNaN(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
      console.log('[ERROR] Expected a valid positive integer ID');
      return null;
    }
  }

  if (options?.type === 'username') {
    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(trimmed)) {
      console.log('[ERROR] Invalid username format (3-32 chars, alphanumeric, _, -)');
      return null;
    }
  }

  if (options?.pattern && !options.pattern.test(trimmed)) {
    console.log('[ERROR] Argument does not match required format');
    return null;
  }

  return trimmed;
}

export function requireIntArg(rawArgs: string[], index: number, usage: string): number | null {
  const str = requireArg(rawArgs, index, usage, { type: 'id' });
  if (str === null) return null;
  return parseInt(str, 10);
}
