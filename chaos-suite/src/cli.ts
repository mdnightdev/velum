/**
 * Chaos CLI — prefer flags over editing chaos.config.json every smoke.
 *
 *   npm start
 *   npm start -- -u 2 -d 2m -t talk
 *   npm start -- -2 --2m --talk
 *   npm start -- --help
 */

export type ChaosTask =
  | 'full'
  | 'talk'
  | 'auth'
  | 'ws'
  | 'media'
  | 'avatar'
  | 'friends'
  | 'live'
  | 'cues'
  | 'create';

export interface CliArgs {
  users?: number;
  durationMs?: number;
  task?: ChaosTask;
  baseUrl?: string;
  mode?: 'local' | 'prod';
  help?: boolean;
  /** Reply gaps for talk task (ms). Default: instant / 5s / 15s / 30s */
  gapsMs?: number[];
}

const TASKS: ChaosTask[] = [
  'full',
  'talk',
  'auth',
  'ws',
  'media',
  'avatar',
  'friends',
  'live',
  'cues',
  'create',
];

/** Default human-like reply spacing for talk smokes. */
export const DEFAULT_TALK_GAPS_MS = [0, 5_000, 15_000, 30_000] as const;

export function parseDuration(raw: string): number {
  const s = raw.trim().toLowerCase().replace(/^--?/, '');
  const m = /^(\d+(?:\.\d+)?)(ms|s|m|min|minutes|h|hr|hours)?$/.exec(s);
  if (!m) {
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) throw new Error(`bad duration: ${raw}`);
    return Math.floor(n);
  }
  const n = Number(m[1]);
  const unit = m[2] || 'ms';
  switch (unit) {
    case 'ms':
      return Math.floor(n);
    case 's':
      return Math.floor(n * 1000);
    case 'm':
    case 'min':
    case 'minutes':
      return Math.floor(n * 60_000);
    case 'h':
    case 'hr':
    case 'hours':
      return Math.floor(n * 3_600_000);
    default:
      return Math.floor(n);
  }
}

function parseGaps(raw: string): number[] {
  return raw.split(',').map((part) => {
    const p = part.trim().toLowerCase();
    if (p === 'instant' || p === '0') return 0;
    return parseDuration(p);
  });
}

export function printHelp(): void {
  console.log(`
velum chaos-suite

Usage:
  npm start
  npm start -- [options]

Options:
  -u, --users <n>         Agent count (bare start = local max 10 / prod max 100)
  -d, --duration <t>      2m | 120s | 2minutes | 120000
  -t, --task <name>       ${TASKS.join(' | ')}
      --talk              Shorthand for --task talk
      --auth --ws ...     Same for other tasks
  -g, --gaps <list>       Talk reply gaps, e.g. instant,5s,15s,30s
      --base-url <url>    API base (default from config)
      --mode local|prod
  -h, --help

Shorthand:
  -2                      Same as --users 2
  --2m / --2minutes       Same as --duration 2m

Examples:
  npm start
  npm start -- -u 2 -d 2m -t talk
  npm start -- -2 --2m --talk
  npm start -- -u 4 -d 5m -t avatar
  npm start -- -u 8 -d 10m -t media
  npm start -- -u 2 -d 2m -t talk -g instant,5s,15s,30s
  npm start -- -u 8 -d 1h -t full
  # full = auth→create→lounge→avatar→friends→talk→media→ws→cues (not spam loop)
`.trim());
}

export function parseCli(argv: string[]): CliArgs {
  const args: CliArgs = {};
  const a = argv.slice(2);

  for (let i = 0; i < a.length; i++) {
    const tok = a[i];

    if (tok === '-h' || tok === '--help') {
      args.help = true;
      continue;
    }

    // -2 / -8
    if (/^-\d+$/.test(tok)) {
      args.users = Number(tok.slice(1));
      continue;
    }

    // --2m / --2minutes / --120s
    if (/^--\d/.test(tok)) {
      args.durationMs = parseDuration(tok);
      continue;
    }

    if (tok === '-u' || tok === '--users') {
      args.users = Number(a[++i]);
      continue;
    }
    if (tok.startsWith('--users=')) {
      args.users = Number(tok.slice('--users='.length));
      continue;
    }

    if (tok === '-d' || tok === '--duration') {
      args.durationMs = parseDuration(a[++i]);
      continue;
    }
    if (tok.startsWith('--duration=')) {
      args.durationMs = parseDuration(tok.slice('--duration='.length));
      continue;
    }

    if (tok === '-t' || tok === '--task') {
      const t = a[++i] as ChaosTask;
      if (!TASKS.includes(t)) throw new Error(`bad task: ${t}`);
      args.task = t;
      continue;
    }
    if (tok.startsWith('--task=')) {
      const t = tok.slice('--task='.length) as ChaosTask;
      if (!TASKS.includes(t)) throw new Error(`bad task: ${t}`);
      args.task = t;
      continue;
    }

    if (tok === '-g' || tok === '--gaps') {
      args.gapsMs = parseGaps(a[++i]);
      continue;
    }
    if (tok.startsWith('--gaps=')) {
      args.gapsMs = parseGaps(tok.slice('--gaps='.length));
      continue;
    }

    if (tok === '--base-url') {
      args.baseUrl = a[++i];
      continue;
    }
    if (tok.startsWith('--base-url=')) {
      args.baseUrl = tok.slice('--base-url='.length);
      continue;
    }

    if (tok === '--mode') {
      const m = a[++i];
      args.mode = m === 'prod' ? 'prod' : 'local';
      continue;
    }

    // --talk --auth --ws ...
    if (tok.startsWith('--') && TASKS.includes(tok.slice(2) as ChaosTask)) {
      args.task = tok.slice(2) as ChaosTask;
      continue;
    }

    throw new Error(`unknown arg: ${tok}  (try --help)`);
  }

  return args;
}

export function pickRandomGap(gaps: readonly number[]): number {
  return gaps[Math.floor(Math.random() * gaps.length)];
}
