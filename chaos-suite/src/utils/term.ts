const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m',
};

const useColor = !process.env.NO_COLOR && !!process.stdout.isTTY;

function paint(code: string, text: string): string {
  return useColor ? `${code}${text}${C.reset}` : text;
}

let progressOpen = false;

function endProgressLine(): void {
  if (progressOpen) {
    process.stdout.write('\n');
    progressOpen = false;
  }
}

export type CheckCell = { ok: boolean; ms?: number; skip?: boolean };

export interface AgentRow {
  name: string;
  persona: string;
  headers: string[];
  checks: CheckCell[];
  avgMs: number;
  pass: boolean;
  error?: string;
}

function cell(c: CheckCell): string {
  if (c.skip) return paint(C.dim, '  -  ');
  const mark = c.ok ? paint(C.green, '✓') : paint(C.red, '✗');
  if (c.ms == null) return ` ${mark}    `;
  return ` ${mark}${paint(C.dim, String(c.ms).padStart(4))}`;
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s.slice(0, n);
  return s + ' '.repeat(n - s.length);
}

export const term = {
  line(msg: string): void {
    endProgressLine();
    console.log(msg);
  },

  blank(): void {
    endProgressLine();
    console.log('');
  },

  header(opts: {
    count: number;
    mode: string;
    kind: string;
    baseUrl: string;
    logs: string;
  }): void {
    endProgressLine();
    console.log(paint(C.bold, `chaos  ${opts.count}  ${opts.kind}  ${opts.mode}`));
    console.log(paint(C.dim, opts.baseUrl));
    console.log(paint(C.dim, `→ ${opts.logs}`));
  },

  progress(done: number, total: number, failed: number): void {
    const padN = String(total).length;
    const failBit = failed ? paint(C.red, `  fail ${failed}`) : '';
    process.stdout.write(`\r  ${String(done).padStart(padN)}/${total}${failBit}   `);
    progressOpen = true;
    if (done >= total) endProgressLine();
  },

  fail(username: string, error: string): void {
    endProgressLine();
    console.log(`${paint(C.red, 'fail')}  ${username}  ${error}`);
  },

  rename(from: string, to: string): void {
    endProgressLine();
    console.log(`${paint(C.yellow, 'rename')}  ${from} → ${to}`);
  },

  table(rows: AgentRow[], logsRel: string): void {
    endProgressLine();
    if (!rows.length) return;

    const headers = rows[0].headers;
    const nameW = Math.max(8, ...rows.map((r) => r.name.length));
    const roleW = Math.max(6, ...rows.map((r) => r.persona.length));

    const head =
      pad('NAME', nameW) +
      '  ' +
      pad('ROLE', roleW) +
      headers.map((h) => `  ${pad(h, 6)}`).join('') +
      '    AVG  RESULT';

    console.log('');
    console.log(paint(C.dim, head));
    console.log(paint(C.dim, '-'.repeat(Math.min(head.length, 100))));

    let passed = 0;
    const allMs: number[] = [];

    for (const r of rows) {
      if (r.pass) passed++;
      for (const c of r.checks) {
        if (c.ms != null && !c.skip) allMs.push(c.ms);
      }

      const avg = r.avgMs > 0 ? `${Math.round(r.avgMs)}ms`.padStart(5) : '   - ';
      const result = r.pass ? paint(C.green, 'pass') : paint(C.red, 'FAIL');

      console.log(
        pad(r.name, nameW) +
          '  ' +
          pad(r.persona, roleW) +
          r.checks.map((c) => cell(c)).join('') +
          '  ' +
          avg +
          '  ' +
          result
      );

      if (!r.pass && r.error) {
        console.log(paint(C.dim, `  ↳ ${r.error}`));
      }
    }

    allMs.sort((a, b) => a - b);
    const avg =
      allMs.length > 0
        ? Math.round(allMs.reduce((s, n) => s + n, 0) / allMs.length)
        : 0;
    const p95 =
      allMs.length > 0
        ? allMs[Math.min(allMs.length - 1, Math.floor(allMs.length * 0.95))]
        : 0;

    console.log(paint(C.dim, '-'.repeat(Math.min(head.length, 100))));
    const score =
      passed === rows.length
        ? paint(C.green, `${passed}/${rows.length} passed`)
        : paint(C.red, `${passed}/${rows.length} passed`);
    console.log(`${score}  avg ${avg}ms  p95 ${p95}ms`);
    console.log(paint(C.dim, `→ ${logsRel}`));
  },

  error(msg: string): void {
    endProgressLine();
    console.error(paint(C.red, msg));
  },
};
