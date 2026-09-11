import fs from 'fs';
import path from 'path';
import type { AgentRow, CheckCell } from './term.js';

interface ActionRecord {
  ts: string;
  bot: string;
  action: string;
  ok: boolean;
  ms: number;
  error?: string;
}

interface BotMetrics {
  botId: string;
  persona: string;
  actions: ActionRecord[];
  failures: { ts: string; action: string; error: string }[];
}

interface GlobalMetrics {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  averageLatency: number;
  commonFailures: Record<string, number>;
  activeBots: number;
}

function safeName(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function formatActionLine(a: ActionRecord): string {
  const mark = a.ok ? 'OK' : 'FAIL';
  const err = a.error ? `  ${a.error}` : '';
  return `${a.ts}  ${mark.padEnd(4)}  ${String(a.ms).padStart(5)}ms  ${a.action}${err}`;
}

function checkFrom(
  actions: ActionRecord[],
  names: string[]
): CheckCell {
  const hits = actions.filter((a) => names.includes(a.action));
  if (!hits.length) return { ok: false, skip: true };
  const last = hits[hits.length - 1];
  return { ok: last.ok, ms: last.ms };
}

function checkTalk(actions: ActionRecord[]): CheckCell {
  const hits = actions.filter(
    (a) => a.action === 'talk' || a.action.startsWith('talk:')
  );
  if (!hits.length) return { ok: true, skip: true };
  const timed = hits.filter((a) => a.ms > 0);
  const last = timed.length ? timed[timed.length - 1] : hits[hits.length - 1];
  return { ok: hits.some((a) => a.ok), ms: last.ms > 0 ? last.ms : undefined };
}

class ChaosLogger {
  private botMetrics: Map<string, BotMetrics> = new Map();
  private logRoot: string;
  private runDir: string | null = null;
  private auditStream: fs.WriteStream | null = null;
  private globalMetrics: GlobalMetrics = {
    totalActions: 0,
    successfulActions: 0,
    failedActions: 0,
    averageLatency: 0,
    commonFailures: {},
    activeBots: 0,
  };

  constructor() {
    this.logRoot = path.join(process.cwd(), 'chaos-logs');
    if (!fs.existsSync(this.logRoot)) {
      fs.mkdirSync(this.logRoot, { recursive: true });
    }
  }

  beginRun(label: string = 'run'): string {
    this.closeRun();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.runDir = path.join(this.logRoot, `${label}-${stamp}`);
    fs.mkdirSync(path.join(this.runDir, 'agents'), { recursive: true });
    this.auditStream = fs.createWriteStream(path.join(this.runDir, 'audit.log'), {
      flags: 'a',
    });
    this.botMetrics.clear();
    this.globalMetrics = {
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      averageLatency: 0,
      commonFailures: {},
      activeBots: 0,
    };

    fs.writeFileSync(
      path.join(this.runDir, 'README.txt'),
      [
        'Chaos run logs (plain text)',
        '',
        'summary.txt           — table + totals',
        'audit.log             — every action, time order',
        'agents/<Username>.txt — full trail for that name',
        '',
      ].join('\n')
    );

    return this.runDir;
  }

  getRunDir(): string | null {
    return this.runDir;
  }

  private closeRun(): void {
    if (this.auditStream) {
      this.auditStream.end();
      this.auditStream = null;
    }
  }

  initializeBot(botId: string, persona: string): void {
    if (!this.botMetrics.has(botId)) {
      this.globalMetrics.activeBots++;
    }
    this.botMetrics.set(botId, {
      botId,
      persona,
      actions: [],
      failures: [],
    });
  }

  renameBot(oldId: string, newId: string, persona: string): void {
    const prev = this.botMetrics.get(oldId);
    if (prev) {
      this.botMetrics.delete(oldId);
      prev.botId = newId;
      prev.persona = persona;
      this.botMetrics.set(newId, prev);
    } else {
      this.initializeBot(newId, persona);
    }
  }

  private writeAudit(row: ActionRecord): void {
    if (!this.auditStream) {
      this.beginRun('run');
    }
    const mark = row.ok ? 'OK' : 'FAIL';
    const err = row.error ? `  ${row.error}` : '';
    this.auditStream!.write(
      `${row.ts}  ${row.bot.padEnd(12)}  ${mark.padEnd(4)}  ${String(row.ms).padStart(5)}ms  ${row.action}${err}\n`
    );
  }

  logAction(
    botId: string,
    action: string,
    success: boolean,
    latency: number,
    error?: string,
    _details?: unknown
  ): void {
    const metrics = this.botMetrics.get(botId);
    if (!metrics) return;

    const row: ActionRecord = {
      ts: new Date().toISOString(),
      bot: botId,
      action,
      ok: success,
      ms: Math.round(latency),
      ...(error ? { error } : {}),
    };
    metrics.actions.push(row);
    this.writeAudit(row);

    this.globalMetrics.totalActions++;
    if (success) {
      this.globalMetrics.successfulActions++;
    } else {
      this.globalMetrics.failedActions++;
      if (error) {
        this.globalMetrics.commonFailures[error] =
          (this.globalMetrics.commonFailures[error] || 0) + 1;
      }
    }

    const n = this.globalMetrics.totalActions;
    this.globalMetrics.averageLatency =
      (this.globalMetrics.averageLatency * (n - 1) + latency) / n;
  }

  logFailure(
    botId: string,
    action: string,
    error: string,
    _recoveryAttempted: boolean,
    _recoverySuccess?: boolean
  ): void {
    const metrics = this.botMetrics.get(botId);
    if (!metrics) return;
    metrics.failures.push({ ts: new Date().toISOString(), action, error });
    this.logAction(botId, action, false, 0, error);
  }

  logAdminInteraction(
    _botId: string,
    _type: 'mute' | 'block' | 'sanction',
    _detected: boolean,
    _bypassAttempted: boolean,
    _bypassSuccess?: boolean
  ): void {}

  logCompromiseEvent(
    botId: string,
    type: 'password_change' | 'token_leak' | 'session_hijack',
    recoveryAttempted: boolean,
    recoverySuccess?: boolean
  ): void {
    this.logAction(
      botId,
      `compromise:${type}`,
      !!recoverySuccess,
      0,
      recoveryAttempted ? undefined : type
    );
  }

  logSessionEnd(_botId: string, _forcedLogout: boolean = false): void {}


  private botsInOrder(order?: string[]): BotMetrics[] {
    if (!order) return Array.from(this.botMetrics.values());
    return order
      .map((id) => this.botMetrics.get(id))
      .filter((b): b is BotMetrics => !!b);
  }

  private avgMs(b: BotMetrics): number {
    const timed = b.actions.filter((a) => a.ms > 0);
    if (!timed.length) return 0;
    return timed.reduce((s, a) => s + a.ms, 0) / timed.length;
  }

  buildAuthRows(order?: string[]): AgentRow[] {
    const headers = ['PING', 'AUTH', 'OUT', 'IN'];
    return this.botsInOrder(order).map((b) => {
      const checks = [
        checkFrom(b.actions, ['ping']),
        checkFrom(b.actions, ['login', 'register']),
        checkFrom(b.actions, ['logout']),
        checkFrom(b.actions, ['relogin']),
      ];
      const fail = [...b.actions].reverse().find((a) => !a.ok);
      const pass = checks.every((c) => c.ok && !c.skip);
      return {
        name: b.botId,
        persona: b.persona,
        headers,
        checks,
        avgMs: this.avgMs(b),
        pass,
        error: fail?.error,
      };
    });
  }

  buildLoungeRows(order?: string[]): AgentRow[] {
    const headers = ['PING', 'AUTH', 'JOIN', 'ROOMS', 'TALK'];
    return this.botsInOrder(order).map((b) => {
      const talk = checkTalk(b.actions);
      const checks = [
        checkFrom(b.actions, ['ping']),
        checkFrom(b.actions, ['login', 'register']),
        checkFrom(b.actions, ['join']),
        checkFrom(b.actions, ['rooms']),
        talk,
      ];
      const fail = [...b.actions].reverse().find((a) => !a.ok);
      const pass = checks.every((c) => c.ok && !c.skip);
      return {
        name: b.botId,
        persona: b.persona,
        headers,
        checks,
        avgMs: this.avgMs(b),
        pass,
        error: fail?.error,
      };
    });
  }

  buildLiveRows(
    order?: string[],
    sessions?: Array<{
      username: string;
      ok: boolean;
      style: string;
      talks: number;
      joined: boolean;
      loggedOut: boolean;
      error?: string;
    }>
  ): AgentRow[] {
    const byName = new Map((sessions || []).map((s) => [s.username, s]));
    const headers = ['AUTH', 'JOIN', 'STYLE', 'TALK', 'OUT'];
    return this.botsInOrder(order).map((b) => {
      const s = byName.get(b.botId);
      const auth = checkFrom(b.actions, ['relogin', 'login', 'register']);
      const join = checkFrom(b.actions, ['join']);
      const style = checkFrom(b.actions, ['style']);
      const talk = checkTalk(b.actions);
      const out: CheckCell = s
        ? s.loggedOut
          ? { ok: true }
          : { ok: true, skip: true }
        : { ok: true, skip: true };
      const checks = [auth, join, style, talk, out];
      const pass = s?.ok ?? checks.every((c) => c.ok || !!c.skip);
      return {
        name: b.botId,
        persona: s ? `${b.persona}/${s.style}` : b.persona,
        headers,
        checks,
        avgMs: this.avgMs(b),
        pass,
        error: s?.error || [...b.actions].reverse().find((a) => !a.ok)?.error,
      };
    });
  }

  buildCreateRows(
    order?: string[],
    results?: Array<{
      username: string;
      ok: boolean;
      role: 'create' | 'join';
      loungeName?: string;
      subsOk?: number;
      found?: number;
      joined?: number;
      error?: string;
    }>
  ): AgentRow[] {
    const byName = new Map((results || []).map((r) => [r.username, r]));
    const headers = ['AUTH', 'CREATE', 'SUBS', 'FIND', 'JOIN'];
    return this.botsInOrder(order).map((b) => {
      const r = byName.get(b.botId);
      const auth = checkFrom(b.actions, ['relogin', 'login', 'register']);
      const create = checkFrom(b.actions, ['create']);
      const subs = checkFrom(b.actions, ['subs']);
      const find = checkFrom(b.actions, ['find', 'found']);
      const join = checkFrom(b.actions, ['join']);
      const checks =
        r?.role === 'create'
          ? [auth, create, subs, { ok: true, skip: true }, { ok: true, skip: true }]
          : [auth, { ok: true, skip: true }, { ok: true, skip: true }, find, join];
      return {
        name: b.botId,
        persona: r ? `${b.persona}/${r.role}` : b.persona,
        headers,
        checks,
        avgMs: this.avgMs(b),
        pass: r?.ok ?? false,
        error: r?.error || [...b.actions].reverse().find((a) => !a.ok)?.error,
      };
    });
  }

  buildFriendRows(
    order?: string[],
    results?: Array<{
      username: string;
      ok: boolean;
      found: number;
      outsiders: number;
      sent: number;
      soft: number;
      accepted?: number;
      dms?: number;
      contacts?: number;
      error?: string;
    }>
  ): AgentRow[] {
    const byName = new Map((results || []).map((r) => [r.username, r]));
    const headers = ['AUTH', 'FIND', 'REQ', 'ACCEPT', 'DM'];
    return this.botsInOrder(order).map((b) => {
      const r = byName.get(b.botId);
      const auth = checkFrom(b.actions, ['relogin', 'login', 'register']);
      const find = checkFrom(b.actions, ['find', 'found']);
      const req = checkFrom(b.actions, ['request']);
      const accept = checkFrom(b.actions, ['accept']);
      const dm = checkFrom(b.actions, ['dm']);
      return {
        name: b.botId,
        persona: b.persona,
        headers,
        checks: [auth, find, req, accept, dm],
        avgMs: this.avgMs(b),
        pass: r?.ok ?? false,
        error: r?.error || [...b.actions].reverse().find((a) => !a.ok)?.error,
      };
    });
  }

  buildAvatarRows(
    order?: string[],
    results?: Array<{
      username: string;
      ok: boolean;
      file?: string;
      url?: string;
      error?: string;
    }>
  ): AgentRow[] {
    const byName = new Map((results || []).map((r) => [r.username, r]));
    const headers = ['AUTH', 'UPLOAD', 'PROFILE', 'VERIFY'];
    return this.botsInOrder(order).map((b) => {
      const r = byName.get(b.botId);
      const auth = checkFrom(b.actions, ['relogin', 'login', 'register']);
      const upload = checkFrom(b.actions, ['upload']);
      const profile = checkFrom(b.actions, ['profile']);
      const verify = checkFrom(b.actions, ['verify']);
      return {
        name: b.botId,
        persona: b.persona,
        headers,
        checks: [auth, upload, profile, verify],
        avgMs: this.avgMs(b),
        pass: r?.ok ?? false,
        error: r?.error || [...b.actions].reverse().find((a) => !a.ok)?.error,
      };
    });
  }

  buildMediaRows(
    order?: string[],
    results?: Array<{
      username: string;
      ok: boolean;
      file?: string;
      url?: string;
      dmOk?: number;
      dmNeed?: number;
      loungeOk?: number;
      loungeNeed?: number;
      error?: string;
    }>
  ): AgentRow[] {
    const byName = new Map((results || []).map((r) => [r.username, r]));
    const headers = ['AUTH', 'UPLOAD', 'DM', 'LOUNGE'];
    return this.botsInOrder(order).map((b) => {
      const r = byName.get(b.botId);
      const auth = checkFrom(b.actions, ['relogin', 'login', 'register']);
      const upload = checkFrom(b.actions, ['upload']);
      const dm = checkFrom(b.actions, ['dm']);
      const lounge = checkFrom(b.actions, ['lounge']);
      return {
        name: b.botId,
        persona: b.persona,
        headers,
        checks: [auth, upload, dm, lounge],
        avgMs: this.avgMs(b),
        pass: r?.ok ?? false,
        error: r?.error || [...b.actions].reverse().find((a) => !a.ok)?.error,
      };
    });
  }

  buildWsRows(
    order?: string[],
    results?: Array<{
      username: string;
      ok: boolean;
      connected: boolean;
      peerOk: boolean;
      role: string;
      error?: string;
    }>
  ): AgentRow[] {
    const byName = new Map((results || []).map((r) => [r.username, r]));
    const headers = ['AUTH', 'WS', 'PEER'];
    return this.botsInOrder(order).map((b) => {
      const r = byName.get(b.botId);
      const auth = checkFrom(b.actions, ['relogin', 'login', 'register']);
      const ws = checkFrom(b.actions, ['ws']);
      const peer = checkFrom(b.actions, ['peer']);
      return {
        name: b.botId,
        persona: r ? `${b.persona}/${r.role}` : b.persona,
        headers,
        checks: [auth, ws, peer],
        avgMs: this.avgMs(b),
        pass: r?.ok ?? false,
        error: r?.error || [...b.actions].reverse().find((a) => !a.ok)?.error,
      };
    });
  }

  buildCueRows(
    order?: string[],
    results?: Array<{
      username: string;
      ok: boolean;
      role: string;
      cue?: string;
      openOk: boolean;
      cueOk: boolean;
      replyOk: boolean;
      error?: string;
    }>
  ): AgentRow[] {
    const byName = new Map((results || []).map((r) => [r.username, r]));
    const headers = ['AUTH', 'OPEN', 'CUE', 'REPLY'];
    return this.botsInOrder(order).map((b) => {
      const r = byName.get(b.botId);
      const auth = checkFrom(b.actions, ['relogin', 'login', 'register']);
      const open = checkFrom(b.actions, ['open', 'velum_general', 'join']);
      const cue = checkFrom(b.actions, ['cue', 'seed']);
      const reply = checkFrom(b.actions, ['reply']);
      const roleTag = r?.cue ? `${b.persona}/${r.role}:${r.cue}` : r ? `${b.persona}/${r.role}` : b.persona;
      return {
        name: b.botId,
        persona: roleTag,
        headers,
        checks: [auth, open, cue, reply],
        avgMs: this.avgMs(b),
        pass: r?.ok ?? false,
        error: r?.error || [...b.actions].reverse().find((a) => !a.ok)?.error,
      };
    });
  }

  /** Per-agent rollup across full pipeline stage results. */
  buildFullRows(
    order?: string[],
    auth?: Array<{ username: string; ok: boolean; error?: string }>,
    createJoin?: Array<{ username: string; ok: boolean; error?: string }>,
    lounge?: Array<{ username: string; ok: boolean; error?: string }>,
    avatars?: Array<{ username: string; ok: boolean; error?: string }>,
    friends?: Array<{ username: string; ok: boolean; error?: string }>,
    sessions?: Array<{ username: string; ok: boolean; error?: string }>,
    media?: Array<{ username: string; ok: boolean; error?: string }>,
    ws?: Array<{ username: string; ok: boolean; error?: string }>,
    cues?: Array<{ username: string; ok: boolean; error?: string }>
  ): AgentRow[] {
    const mapOk = (
      rows: Array<{ username: string; ok: boolean; error?: string }> | undefined,
      name: string
    ): CheckCell & { error?: string } => {
      const hit = (rows || []).find((r) => r.username === name);
      if (!hit) return { ok: false, skip: true };
      return { ok: hit.ok, error: hit.error };
    };

    const headers = [
      'AUTH',
      'CREATE',
      'LOUNGE',
      'AVATAR',
      'FRIENDS',
      'TALK',
      'MEDIA',
      'WS',
      'CUES',
    ];

    return this.botsInOrder(order).map((b) => {
      const cells = [
        mapOk(auth, b.botId),
        mapOk(createJoin, b.botId),
        mapOk(lounge, b.botId),
        mapOk(avatars, b.botId),
        mapOk(friends, b.botId),
        mapOk(sessions, b.botId),
        mapOk(media, b.botId),
        mapOk(ws, b.botId),
        mapOk(cues, b.botId),
      ];
      const checks: CheckCell[] = cells.map(({ ok, skip, ms }) => ({ ok, skip, ms }));
      const fail = cells.find((c) => !c.skip && !c.ok);
      const pass = cells.every((c) => c.ok && !c.skip);
      return {
        name: b.botId,
        persona: b.persona,
        headers,
        checks,
        avgMs: this.avgMs(b),
        pass,
        error: fail?.error || [...b.actions].reverse().find((a) => !a.ok)?.error,
      };
    });
  }

  formatSummaryText(rows: AgentRow[]): string {
    const g = this.globalMetrics;
    if (!rows.length) {
      return `finished  ${new Date().toISOString()}\nactions   ${g.successfulActions}/${g.totalActions}\n`;
    }
    const headers = rows[0].headers;
    const lines: string[] = [
      `finished  ${new Date().toISOString()}`,
      `actions   ${g.successfulActions}/${g.totalActions}  fail ${g.failedActions}  avg ${g.averageLatency.toFixed(0)}ms`,
      '',
      `NAME         ROLE        ${headers.join('  ')}  AVG  RESULT`,
    ];

    for (const r of rows) {
      const marks = r.checks
        .map((c) => {
          if (c.skip) return '-';
          return c.ok ? `✓${c.ms ?? ''}` : `✗${c.ms ?? ''}`;
        })
        .join('  ');
      lines.push(
        `${r.name.padEnd(12)} ${r.persona.padEnd(10)} ${marks}  ${Math.round(r.avgMs)}ms  ${r.pass ? 'pass' : 'FAIL'}${r.error ? `  ${r.error}` : ''}`
      );
    }

    const fails = Object.entries(g.commonFailures)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (fails.length) {
      lines.push('', 'errors');
      for (const [e, n] of fails) lines.push(`  ${n}x  ${e}`);
    }
    return lines.join('\n') + '\n';
  }

  saveReports(
    agentOrder?: string[],
    kind:
      | 'auth'
      | 'lounge'
      | 'live'
      | 'create'
      | 'friends'
      | 'avatar'
      | 'media'
      | 'ws'
      | 'cues'
      | 'full' = 'auth',
    sessions?: Array<{
      username: string;
      ok: boolean;
      style: string;
      talks: number;
      joined: boolean;
      loggedOut: boolean;
      error?: string;
    }>,
    createJoin?: Array<{
      username: string;
      ok: boolean;
      role: 'create' | 'join';
      loungeName?: string;
      subsOk?: number;
      found?: number;
      joined?: number;
      error?: string;
    }>,
    friends?: Array<{
      username: string;
      ok: boolean;
      found: number;
      outsiders: number;
      sent: number;
      soft: number;
      accepted?: number;
      dms?: number;
      contacts?: number;
      error?: string;
    }>,
    avatars?: Array<{
      username: string;
      ok: boolean;
      file?: string;
      url?: string;
      error?: string;
    }>,
    media?: Array<{
      username: string;
      ok: boolean;
      file?: string;
      url?: string;
      dmOk?: number;
      dmNeed?: number;
      loungeOk?: number;
      loungeNeed?: number;
      error?: string;
    }>,
    ws?: Array<{
      username: string;
      ok: boolean;
      connected: boolean;
      peerOk: boolean;
      role: string;
      error?: string;
    }>,
    cues?: Array<{
      username: string;
      ok: boolean;
      role: string;
      cue?: string;
      openOk: boolean;
      cueOk: boolean;
      replyOk: boolean;
      error?: string;
    }>,
    auth?: Array<{
      username: string;
      ok: boolean;
      error?: string;
    }>,
    lounge?: Array<{
      username: string;
      ok: boolean;
      error?: string;
    }>
  ): AgentRow[] {
    if (!this.runDir) {
      this.beginRun(kind);
    }
    const dir = this.runDir!;
    const agentsDir = path.join(dir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    for (const b of this.botMetrics.values()) {
      const avg = Math.round(this.avgMs(b));
      const body = [
        `${b.botId}  (${b.persona})`,
        `actions ${b.actions.filter((a) => a.ok).length}/${b.actions.length}  avg ${avg}ms`,
        '',
        ...b.actions.map(formatActionLine),
        '',
      ];
      if (b.failures.length) {
        body.push('failures');
        for (const f of b.failures) {
          body.push(`${f.ts}  ${f.action}  ${f.error}`);
        }
        body.push('');
      }
      fs.writeFileSync(path.join(agentsDir, `${safeName(b.botId)}.txt`), body.join('\n'));
    }

    const rows =
      kind === 'full'
        ? this.buildFullRows(
            agentOrder,
            auth,
            createJoin,
            lounge,
            avatars,
            friends,
            sessions,
            media,
            ws,
            cues
          )
        : kind === 'cues'
          ? this.buildCueRows(agentOrder, cues)
          : kind === 'ws'
            ? this.buildWsRows(agentOrder, ws)
            : kind === 'media'
              ? this.buildMediaRows(agentOrder, media)
              : kind === 'avatar'
                ? this.buildAvatarRows(agentOrder, avatars)
                : kind === 'friends'
                  ? this.buildFriendRows(agentOrder, friends)
                  : kind === 'create'
                    ? this.buildCreateRows(agentOrder, createJoin)
                    : kind === 'live'
                      ? this.buildLiveRows(agentOrder, sessions)
                      : kind === 'lounge'
                        ? this.buildLoungeRows(agentOrder)
                        : this.buildAuthRows(agentOrder);
    fs.writeFileSync(path.join(dir, 'summary.txt'), this.formatSummaryText(rows));

    this.closeRun();
    return rows;
  }

  getMetrics(botId?: string): BotMetrics | Map<string, BotMetrics> | undefined {
    if (botId) return this.botMetrics.get(botId);
    return this.botMetrics;
  }
}

export const chaosLogger = new ChaosLogger();
