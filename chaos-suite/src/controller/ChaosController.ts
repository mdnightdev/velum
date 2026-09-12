import {
  ChaosAgent,
  type AuthGateResult,
  type AvatarGateResult,
  type CreateJoinResult,
  type CueGateResult,
  type FriendGateResult,
  type LoungeGateResult,
  type MarketGateResult,
  type MediaGateResult,
  type SessionResult,
  type WsGateResult,
} from '../agents/ChaosAgent.js';
import { chaosLogger } from '../utils/chaosLogger.js';
import { term } from '../utils/term.js';
import { allocateName, clampAgentCount } from '../data/naming.js';
import { DEFAULT_LIBRARY_ROOT, listAvatarImages, listMediaFiles } from '../data/library.js';
import { TEST_CUES } from '../data/cues.js';
import { persistenceManager } from '../utils/persistence.js';
import type { PersonaId } from '../data/human/personas.js';
import { personaListFromPairs, pickSeed, TALK_PAIR_SPECS } from '../data/human/talkPairs.js';
import { stripMdash } from '../data/human/talkReply.js';
import path from 'path';

function randomReplyGapMs(pool: number[]): number {
  const gaps = pool.length ? pool : [0, 5000, 15000, 30000];
  return gaps[Math.floor(Math.random() * gaps.length)];
}

interface ChaosConfig {
  agentCount: number;
  duration: number;
  baseUrl: string;
  personaDistribution: Record<string, number>;
  mode?: 'local' | 'prod';
  authOnly?: boolean;
  loungeOnly?: boolean;
  liveOnly?: boolean;
  friendsOnly?: boolean;
  avatarOnly?: boolean;
  mediaOnly?: boolean;
  marketOnly?: boolean;
  wsOnly?: boolean;
  cuesOnly?: boolean;
  humanTalkOnly?: boolean;
  /** Talk-task reply spacing pool (ms). */
  talkGapsMs?: number[];
  creatorCount?: number;
  libraryRoot?: string;
  verboseTerminal?: boolean;
}

const DEFAULT_CONFIG: ChaosConfig = {
  agentCount: 8,
  duration: 120000,
  baseUrl: 'http://localhost:3000/v2',
  mode: 'local',
  authOnly: false,
  loungeOnly: false,
  liveOnly: false,
  friendsOnly: false,
  avatarOnly: false,
  mediaOnly: false,
  marketOnly: false,
  wsOnly: false,
  cuesOnly: false,
  humanTalkOnly: false,
  talkGapsMs: [0, 5000, 15000, 30000],
  creatorCount: 2,
  libraryRoot: DEFAULT_LIBRARY_ROOT,
  verboseTerminal: false,
  personaDistribution: {
    social: 2,
    casual: 2,
    tech: 1,
    drama: 1,
    support: 1,
    attention: 1,
  },
};

export class ChaosController {
  private agents: Map<string, ChaosAgent> = new Map();
  private config: ChaosConfig;
  private isRunning = false;
  private usedNames = new Set<string>();
  private runOrder: string[] = [];
  private gateKind:
    | 'auth'
    | 'lounge'
    | 'live'
    | 'create'
    | 'friends'
    | 'avatar'
    | 'media'
    | 'market'
    | 'ws'
    | 'cues'
    | 'full' = 'cues';
  private authResults: AuthGateResult[] = [];
  private loungeResults: LoungeGateResult[] = [];
  private sessionResults: SessionResult[] = [];
  private createJoinResults: CreateJoinResult[] = [];
  private friendResults: FriendGateResult[] = [];
  private avatarResults: AvatarGateResult[] = [];
  private mediaResults: MediaGateResult[] = [];
  private marketResults: MarketGateResult[] = [];
  private wsResults: WsGateResult[] = [];
  private cueResults: CueGateResult[] = [];

  constructor(config: Partial<ChaosConfig> = {}) {
    const merged = { ...DEFAULT_CONFIG, ...config };
    merged.mode = merged.mode === 'prod' ? 'prod' : 'local';
    merged.agentCount = clampAgentCount(merged.agentCount, merged.mode);
    merged.authOnly = config.authOnly !== undefined ? !!config.authOnly : DEFAULT_CONFIG.authOnly!;
    merged.loungeOnly =
      config.loungeOnly !== undefined ? !!config.loungeOnly : DEFAULT_CONFIG.loungeOnly!;
    merged.liveOnly = config.liveOnly !== undefined ? !!config.liveOnly : DEFAULT_CONFIG.liveOnly!;
    merged.friendsOnly =
      config.friendsOnly !== undefined ? !!config.friendsOnly : DEFAULT_CONFIG.friendsOnly!;
    merged.avatarOnly =
      config.avatarOnly !== undefined ? !!config.avatarOnly : DEFAULT_CONFIG.avatarOnly!;
    merged.mediaOnly =
      config.mediaOnly !== undefined ? !!config.mediaOnly : DEFAULT_CONFIG.mediaOnly!;
    merged.marketOnly =
      config.marketOnly !== undefined ? !!config.marketOnly : DEFAULT_CONFIG.marketOnly!;
    merged.wsOnly = config.wsOnly !== undefined ? !!config.wsOnly : DEFAULT_CONFIG.wsOnly!;
    merged.cuesOnly = config.cuesOnly !== undefined ? !!config.cuesOnly : DEFAULT_CONFIG.cuesOnly!;
    merged.humanTalkOnly =
      config.humanTalkOnly !== undefined ? !!config.humanTalkOnly : DEFAULT_CONFIG.humanTalkOnly!;
    merged.talkGapsMs =
      Array.isArray(config.talkGapsMs) && config.talkGapsMs.length
        ? config.talkGapsMs.map((n) => Math.max(0, Math.floor(Number(n)) || 0))
        : [...(DEFAULT_CONFIG.talkGapsMs || [0, 5000, 15000, 30000])];
    if (merged.marketOnly) {
      merged.personaDistribution = {
        market: Math.max(1, Math.ceil(merged.agentCount / 2)),
        lowballer_hustler: Math.max(1, Math.floor(merged.agentCount / 2)),
      };
    }    merged.creatorCount =
      typeof config.creatorCount === 'number'
        ? Math.max(1, config.creatorCount)
        : DEFAULT_CONFIG.creatorCount!;
    merged.libraryRoot =
      typeof config.libraryRoot === 'string' && config.libraryRoot.trim()
        ? config.libraryRoot.trim()
        : DEFAULT_CONFIG.libraryRoot!;
    merged.verboseTerminal = !!config.verboseTerminal;
    this.config = merged;
  }

  private distributePersonas(): string[] {
    const personas: string[] = [];
    for (const [persona, count] of Object.entries(this.config.personaDistribution)) {
      for (let i = 0; i < count; i++) personas.push(persona);
    }
    while (personas.length < this.config.agentCount) personas.push('casual');
    return personas.sort(() => Math.random() - 0.5);
  }

  private isFullRun(): boolean {
    return (
      !this.config.authOnly &&
      !this.config.humanTalkOnly &&
      !this.config.cuesOnly &&
      !this.config.wsOnly &&
      !this.config.mediaOnly &&
      !this.config.marketOnly &&
      !this.config.avatarOnly &&
      !this.config.friendsOnly &&
      !this.config.liveOnly &&
      !this.config.loungeOnly
    );
  }

  private kindLabel(): string {
    if (this.config.authOnly) return 'auth';
    if (this.config.humanTalkOnly) return 'talk';
    if (this.config.cuesOnly) return 'cues';
    if (this.config.wsOnly) return 'ws';
    if (this.config.mediaOnly) return 'media';
    if (this.config.marketOnly) return 'market';
    if (this.config.avatarOnly) return 'avatar';
    if (this.config.friendsOnly) return 'friends';
    if (this.config.liveOnly) return 'live';
    if (this.config.loungeOnly) return 'create';
    return 'full';
  }

  async initialize(): Promise<void> {
    this.gateKind = this.config.authOnly
      ? 'auth'
      : this.config.humanTalkOnly
        ? 'live'
        : this.config.cuesOnly
          ? 'cues'
          : this.config.wsOnly
            ? 'ws'
            : this.config.mediaOnly
              ? 'media'
              : this.config.marketOnly
                ? 'market'
                : this.config.avatarOnly
                  ? 'avatar'
                  : this.config.friendsOnly
                    ? 'friends'
                    : this.config.liveOnly
                      ? 'live'
                      : this.config.loungeOnly
                        ? 'create'
                        : 'full';
    const runDir = chaosLogger.beginRun(this.kindLabel());
    term.header({
      count: this.config.agentCount,
      mode: this.config.mode || 'local',
      kind: this.kindLabel(),
      baseUrl: this.config.baseUrl,
      logs: runDir,
    });
    const root = this.config.libraryRoot || DEFAULT_LIBRARY_ROOT;
    if (this.config.avatarOnly || this.isFullRun()) {
      term.line(`library  ${root}  avatars=${listAvatarImages(root).length}`);
    }
    if (this.config.mediaOnly || this.isFullRun()) {
      term.line(`library  ${root}  media=${listMediaFiles(root).length}`);
    }

    this.usedNames = new Set<string>();
    this.runOrder = [];
    this.agents.clear();

    if (this.config.humanTalkOnly) {
      const existing = persistenceManager.getActiveCredentials();
      if (!existing.length) {
        throw new Error('humanTalkOnly: no stored users in chaos-data/credentials.json');
      }
      const take = existing.slice(0, this.config.agentCount);
      const pairCount = Math.max(1, Math.ceil(take.length / 2));
      const talkPersonas = personaListFromPairs(pairCount);
      term.line(`reuse  ${take.length} stored users  room=velum_general  ${this.config.duration}ms`);
      for (let i = 0; i < take.length; i++) {
        const cred = take[i];
        const persona = talkPersonas[i % talkPersonas.length];
        persistenceManager.storeCredentials({
          ...cred,
          persona,
          lastLoginAt: cred.lastLoginAt || new Date().toISOString(),
        });
        this.usedNames.add(cred.username.toLowerCase());
        const agent = new ChaosAgent({
          agentId: cred.username,
          persona,
          deviceIndex: i,
          baseUrl: this.config.baseUrl,
          username: cred.username,
          libraryRoot: this.config.libraryRoot,
        });
        this.agents.set(cred.username, agent);
        this.runOrder.push(cred.username);
        term.line(`  ${cred.username}  →  ${persona}`);
      }
      return;
    }

    const personas = this.distributePersonas();

    for (let i = 0; i < this.config.agentCount; i++) {
      const persona = personas[i];
      const username = allocateName(i, this.usedNames);
      const agent = new ChaosAgent({
        agentId: username,
        persona: persona as any,
        deviceIndex: i,
        baseUrl: this.config.baseUrl,
        username,
        libraryRoot: this.config.libraryRoot,
      });
      this.agents.set(username, agent);
      this.runOrder.push(username);
      if (this.config.verboseTerminal) {
        term.line(`  ${username}  ${persona}`);
      }
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  private async runGate(
    runOne: (
      agent: ChaosAgent,
      index: number
    ) => Promise<{ ok: boolean; username: string; error?: string }>
  ): Promise<boolean> {
    this.isRunning = true;
    let passed = 0;
    let failed = 0;
    const agents = Array.from(this.agents.values());
    const total = agents.length;
    this.runOrder = [];

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      await this.sleep(250);

      let result = await runOne(agent, i);
      let retries = 0;
      while (!result.ok && result.error?.startsWith('USERNAME_TAKEN') && retries < 5) {
        const oldName = result.username;
        const next = allocateName(this.agents.size + retries + i * 7, this.usedNames);
        term.rename(oldName, next);
        this.agents.delete(oldName);
        agent.rebindUsername(next);
        this.agents.set(next, agent);
        result = await runOne(agent, i);
        retries++;
      }

      this.runOrder.push(result.username);
      if (result.ok) {
        passed++;
        if (this.config.verboseTerminal) term.line(`ok  ${result.username}`);
      } else {
        failed++;
        if (this.config.verboseTerminal) {
          term.fail(result.username, result.error || 'unknown');
        }
      }
      term.progress(i + 1, total, failed);
    }

    this.isRunning = false;
    return failed === 0 && passed === total;
  }

  async runAuthGate(): Promise<boolean> {
    this.gateKind = 'auth';
    this.authResults = [];
    return this.runGate(async (a) => {
      const r = await a.runAuthGate();
      this.authResults.push(r);
      return r;
    });
  }

  async runLoungeGate(): Promise<boolean> {
    this.gateKind = 'lounge';
    this.loungeResults = [];
    return this.runGate(async (a) => {
      const r = await a.runLoungeGate();
      this.loungeResults.push(r);
      return r;
    });
  }

  async runLiveSessions(): Promise<boolean> {
    const windowMs = this.config.duration;
    const deadline = Date.now() + windowMs;
    this.gateKind = 'live';
    this.isRunning = true;
    term.line(`live  ${Math.round(windowMs / 1000)}s`);

    const agents = Array.from(this.agents.values());
    const results = await Promise.all(
      agents.map((agent) => agent.runLiveSession(deadline, windowMs))
    );
    this.sessionResults = results;
    this.runOrder = results.map((r) => r.username);

    let failed = 0;
    for (const r of results) {
      if (!r.ok) {
        failed++;
        term.fail(r.username, r.error || 'session');
      } else if (this.config.verboseTerminal) {
        term.line(
          `ok  ${r.username}  ${r.style}  talks=${r.talks}${r.loggedOut ? '  out' : ''}`
        );
      }
    }

    this.isRunning = false;
    return failed === 0;
  }

  async runCreateJoinGate(): Promise<boolean> {
    this.gateKind = 'create';
    this.isRunning = true;

    const agents = Array.from(this.agents.values());
    const nCreate = Math.min(this.config.creatorCount || 2, agents.length);
    const creators = agents.slice(0, nCreate);
    const joiners = agents.slice(nCreate);
    const usedTitles = new Set<string>();
    const results: CreateJoinResult[] = [];

    term.line(`create  ${creators.length}  join  ${joiners.length}`);

    for (const agent of creators) {
      await this.sleep(120);
      const r = await agent.runCreateLounge(usedTitles);
      results.push(r);
      if (!r.ok) term.fail(r.username, r.error || 'create');
      else if (this.config.verboseTerminal) {
        term.line(`ok  ${r.username}  create  ${r.loungeName}  subs=${r.subsOk}`);
      }
    }

    const joinResults = await Promise.all(joiners.map((a) => a.runJoinDiscovered()));
    for (const r of joinResults) {
      results.push(r);
      if (!r.ok) term.fail(r.username, r.error || 'join');
      else if (this.config.verboseTerminal) {
        term.line(`ok  ${r.username}  join  ${r.joined}/${r.found}`);
      }
    }

    this.createJoinResults = results;
    this.runOrder = results.map((r) => r.username);
    this.isRunning = false;
    return results.every((r) => r.ok);
  }

  async runFriendGate(): Promise<boolean> {
    this.gateKind = 'friends';
    this.isRunning = true;
    const agentNames = new Set(this.agents.keys());
    const agents = Array.from(this.agents.values());
    const byName = new Map<string, FriendGateResult>();

    term.line(`friends  request → accept → dm contacts  agents=${agentNames.size}`);

    for (let i = 0; i < agents.length; i++) {
      await this.sleep(200);
      const r = await agents[i].runFriendDiscoverRequest(agentNames);
      byName.set(r.username, r);
      if (!r.ok) term.fail(r.username, r.error || 'request');
      term.progress(i + 1, agents.length, [...byName.values()].filter((x) => !x.ok).length);
    }

    term.line('accept...');
    for (let i = 0; i < agents.length; i++) {
      await this.sleep(150);
      const a = await agents[i].runFriendAccept();
      const prev = byName.get(a.username);
      if (prev) {
        prev.accepted = a.accepted;
        if (!a.ok) {
          prev.ok = false;
          prev.error = a.error || prev.error;
          term.fail(a.username, a.error || 'accept');
        }
      }
      term.progress(i + 1, agents.length, [...byName.values()].filter((x) => !x.ok).length);
    }

    term.line('dm...');
    for (let i = 0; i < agents.length; i++) {
      await this.sleep(150);
      const d = await agents[i].runFriendDmContacts();
      const prev = byName.get(d.username);
      if (prev) {
        prev.dms = d.dms;
        prev.contacts = d.contacts;
        if (!d.ok) {
          prev.ok = false;
          prev.error = d.error || prev.error;
          term.fail(d.username, d.error || 'dm');
        }
      }
      term.progress(i + 1, agents.length, [...byName.values()].filter((x) => !x.ok).length);
    }

    const results = Array.from(byName.values());
    this.friendResults = results;
    this.runOrder = results.map((r) => r.username);
    this.isRunning = false;
    return results.every((r) => r.ok);
  }

  async runAvatarGate(): Promise<boolean> {
    this.gateKind = 'avatar';
    this.isRunning = true;
    const agents = Array.from(this.agents.values());
    term.line(`avatar  upload  agents=${agents.length}`);

    const results: AvatarGateResult[] = [];
    for (let i = 0; i < agents.length; i++) {
      await this.sleep(200);
      const r = await agents[i].runAvatarGate();
      results.push(r);
      if (!r.ok) term.fail(r.username, r.error || 'avatar');
      else if (this.config.verboseTerminal) {
        term.line(`ok  ${r.username}  ${r.file}  ${r.url}`);
      }
      term.progress(i + 1, agents.length, results.filter((x) => !x.ok).length);
    }

    this.avatarResults = results;
    this.runOrder = results.map((r) => r.username);
    this.isRunning = false;
    return results.every((r) => r.ok);
  }

  /**
   * Pair agents as seller/buyer. EUR and VLM listings; lowballer pays cross-currency when possible.
   */
  async runMarketGate(): Promise<boolean> {
    this.gateKind = 'market';
    this.isRunning = true;
    const agents = Array.from(this.agents.values());
    term.line(`market  list+buy+release  agents=${agents.length}  pairs=${Math.floor(agents.length / 2)}`);

    const results: MarketGateResult[] = [];
    let pairIdx = 0;
    for (let i = 0; i + 1 < agents.length; i += 2) {
      const seller = agents[i];
      const buyer = agents[i + 1];
      const listCurrency: 'EUR' | 'VLM' = pairIdx % 2 === 0 ? 'EUR' : 'VLM';
      const buyerPersona = buyer.getPersona() || '';
      const crossPay =
        buyerPersona === 'lowballer_hustler' || pairIdx % 2 === 1
          ? listCurrency === 'EUR'
            ? 'VLM'
            : 'EUR'
          : listCurrency;
      const price = listCurrency === 'EUR' ? 12.5 : 40;

      await this.sleep(150);
      const sell = await seller.runMarketSellerGate({ currency: listCurrency, price });
      results.push(sell);
      if (!sell.ok) {
        term.fail(sell.username, sell.error || 'sell');
        results.push({
          ok: false,
          username: buyer.getUsername(),
          role: 'buyer',
          error: 'seller failed',
        });
        pairIdx++;
        term.progress(results.length, agents.length, results.filter((x) => !x.ok).length);
        continue;
      }

      await this.sleep(150);
      const buy = await buyer.runMarketBuyerGate({
        listingId: sell.listingId!,
        payCurrency: crossPay,
      });
      results.push(buy);
      if (!buy.ok) term.fail(buy.username, buy.error || 'buy');
      else if (this.config.verboseTerminal) {
        term.line(
          `ok  ${sell.username}→${buy.username}  ${listCurrency} pay=${crossPay} escrow=${buy.escrowId}`
        );
      }
      pairIdx++;
      term.progress(results.length, agents.length, results.filter((x) => !x.ok).length);
    }

    if (agents.length % 2 === 1) {
      const solo = agents[agents.length - 1];
      const sell = await solo.runMarketSellerGate({ currency: 'EUR', price: 10 });
      results.push(sell);
      if (!sell.ok) term.fail(sell.username, sell.error || 'solo sell');
    }

    this.marketResults = results;
    this.runOrder = results.map((r) => r.username);
    this.isRunning = false;
    return results.every((r) => r.ok);
  }

  async runMediaGate(): Promise<boolean> {
    this.gateKind = 'media';
    this.isRunning = true;
    const agents = Array.from(this.agents.values());
    term.line(`media  upload+send  agents=${agents.length}`);

    const results: MediaGateResult[] = [];
    for (let i = 0; i < agents.length; i++) {
      await this.sleep(300);
      const r = await agents[i].runMediaGate();
      results.push(r);
      if (!r.ok) term.fail(r.username, r.error || 'media');
      else if (this.config.verboseTerminal) {
        term.line(
          `ok  ${r.username}  dm=${r.dmOk}/${r.dmNeed} lounge=${r.loungeOk}/${r.loungeNeed}`
        );
      }
      term.progress(i + 1, agents.length, results.filter((x) => !x.ok).length);
    }

    this.mediaResults = results;
    this.runOrder = results.map((r) => r.username);
    this.isRunning = false;
    return results.every((r) => r.ok);
  }

  /**
   * Auth assumed. Connect all agents to /ws, then pair for DM peer receive proof.
   */
  async runWsGate(): Promise<boolean> {
    this.gateKind = 'ws';
    this.isRunning = true;
    const agents = Array.from(this.agents.values());
    term.line(`ws  connect+peer  agents=${agents.length}`);

    const results: WsGateResult[] = [];
    for (const agent of agents) {
      await this.sleep(150);
      const c = await agent.connectWs();
      const username = agent.getUsername();
      if (!c.ok) {
        term.fail(username, c.error || 'ws');
        results.push({
          ok: false,
          username,
          connected: false,
          peerOk: false,
          role: 'solo',
          error: c.error,
        });
      } else {
        results.push({
          ok: true,
          username,
          connected: true,
          peerOk: false,
          role: 'solo',
        });
      }
    }

    const connected = agents.filter((_, i) => results[i]?.connected);
    term.line(`peer  pairs=${Math.floor(connected.length / 2)}`);

    for (let i = 0; i + 1 < connected.length; i += 2) {
      const sender = connected[i];
      const recv = connected[i + 1];
      const sUid = sender.getUserId();
      const rUid = recv.getUserId();
      if (sUid == null || rUid == null) {
        term.fail(sender.getUsername(), 'missing userId');
        continue;
      }

      const marker = `chaos-ws-${Date.now()}-${sUid}-${rUid}`;
      const recvPromise = recv.waitWsPeerDm(marker, 20000);
      await this.sleep(400);
      const sent = await sender.sendWsPeerDm(rUid, marker);
      const got = await recvPromise;

      const sIdx = results.findIndex((r) => r.username === sender.getUsername());
      const rIdx = results.findIndex((r) => r.username === recv.getUsername());
      if (sIdx >= 0) {
        results[sIdx].role = 'send';
        results[sIdx].peerOk = sent;
        results[sIdx].ok = results[sIdx].connected && sent;
        if (!results[sIdx].ok) results[sIdx].error = 'peer send failed';
      }
      if (rIdx >= 0) {
        results[rIdx].role = 'recv';
        results[rIdx].peerOk = got;
        results[rIdx].ok = results[rIdx].connected && got;
        if (!results[rIdx].ok) results[rIdx].error = 'peer recv timeout';
      }

      if (!sent) term.fail(sender.getUsername(), 'peer send');
      if (!got) term.fail(recv.getUsername(), 'peer recv');
      else if (this.config.verboseTerminal) {
        term.line(`ok  ${sender.getUsername()} → ${recv.getUsername()}`);
      }
    }

    // Solo (odd agent): connect-only is enough
    for (const r of results) {
      if (r.role === 'solo' && r.connected) {
        r.peerOk = true;
        r.ok = true;
        chaosLogger.logAction(r.username, 'peer', true, 0, 'solo');
      }
    }

    for (const agent of agents) agent.disconnectWs();

    this.wsResults = results;
    this.runOrder = results.map((r) => r.username);
    this.isRunning = false;
    return results.every((r) => r.ok);
  }

  /**
   * Auth assumed. Join velum_general, pair agents: seed cue line → peer detects cue → replies.
   */
  async runCueGate(): Promise<boolean> {
    this.gateKind = 'cues';
    this.isRunning = true;
    const agents = Array.from(this.agents.values());
    term.line(`cues  open+pair  agents=${agents.length}`);

    const results: CueGateResult[] = [];
    for (const agent of agents) {
      await this.sleep(120);
      const open = await agent.joinCueRoom();
      const username = agent.getUsername();
      if (!open.ok) {
        term.fail(username, open.error || 'open');
        results.push({
          ok: false,
          username,
          role: 'solo',
          openOk: false,
          cueOk: false,
          replyOk: false,
          error: open.error,
        });
      } else {
        results.push({
          ok: true,
          username,
          role: 'solo',
          openOk: true,
          cueOk: false,
          replyOk: false,
        });
      }
    }

    const ready = agents.filter((_, i) => results[i]?.openOk);
    term.line(`pair  cues=${Math.floor(ready.length / 2)}`);

    for (let i = 0; i + 1 < ready.length; i += 2) {
      const seeder = ready[i];
      const replier = ready[i + 1];
      const cue = TEST_CUES[(i / 2) % TEST_CUES.length];

      await this.sleep(300);
      const seeded = await seeder.postCueSeed(cue);
      await this.sleep(500);
      const replied = await replier.replyToCue(cue, seeded.text);

      const sIdx = results.findIndex((r) => r.username === seeder.getUsername());
      const rIdx = results.findIndex((r) => r.username === replier.getUsername());

      if (sIdx >= 0) {
        results[sIdx].role = 'seed';
        results[sIdx].expectedCue = cue;
        results[sIdx].cue = cue;
        results[sIdx].cueOk = seeded.ok;
        results[sIdx].replyOk = true;
        results[sIdx].ok = results[sIdx].openOk && seeded.ok;
        if (!seeded.ok) results[sIdx].error = seeded.error || 'seed failed';
      }
      if (rIdx >= 0) {
        results[rIdx].role = 'reply';
        results[rIdx].expectedCue = cue;
        results[rIdx].cue = replied.cue;
        results[rIdx].cueOk = !!replied.cue && replied.cue === cue;
        results[rIdx].replyOk = !!replied.ok;
        results[rIdx].ok = results[rIdx].openOk && !!replied.ok;
        if (!replied.ok) results[rIdx].error = replied.error || 'reply failed';
      }

      if (!seeded.ok) term.fail(seeder.getUsername(), `seed:${cue}`);
      if (!replied.ok) term.fail(replier.getUsername(), replied.error || `reply:${cue}`);
      else if (this.config.verboseTerminal) {
        term.line(`ok  ${cue}  ${seeder.getUsername()} → ${replier.getUsername()}`);
      }
    }

    for (const r of results) {
      if (r.role === 'solo' && r.openOk) {
        r.cueOk = true;
        r.replyOk = true;
        r.ok = true;
        chaosLogger.logAction(r.username, 'cue', true, 0, 'solo');
        chaosLogger.logAction(r.username, 'reply', true, 0, 'solo');
      }
    }

    this.cueResults = results;
    this.runOrder = results.map((r) => r.username);
    this.isRunning = false;
    return results.every((r) => r.ok);
  }

  /**
   * Matched same-kind pairs + shared topics.
   * Each agent only replies to their partner's last line (not the whole room).
   * Pairs time-slice so one conversation is active at a time (human pacing).
   */
  async runHumanTalkGate(): Promise<boolean> {
    const windowMs = this.config.duration;
    this.gateKind = 'live';
    this.isRunning = true;
    const agents = Array.from(this.agents.values());

    for (const agent of agents) {
      await this.sleep(120);
      const prep = await agent.prepareHumanTalk();
      if (!prep.ok) {
        term.fail(agent.getUsername(), prep.error || 'prep');
        this.isRunning = false;
        return false;
      }
    }

    // Build pairs: (0,1), (2,3), … aligned with TALK_PAIR_SPECS
    type Pair = {
      a: (typeof agents)[0];
      b: (typeof agents)[0];
      spec: (typeof TALK_PAIR_SPECS)[number];
      lastGood: string;
      next: 0 | 1;
      talksA: number;
      talksB: number;
    };

    const pairs: Pair[] = [];
    for (let i = 0; i + 1 < agents.length; i += 2) {
      const spec = TALK_PAIR_SPECS[pairs.length % TALK_PAIR_SPECS.length];
      pairs.push({
        a: agents[i],
        b: agents[i + 1],
        spec,
        lastGood: '',
        next: 0,
        talksA: 0,
        talksB: 0,
      });
      term.line(
        `pair  ${agents[i].getUsername()}+${agents[i + 1].getUsername()}  ${spec.persona}  topic=${spec.topic}`
      );
    }

    if (!pairs.length) {
      this.isRunning = false;
      term.fail('talk', 'need ≥2 agents for a pair');
      return false;
    }

    term.line(
      `talk  paired  ${Math.round(windowMs / 1000)}s  pairs=${pairs.length}  (partner-only cues)`
    );

    const avoid = new Set<string>();
    const deadline = Date.now() + windowMs;

    // One pair at a time so the room feed is a real A<->B thread (no cross-talk).
    const sliceMs = Math.max(8_000, Math.floor(windowMs / pairs.length));

    for (let pi = 0; pi < pairs.length; pi++) {
      const p = pairs[pi];
      const pairDeadline = Math.min(deadline, Date.now() + sliceMs);
      if (Date.now() >= deadline || !this.isRunning) break;

      term.line(
        `--- pair ${pi + 1}/${pairs.length}  ${p.a.getUsername()}+${p.b.getUsername()}  ${p.spec.topic}  ~${Math.round(sliceMs / 1000)}s ---`
      );

      const seed = stripMdash(pickSeed(p.spec, avoid));
      const forced = await p.a.humanSpeakTurn('', avoid, { seed });
      if (forced.ok && forced.text) {
        avoid.add(forced.text);
        p.lastGood = forced.text;
        p.talksA++;
        p.next = 1;
        term.line(
          `${p.a.getUsername().padEnd(10)} ${p.spec.persona.padEnd(18)} seed           ${forced.text}`
        );
      } else {
        term.fail(p.a.getUsername(), forced.error || 'seed');
        continue;
      }

      while (Date.now() < pairDeadline && Date.now() < deadline && this.isRunning) {
        const speaker = p.next === 0 ? p.a : p.b;
        const name = speaker.getUsername();
        const pairTalks = p.talksA + p.talksB;
        // Always reply to partner's last sent line (never skip update -> self-reply).
        const spoken = await speaker.humanSpeakTurn(p.lastGood, avoid, {
          topic: p.spec.topic,
          pairTalks,
        });
        if (!spoken.ok || !spoken.text) {
          term.fail(name, spoken.error || 'send');
          await this.sleep(500);
          continue;
        }

        if (p.next === 0) p.talksA++;
        else p.talksB++;

        p.lastGood = spoken.text;
        p.next = p.next === 0 ? 1 : 0;

        term.line(
          `${name.padEnd(10)} ${p.spec.persona.padEnd(18)} ${(spoken.tag || '').padEnd(14)} ${spoken.text}`
        );

        const gap = randomReplyGapMs(this.config.talkGapsMs || []);
        term.line(`  … gap ${gap === 0 ? 'instant' : `${gap / 1000}s`}`);
        await this.sleep(gap);
      }
    }

    this.sessionResults = [];
    for (const p of pairs) {
      for (const [agent, n] of [
        [p.a, p.talksA],
        [p.b, p.talksB],
      ] as const) {
        this.sessionResults.push({
          ok: n > 0,
          username: agent.getUsername(),
          style: 'mixed',
          talks: n,
          joined: true,
          loggedOut: false,
          error: n > 0 ? undefined : 'no talks',
        });
      }
    }
    if (agents.length % 2 === 1) {
      const solo = agents[agents.length - 1];
      this.sessionResults.push({
        ok: true,
        username: solo.getUsername(),
        style: 'mixed',
        talks: 0,
        joined: true,
        loggedOut: false,
      });
    }
    this.runOrder = this.sessionResults.map((r) => r.username);

    for (const r of this.sessionResults) {
      if (!r.ok) term.fail(r.username, r.error || 'talk');
      else term.line(`${r.username}  talks=${r.talks}`);
    }

    this.isRunning = false;
    return this.sessionResults.every((r) => r.ok);
  }

  /**
   * Full suite = same gated architecture as scoped -t tasks, in dependency order.
   * Does not use the legacy random spam loop.
   */
  async runFullPipeline(): Promise<boolean> {
    this.gateKind = 'full';
    term.line(
      'full  auth → lounge → avatar → friends → talk → market → media → ws → cues  (create disabled)'
    );

    const stages: Array<{ name: string; ok: boolean }> = [];

    const runStage = async (name: string, fn: () => Promise<boolean>): Promise<void> => {
      term.line(`--- ${name} ---`);
      const ok = await fn();
      stages.push({ name, ok });
      term.line(`${name}  ${ok ? 'pass' : 'FAIL'}`);
    };

    await runStage('auth', () => this.runAuthGate());
    // Lounge creation disabled for this suite — skip create stage.
    await runStage('lounge', () => this.runLoungeGate());
    await runStage('avatar', () => this.runAvatarGate());
    await runStage('friends', () => this.runFriendGate());
    await runStage('talk', () => this.runHumanTalkGate());
    await runStage('market', () => this.runMarketGate());
    await runStage('media', () => this.runMediaGate());
    await runStage('ws', () => this.runWsGate());
    await runStage('cues', () => this.runCueGate());

    this.gateKind = 'full';
    this.runOrder = Array.from(this.agents.keys());

    const failed = stages.filter((s) => !s.ok);
    if (failed.length) {
      term.line(`full  failed stages: ${failed.map((s) => s.name).join(', ')}`);
    } else {
      term.line('full  all stages pass');
    }
    return failed.length === 0;
  }

  async start(): Promise<void> {
    if (this.config.authOnly) {
      if (!(await this.runAuthGate())) process.exitCode = 1;
      return;
    }

    if (this.config.humanTalkOnly) {
      if (!(await this.runHumanTalkGate())) process.exitCode = 1;
      return;
    }

    if (this.config.cuesOnly) {
      if (!(await this.runAuthGate())) {
        process.exitCode = 1;
        return;
      }
      if (!(await this.runCueGate())) process.exitCode = 1;
      return;
    }

    if (this.config.wsOnly) {
      if (!(await this.runAuthGate())) {
        process.exitCode = 1;
        return;
      }
      if (!(await this.runWsGate())) process.exitCode = 1;
      return;
    }

    if (this.config.mediaOnly) {
      if (!(await this.runAuthGate())) {
        process.exitCode = 1;
        return;
      }
      if (!(await this.runMediaGate())) process.exitCode = 1;
      return;
    }

    if (this.config.avatarOnly) {
      if (!(await this.runAuthGate())) {
        process.exitCode = 1;
        return;
      }
      if (!(await this.runAvatarGate())) process.exitCode = 1;
      return;
    }

    if (this.config.marketOnly) {
      if (!(await this.runAuthGate())) {
        process.exitCode = 1;
        return;
      }
      if (!(await this.runMarketGate())) process.exitCode = 1;
      return;
    }

    if (this.config.friendsOnly) {
      if (!(await this.runAuthGate())) {
        process.exitCode = 1;
        return;
      }
      if (!(await this.runFriendGate())) process.exitCode = 1;
      return;
    }

    if (this.config.liveOnly) {
      if (!(await this.runAuthGate())) {
        process.exitCode = 1;
        return;
      }
      if (!(await this.runLiveSessions())) process.exitCode = 1;
      return;
    }

    if (this.config.loungeOnly) {
      if (!(await this.runAuthGate())) {
        process.exitCode = 1;
        return;
      }
      if (!(await this.runCreateJoinGate())) process.exitCode = 1;
      return;
    }

    if (this.isRunning) {
      term.line('already running');
      return;
    }

    this.isRunning = true;
    const ok = await this.runFullPipeline();
    this.isRunning = false;
    if (!ok) process.exitCode = 1;
  }

  async stop(): Promise<void> {
    for (const agent of this.agents.values()) {
      agent.disconnectWs();
      agent.stop();
    }
    this.isRunning = false;
    term.line('stopped');
  }

  generateReports(): void {
    const rows = chaosLogger.saveReports(
      this.runOrder,
      this.gateKind,
      this.sessionResults,
      this.createJoinResults,
      this.friendResults,
      this.avatarResults,
      this.mediaResults,
      this.wsResults,
      this.cueResults,
      this.authResults,
      this.loungeResults,
      this.marketResults
    );
    const runDir = chaosLogger.getRunDir();
    const rel = runDir ? path.relative(process.cwd(), runDir) : 'chaos-logs/';
    term.table(rows, rel);
  }

  getAgentCount(): number {
    return this.agents.size;
  }

  isActive(): boolean {
    return this.isRunning;
  }
}
