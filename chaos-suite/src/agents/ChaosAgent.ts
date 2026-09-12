import { VelumApiClient, VelumUser, VelumLounge } from './VelumApiClient.js';
import { VelumCredentials } from './VelumApiClient.js';
import { chaosLogger } from '../utils/chaosLogger.js';
import { persistenceManager } from '../utils/persistence.js';
import { identityForUsername } from '../data/naming.js';
import { master, rooms } from '../data/lounges.js';
import { lineFor, preferredRooms } from '../data/talk.js';
import { logoutAfterMs, styleFor, talkGapMs, type LiveStyle } from '../data/behavior.js';
import {
  MIN_SUBLOUNGES,
  pickLoungeBlurb,
  pickLoungeTitle,
  pickSubloungeNames,
} from '../data/loungeNames.js';
import { isProtectedUser } from '../data/protectedUsers.js';
import { dmLine } from '../data/dmTalk.js';
import {
  DEFAULT_LIBRARY_ROOT,
  attachmentMessage,
  formatByteSize,
  mimeForImage,
  mimeForMedia,
  pickAvatarPath,
  pickMediaPath,
} from '../data/library.js';
import { mediaCaption } from '../data/mediaTalk.js';
import {
  detectCue,
  replyForCue,
  seedForCue,
  type CueId,
} from '../data/cues.js';
import {
  personaOf,
  talkGapMs as humanTalkGapMs,
  type PersonaId,
} from '../data/human/personas.js';
import { pickTalkLine } from '../data/human/banks/index.js';
import { stripMdash } from '../data/human/talkReply.js';
import { isDeadFiller } from '../data/human/cues/detect.js';
import { WsClient, httpBaseToWsUrl } from './WsClient.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface AuthGateResult {
  ok: boolean;
  username: string;
  userId?: number;
  steps: string[];
  error?: string;
}

export interface LoungeGateResult {
  ok: boolean;
  username: string;
  userId?: number;
  steps: string[];
  roomsOk?: number;
  roomsNeed?: number;
  error?: string;
}

export interface SessionResult {
  ok: boolean;
  username: string;
  style: LiveStyle;
  talks: number;
  joined: boolean;
  loggedOut: boolean;
  error?: string;
}

export interface CreateJoinResult {
  ok: boolean;
  username: string;
  role: 'create' | 'join';
  loungeName?: string;
  subsOk?: number;
  subsNeed?: number;
  found?: number;
  joined?: number;
  error?: string;
}

export interface FriendGateResult {
  ok: boolean;
  username: string;
  found: number;
  outsiders: number;
  sent: number;
  soft: number;
  accepted: number;
  dms: number;
  contacts: number;
  error?: string;
}

export interface AvatarGateResult {
  ok: boolean;
  username: string;
  file?: string;
  url?: string;
  error?: string;
}

export interface MarketGateResult {
  ok: boolean;
  username: string;
  role: 'seller' | 'buyer';
  listingId?: number;
  escrowId?: number;
  currency?: string;
  payCurrency?: string;
  error?: string;
}

export interface MediaGateResult {
  ok: boolean;
  username: string;
  file?: string;
  url?: string;
  dmOk?: number;
  dmNeed?: number;
  loungeOk?: number;
  loungeNeed?: number;
  error?: string;
}

export interface WsGateResult {
  ok: boolean;
  username: string;
  connected: boolean;
  peerOk: boolean;
  role: 'send' | 'recv' | 'solo';
  error?: string;
}

export interface CueGateResult {
  ok: boolean;
  username: string;
  role: 'seed' | 'reply' | 'solo';
  cue?: CueId;
  expectedCue?: CueId;
  openOk: boolean;
  cueOk: boolean;
  replyOk: boolean;
  error?: string;
}

const CUE_ROOM = 'velum_general';

const MAX_FRIEND_REQUESTS = 3;
const MAX_MEDIA_DM = 3;
const MEDIA_LOUNGE_ROOMS = ['velum_general', 'velum_offtopic'] as const;

type PersonaType =
  | 'social'
  | 'casual'
  | 'tech'
  | 'drama'
  | 'support'
  | 'attention';

interface AgentConfig {
  agentId: string;
  persona: PersonaType | string;
  deviceIndex: number;
  baseUrl: string;
  username: string;
  libraryRoot?: string;
}

const TIMING_VARIANCE = () => Math.random() * 2000 - 1000;
const BASE_INTERVALS: Record<PersonaType, { min: number; max: number }> = {
  social: { min: 2000, max: 8000 },
  casual: { min: 4000, max: 15000 },
  tech: { min: 3000, max: 9000 },
  drama: { min: 2500, max: 7000 },
  support: { min: 4000, max: 12000 },
  attention: { min: 1500, max: 6000 },
};

const TICKET_TEMPLATES = [
  { reason: 'Bug report', descriptions: ['Experiencing connectivity issues with messaging', 'Messages not displaying in correct order', 'App crashes when joining large lounges', 'Typo in settings menu', 'Profile picture upload failing randomly'] },
  { reason: 'Feature request', descriptions: ['Would like dark mode implemented', 'Please add notification sound options', 'Need message search functionality', 'Add ability to pin important conversations', 'Custom emoji support needed'] },
  { reason: 'Account issue', descriptions: ['Unable to update profile picture', 'Two-factor authentication not working', 'Email verification not sending', 'Password reset link expired', 'Account showing as offline when active'] },
  { reason: 'Technical support', descriptions: ['Getting error when trying to create lounge', 'Unable to delete old messages', 'Lounge invite codes not working', 'Blocked user still appearing in search', 'Mute settings not persisting'] },
  { reason: 'Abuse report', descriptions: ['User sending inappropriate content', 'Spam bot in general lounge', 'Harassment in private messages', 'User sharing malicious links', 'Impersonation of another user'] }
];

const MESSAGE_TEMPLATES: Record<PersonaType, string[]> = {
  social: [
    'Hey everyone, how is it going today?',
    'Who wants to chat? Always happy to meet people.',
    'This is my favorite place to hang out',
    'Anyone else feel like hanging out tonight?',
    'Has anyone made any new friends lately?',
    'I love how we can all be ourselves here',
  ],
  casual: [
    'Hey, what is going on?',
    'Just popping in to say hi',
    'What has everyone been up to?',
    'Just chilling, thought I would say hello',
    'Anyone else just relaxing today?',
    'I am in a pretty good mood today',
  ],
  tech: [
    'Has anyone checked out the latest updates?',
    'Been experimenting with some new techniques',
    'Anyone interested in recent software changes?',
    'What is everyone take on the new APIs?',
    'Been optimizing some of my tooling',
    'Anyone else working on a side project?',
  ],
  drama: [
    'Can you believe what just happened?',
    'I am so done with this place',
    'You will not believe what they said',
    'This is so unfair',
    'Everyone needs to see this',
    'Someone needs to do something about this',
  ],
  support: [
    'Can someone help me with this issue?',
    'I am having trouble with my account',
    'Does anyone know how to fix this?',
    'Is there a moderator available?',
    'I think I found a bug',
    'I need help with my settings',
  ],
  attention: [
    'Look at this',
    'Did anyone notice me join?',
    'I need opinions on something right now',
    'Reply if you are here',
    'This needs more eyes on it',
    'Why is nobody talking about this?',
  ],
};

export class ChaosAgent {
  private client: VelumApiClient;
  private config: AgentConfig;
  private credentials: VelumCredentials;
  private isRunning: boolean = false;
  private actionCount: number = 0;

  private discoveredUsers: VelumUser[] = [];
  private discoveredLounges: VelumLounge[] = [];
  private currentLounge: VelumLounge | null = null;
  private currentSublounge: VelumLounge | null = null;
  private mutedByAdmin: boolean = false;
  private compromised: boolean = false;
  private lastActionTime: number = Date.now();
  private ws: WsClient | null = null;

  constructor(config: AgentConfig) {
    this.config = config;

    const username = config.username;
    const existingCreds = persistenceManager.getCredentials(username);
    const named = identityForUsername(username);

    if (existingCreds) {
      this.credentials = {
        username: existingCreds.username,
        password: existingCreds.password,
        panicPhrase: existingCreds.panicPhrase || named.panicPhrase,
        safeWord: existingCreds.safeWord || named.safeWord,
        salt: existingCreds.salt
      };
    } else {
      this.credentials = {
        username: named.username,
        password: named.password,
        panicPhrase: named.panicPhrase,
        safeWord: named.safeWord,
      };
    }

    this.client = new VelumApiClient(this.credentials, config.baseUrl);
    chaosLogger.initializeBot(config.agentId, config.persona);
  }

  private async sleep(ms: number): Promise<void> {
    const variance = TIMING_VARIANCE();
    await new Promise(resolve => setTimeout(resolve, Math.max(0, ms + variance)));
  }

  private getRandomInterval(): number {
    const p = String(this.config.persona);
    const key = (
      p === 'social' ||
      p === 'casual' ||
      p === 'tech' ||
      p === 'drama' ||
      p === 'support' ||
      p === 'attention'
        ? p
        : 'casual'
    ) as PersonaType;
    const base = BASE_INTERVALS[key];
    return base.min + Math.random() * (base.max - base.min);
  }

  private getRandomMessage(): string {
    const p = String(this.config.persona);
    const key = (
      p === 'social' ||
      p === 'casual' ||
      p === 'tech' ||
      p === 'drama' ||
      p === 'support' ||
      p === 'attention'
        ? p
        : 'casual'
    ) as PersonaType;
    const templates = MESSAGE_TEMPLATES[key] || MESSAGE_TEMPLATES.casual;
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private getRandomTicket(): { reason: string; description: string } {
    const template = TICKET_TEMPLATES[Math.floor(Math.random() * TICKET_TEMPLATES.length)];
    const description = template.descriptions[Math.floor(Math.random() * template.descriptions.length)];
    return { reason: template.reason, description };
  }

  private async discoverUsers(): Promise<void> {
    const startTime = Date.now();
    const result = await this.client.searchUsers('');
    const latency = Date.now() - startTime;

    chaosLogger.logAction(
      this.config.agentId,
      'user_discovery',
      result.success,
      latency,
      result.error
    );

    if (result.success && result.data?.users) {
      this.discoveredUsers = result.data.users;
    }
  }

  private async discoverLounges(): Promise<void> {
    const startTime = Date.now();
    const result = await this.client.getLounges();
    const latency = Date.now() - startTime;

    chaosLogger.logAction(
      this.config.agentId,
      'lounge_discovery',
      result.success,
      latency,
      result.error
    );

    if (result.success && result.data?.lounges) {
      this.discoveredLounges = result.data.lounges;

      if (this.discoveredLounges.length > 0) {
        this.currentLounge = this.discoveredLounges[Math.floor(Math.random() * this.discoveredLounges.length)];

        if (this.currentLounge.sublounges && this.currentLounge.sublounges.length > 0) {
          this.currentSublounge = this.currentLounge.sublounges[Math.floor(Math.random() * this.currentLounge.sublounges.length)];
        }
      }
    }
  }


  rebindUsername(username: string): void {
    const oldId = this.config.agentId;
    const named = identityForUsername(username);
    this.credentials = {
      username: named.username,
      password: named.password,
      panicPhrase: named.panicPhrase,
      safeWord: named.safeWord,
    };
    this.client.setCredentials(this.credentials);
    this.config = { ...this.config, agentId: username, username };
    if (oldId !== username) {
      chaosLogger.renameBot(oldId, username, this.config.persona);
    } else {
      chaosLogger.initializeBot(username, this.config.persona);
    }
  }

  private persistCredentials(userId?: number): void {
    persistenceManager.storeCredentials({
      username: this.credentials.username,
      password: this.credentials.password,
      panicPhrase: this.credentials.panicPhrase,
      safeWord: this.credentials.safeWord,
      salt: this.credentials.salt,
      userId,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      persona: String(this.config.persona),
      isActive: true,
      isTestUser: true,
      testTags: ['chaos-test', 'automated'],
    });
  }


  async runAuthGate(): Promise<AuthGateResult> {
    const steps: string[] = [];
    const username = this.credentials.username;

    const fail = (error: string): AuthGateResult => ({
      ok: false,
      username,
      steps,
      error,
    });

    const ping = await this.client.ping();
    chaosLogger.logAction(
      this.config.agentId,
      'ping',
      ping.success,
      ping.latency || 0,
      ping.error
    );
    if (!ping.success) {
      return fail(`ping failed: ${ping.error || 'unreachable'}`);
    }
    steps.push('ping');

    let login = await this.client.login();
    chaosLogger.logAction(this.config.agentId, 'login', login.success, login.latency || 0, login.error);
    if (login.success) {
      steps.push('login');
    } else {
      const reg = await this.client.register();
      chaosLogger.logAction(this.config.agentId, 'register', reg.success, reg.latency || 0, reg.error);
      if (!reg.success) {
        const taken =
          reg.statusCode === 409 ||
          /already|taken|registered|conflict/i.test(String(reg.error || ''));
        return fail(taken ? `USERNAME_TAKEN:${reg.error || 'conflict'}` : `register failed: ${reg.error}`);
      }
      steps.push('register');
      this.persistCredentials(this.client.getUserId());
    }

    const userIdAfterAuth = this.client.getUserId();
    if (userIdAfterAuth == null) {
      return fail('missing userId after auth');
    }
    this.persistCredentials(userIdAfterAuth);

    const logout = await this.client.logout();
    chaosLogger.logAction(this.config.agentId, 'logout', logout.success, logout.latency || 0, logout.error);
    if (!logout.success) {
      this.client.clearSession();
    }
    steps.push('logout');
    if (this.client.isAuthenticated()) {
      return fail('session still set after logout');
    }

    login = await this.client.login();
    chaosLogger.logAction(this.config.agentId, 'relogin', login.success, login.latency || 0, login.error);
    if (!login.success) {
      return fail(`relogin failed: ${login.error}`);
    }
    steps.push('relogin');

    const userId = this.client.getUserId();
    if (userId == null) {
      return fail('missing userId after relogin');
    }
    this.persistCredentials(userId);

    return { ok: true, username, userId, steps };
  }


  async runLoungeGate(_opts: { create?: boolean } = {}): Promise<LoungeGateResult> {
    const steps: string[] = [];
    const username = this.credentials.username;
    const need = rooms.length;

    const fail = (error: string, extra?: Partial<LoungeGateResult>): LoungeGateResult => ({
      ok: false,
      username,
      steps,
      roomsNeed: need,
      ...extra,
      error,
    });

    const ping = await this.client.ping();
    chaosLogger.logAction(this.config.agentId, 'ping', ping.success, ping.latency || 0, ping.error);
    if (!ping.success) return fail(`ping: ${ping.error || 'down'}`);
    steps.push('ping');

    const login = await this.client.login();
    chaosLogger.logAction(this.config.agentId, 'login', login.success, login.latency || 0, login.error);
    if (login.success) {
      steps.push('login');
    } else {
      const reg = await this.client.register();
      chaosLogger.logAction(this.config.agentId, 'register', reg.success, reg.latency || 0, reg.error);
      if (!reg.success) {
        const taken =
          reg.statusCode === 409 ||
          /already|taken|registered|conflict/i.test(String(reg.error || ''));
        return fail(taken ? `USERNAME_TAKEN:${reg.error || 'conflict'}` : `register: ${reg.error}`);
      }
      steps.push('register');
    }

    const userId = this.client.getUserId();
    if (userId == null) return fail('no userId');
    this.persistCredentials(userId);

    const jMaster = await this.client.joinLounge(master);
    chaosLogger.logAction(
      this.config.agentId,
      'join',
      jMaster.success,
      jMaster.latency || 0,
      jMaster.error
    );
    if (!jMaster.success) return fail(`join: ${jMaster.error}`);
    steps.push('join');

    let roomsOk = 0;
    for (const slug of rooms) {
      const j = await this.client.joinLounge(slug);
      chaosLogger.logAction(this.config.agentId, slug, j.success, j.latency || 0, j.error);
      if (j.success) {
        roomsOk++;
        steps.push(slug);
      }
    }
    chaosLogger.logAction(
      this.config.agentId,
      'rooms',
      roomsOk === need,
      0,
      roomsOk === need ? undefined : `${roomsOk}/${need}`
    );
    if (roomsOk !== need) {
      return fail(`rooms ${roomsOk}/${need}`, { roomsOk, roomsNeed: need });
    }

    let talkOk = 0;
    let talkMs = 0;
    for (const slug of rooms) {
      const text = lineFor(slug);
      const t0 = Date.now();
      const sent = await this.client.sendMessage(slug, text);
      if (!sent.success) {
        chaosLogger.logAction(
          this.config.agentId,
          `talk:${slug}`,
          false,
          sent.latency || Date.now() - t0,
          sent.error
        );
        return fail(`talk ${slug}: ${sent.error}`, { roomsOk });
      }

      const got = await this.client.getMessages(slug, 20);
      const found =
        !!got.success &&
        Array.isArray(got.data) &&
        got.data.some(
          (m) =>
            m.content === text &&
            (m.senderId === userId || (m as { user_id?: number }).user_id === userId)
        );
      const ms = (sent.latency || 0) + (got.latency || 0);
      talkMs += ms;
      chaosLogger.logAction(
        this.config.agentId,
        `talk:${slug}`,
        found,
        ms,
        found ? undefined : got.error || 'not found'
      );
      if (!found) return fail(`read ${slug}`, { roomsOk });
      talkOk++;
      steps.push(`talk:${slug}`);
    }

    chaosLogger.logAction(
      this.config.agentId,
      'talk',
      talkOk === need,
      talkMs,
      talkOk === need ? undefined : `${talkOk}/${need}`
    );
    if (talkOk !== need) return fail(`talk ${talkOk}/${need}`, { roomsOk });

    return {
      ok: true,
      username,
      userId,
      steps,
      roomsOk,
      roomsNeed: need,
    };
  }

  private async sleepPlain(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  private async joinForStyle(style: LiveStyle): Promise<boolean> {
    if (style === 'idle') {
      chaosLogger.logAction(this.config.agentId, 'join', true, 0, 'skip');
      return false;
    }

    const jMaster = await this.client.joinLounge(master);
    chaosLogger.logAction(
      this.config.agentId,
      'join',
      jMaster.success,
      jMaster.latency || 0,
      jMaster.error
    );
    if (!jMaster.success) return false;

    const targets =
      style === 'bounce'
        ? (['velum_general'] as const)
        : preferredRooms(this.config.persona);

    let ok = 0;
    for (const slug of targets) {
      const j = await this.client.joinLounge(slug);
      chaosLogger.logAction(this.config.agentId, slug, j.success, j.latency || 0, j.error);
      if (j.success) ok++;
    }
    chaosLogger.logAction(
      this.config.agentId,
      'rooms',
      ok > 0,
      0,
      ok > 0 ? undefined : 'none'
    );
    return ok > 0;
  }

  private async talkOnce(room: string): Promise<boolean> {
    const got = await this.client.getMessages(room, 12);
    const mine = this.client.getUserId();
    let lastOther = '';
    if (got.success && Array.isArray(got.data) && got.data.length) {
      const last = [...got.data].reverse().find((m) => m.senderId !== mine);
      lastOther = last?.content || '';
    }

    const text = lineFor(room, lastOther);
    const sent = await this.client.sendMessage(room, text);
    chaosLogger.logAction(
      this.config.agentId,
      `talk:${room}`,
      sent.success,
      sent.latency || 0,
      sent.error
    );
    return !!sent.success;
  }

  private pickRoom(style: LiveStyle): string {
    const prefs = preferredRooms(this.config.persona);
    if (style === 'bounce') return 'velum_general';
    return prefs[Math.floor(Math.random() * prefs.length)] || 'velum_general';
  }

  /**
   * Live window after auth. Persona drives butterfly / idle / bounce / mixed.
   */
  async runLiveSession(deadline: number, windowMs: number): Promise<SessionResult> {
    const username = this.credentials.username;
    const style = styleFor(this.config.persona, this.config.deviceIndex);
    let talks = 0;
    let joined = false;
    let loggedOut = false;

    chaosLogger.logAction(this.config.agentId, 'style', true, 0, style);

    try {
      if (!this.client.isAuthenticated()) {
        const login = await this.client.login();
        chaosLogger.logAction(
          this.config.agentId,
          'login',
          login.success,
          login.latency || 0,
          login.error
        );
        if (!login.success) {
          return { ok: false, username, style, talks, joined, loggedOut, error: login.error };
        }
      }

      joined = await this.joinForStyle(style);
      const logoutAt = logoutAfterMs(style, windowMs);
      const sessionStart = Date.now();

      if (style === 'idle') {
        while (Date.now() < deadline) {
          chaosLogger.logAction(this.config.agentId, 'idle', true, 0);
          const left = deadline - Date.now();
          if (left <= 0) break;
          await this.sleepPlain(Math.min(15000, left));
          if (logoutAt != null && Date.now() - sessionStart >= logoutAt) {
            const out = await this.client.logout();
            chaosLogger.logAction(
              this.config.agentId,
              'logout',
              out.success,
              out.latency || 0,
              out.error
            );
            loggedOut = true;
            break;
          }
        }
        return { ok: true, username, style, talks, joined, loggedOut };
      }

      if (style === 'bounce') {
        if (joined) {
          await this.client.getMessages('velum_general', 10);
          chaosLogger.logAction(this.config.agentId, 'read:velum_general', true, 0);
        }
        const wait = logoutAt ?? 30000;
        const left = Math.min(wait, Math.max(0, deadline - Date.now()));
        await this.sleepPlain(left);
        const out = await this.client.logout();
        chaosLogger.logAction(
          this.config.agentId,
          'logout',
          out.success,
          out.latency || 0,
          out.error
        );
        loggedOut = true;
        return { ok: true, username, style, talks, joined, loggedOut };
      }

      while (Date.now() < deadline) {
        if (logoutAt != null && Date.now() - sessionStart >= logoutAt) {
          const out = await this.client.logout();
          chaosLogger.logAction(
            this.config.agentId,
            'logout',
            out.success,
            out.latency || 0,
            out.error
          );
          loggedOut = true;
          break;
        }

        if (joined) {
          const room = this.pickRoom(style);
          if (style === 'lurker' && Math.random() < 0.7) {
            await this.client.getMessages(room, 10);
            chaosLogger.logAction(this.config.agentId, `read:${room}`, true, 0);
          } else if (style === 'butterfly' || style === 'mixed' || Math.random() < 0.35) {
            if (await this.talkOnce(room)) talks++;
          } else {
            await this.client.getMessages(room, 8);
            chaosLogger.logAction(this.config.agentId, `read:${room}`, true, 0);
          }
        }

        const gap = talkGapMs(style);
        const left = deadline - Date.now();
        if (left <= 0) break;
        await this.sleepPlain(Math.min(gap, left));
      }

      chaosLogger.logAction(this.config.agentId, 'talk', true, 0, String(talks));
      return { ok: true, username, style, talks, joined, loggedOut };
    } catch (e) {
      return {
        ok: false,
        username,
        style,
        talks,
        joined,
        loggedOut,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  private loungeRef(lounge: VelumLounge): string {
    return lounge.slug || lounge.lounge_id || `lounge_${lounge.id}`;
  }

  private isJoinableUserLounge(lounge: VelumLounge, myId?: number): boolean {
    const row = lounge as VelumLounge & { is_official?: boolean; is_private?: boolean };
    if (row.isOfficial || row.is_official) return false;
    if (row.isPrivate || row.is_private) return false;
    if (lounge.parentLoungeId != null) return false;
    const slug = lounge.slug || '';
    if (slug === 'velum_master_lounge' || slug.startsWith('velum_')) return false;
    if (lounge.type && lounge.type !== 'user_created') return false;
    if (myId != null && lounge.ownerId === myId) return false;
    return true;
  }

  /**
   * Create one public lounge with ≥10 sublounges. No messaging.
   */
  async runCreateLounge(_usedTitles: Set<string>): Promise<CreateJoinResult> {
    const username = this.credentials.username;
    chaosLogger.logAction(this.config.agentId, 'create', false, 0, 'disabled');
    return { ok: false, username, role: 'create', error: 'lounge creation disabled' };
  }

  /**
   * List public user lounges and join them. No create, no messaging.
   */
  async runJoinDiscovered(): Promise<CreateJoinResult> {
    const username = this.credentials.username;

    try {
      if (!this.client.isAuthenticated()) {
        const login = await this.client.login();
        chaosLogger.logAction(
          this.config.agentId,
          'login',
          login.success,
          login.latency || 0,
          login.error
        );
        if (!login.success) {
          return { ok: false, username, role: 'join', error: login.error };
        }
      }

      const listed = await this.client.getLounges();
      chaosLogger.logAction(
        this.config.agentId,
        'find',
        listed.success,
        listed.latency || 0,
        listed.error
      );
      if (!listed.success || !listed.data?.lounges) {
        return {
          ok: false,
          username,
          role: 'join',
          found: 0,
          joined: 0,
          error: listed.error || 'list failed',
        };
      }

      const myId = this.client.getUserId();
      const targets = listed.data.lounges.filter((l) => this.isJoinableUserLounge(l, myId));
      chaosLogger.logAction(
        this.config.agentId,
        'found',
        targets.length > 0,
        0,
        String(targets.length)
      );

      let joined = 0;
      for (const lounge of targets) {
        const ref = this.loungeRef(lounge);
        const j = await this.client.joinLounge(ref);
        chaosLogger.logAction(
          this.config.agentId,
          `join:${ref}`,
          j.success,
          j.latency || 0,
          j.error
        );
        if (j.success) joined++;
      }

      const ok = targets.length > 0 && joined === targets.length;
      chaosLogger.logAction(
        this.config.agentId,
        'join',
        ok,
        0,
        `${joined}/${targets.length}`
      );

      return {
        ok,
        username,
        role: 'join',
        found: targets.length,
        joined,
        error: ok ? undefined : `joined ${joined}/${targets.length}`,
      };
    } catch (e) {
      return {
        ok: false,
        username,
        role: 'join',
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /**
   * Directory discover + send friend requests.
   * Prefer other agents in this run (so accept+DM mesh forms), then outsiders.
   * Never targets protected system IDs/usernames.
   */
  async runFriendDiscoverRequest(agentNames: Set<string>): Promise<FriendGateResult> {
    const username = this.credentials.username;
    let found = 0;
    let outsiders = 0;
    let sent = 0;
    let soft = 0;

    const base = (): FriendGateResult => ({
      ok: false,
      username,
      found,
      outsiders,
      sent,
      soft,
      accepted: 0,
      dms: 0,
      contacts: 0,
    });

    try {
      if (!this.client.isAuthenticated()) {
        const login = await this.client.login();
        chaosLogger.logAction(
          this.config.agentId,
          'login',
          login.success,
          login.latency || 0,
          login.error
        );
        if (!login.success) return { ...base(), error: login.error || 'login failed' };
      }

      const mine = this.client.getUserId();
      const listed = await this.client.searchUsers('');
      chaosLogger.logAction(
        this.config.agentId,
        'find',
        listed.success,
        listed.latency || 0,
        listed.error
      );
      if (!listed.success || !listed.data?.users) {
        return { ...base(), error: listed.error || 'directory failed' };
      }

      // Defense: strip protected even if API regresses
      const safeUsers = listed.data.users.filter((u) => !isProtectedUser(u.id, u.username));
      const leaked = listed.data.users.length - safeUsers.length;
      if (leaked > 0) {
        chaosLogger.logAction(this.config.agentId, 'protect', false, 0, `leaked=${leaked}`);
      } else {
        chaosLogger.logAction(this.config.agentId, 'protect', true, 0);
      }

      const agentsLower = new Set([...agentNames].map((n) => n.toLowerCase()));
      const eligible = safeUsers.filter((u) => (mine == null ? true : u.id !== mine));
      found = eligible.length;

      const outside = eligible.filter((u) => !agentsLower.has((u.username || '').toLowerCase()));
      const inside = eligible.filter((u) => agentsLower.has((u.username || '').toLowerCase()));
      outsiders = outside.length;

      chaosLogger.logAction(
        this.config.agentId,
        'found',
        found > 0,
        0,
        `${found} out=${outsiders}`
      );

      if (found === 0) return { ...base(), error: 'no discoverable users' };

      const shuffle = <T>(arr: T[]): T[] => {
        const out = [...arr];
        for (let i = out.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
      };
      // Prefer peers in this run so accept + contact DMs can complete
      const targets = [...shuffle(inside), ...shuffle(outside)].slice(0, MAX_FRIEND_REQUESTS);

      for (const t of targets) {
        if (isProtectedUser(t.id, t.username)) continue;
        const r = await this.client.sendFriendRequest({
          targetUserId: t.id,
          username: t.username,
        });
        const err = String(r.error || '');
        const softHit =
          !r.success &&
          /already pending|already friends|Friend request is already pending/i.test(err);
        const ok = !!r.success || softHit;
        if (r.success) sent++;
        else if (softHit) soft++;
        chaosLogger.logAction(
          this.config.agentId,
          `req:${t.username}`,
          ok,
          r.latency || 0,
          r.success ? undefined : err || undefined
        );
      }

      const ok = sent + soft > 0;
      chaosLogger.logAction(
        this.config.agentId,
        'request',
        ok,
        0,
        `sent=${sent} soft=${soft}`
      );

      return {
        ok,
        username,
        found,
        outsiders,
        sent,
        soft,
        accepted: 0,
        dms: 0,
        contacts: 0,
        error: ok ? undefined : 'no requests accepted',
      };
    } catch (e) {
      return { ...base(), error: e instanceof Error ? e.message : String(e) };
    }
  }

  /** Accept all pending incoming friend requests. */
  async runFriendAccept(): Promise<Pick<FriendGateResult, 'ok' | 'username' | 'accepted' | 'error'>> {
    const username = this.credentials.username;
    let accepted = 0;

    try {
      if (!this.client.isAuthenticated()) {
        const login = await this.client.login();
        if (!login.success) {
          return { ok: false, username, accepted, error: login.error || 'login failed' };
        }
      }

      const listed = await this.client.getFriendRequests();
      chaosLogger.logAction(
        this.config.agentId,
        'inbox',
        listed.success,
        listed.latency || 0,
        listed.error
      );
      if (!listed.success) {
        return { ok: false, username, accepted, error: listed.error || 'inbox failed' };
      }

      const requests = listed.data?.requests || [];
      for (const req of requests) {
        const sid = Number(req.sender_id);
        if (isProtectedUser(sid)) {
          chaosLogger.logAction(this.config.agentId, `skip:${sid}`, true, 0, 'protected');
          continue;
        }
        const r = await this.client.acceptFriendRequest(req.request_id);
        chaosLogger.logAction(
          this.config.agentId,
          `accept:${req.request_id}`,
          r.success,
          r.latency || 0,
          r.error
        );
        if (r.success) accepted++;
      }

      const ok = true;
      chaosLogger.logAction(
        this.config.agentId,
        'accept',
        ok,
        0,
        String(accepted)
      );
      return { ok, username, accepted };
    } catch (e) {
      return {
        ok: false,
        username,
        accepted,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /** Message accepted contacts only (never protected IDs). */
  async runFriendDmContacts(): Promise<
    Pick<FriendGateResult, 'ok' | 'username' | 'dms' | 'contacts' | 'error'>
  > {
    const username = this.credentials.username;
    let dms = 0;
    let contacts = 0;

    try {
      if (!this.client.isAuthenticated()) {
        const login = await this.client.login();
        if (!login.success) {
          return { ok: false, username, dms, contacts, error: login.error || 'login failed' };
        }
      }

      const rel = await this.client.getFriendRelationships();
      chaosLogger.logAction(
        this.config.agentId,
        'contacts',
        rel.success,
        rel.latency || 0,
        rel.error
      );
      if (!rel.success) {
        return { ok: false, username, dms, contacts, error: rel.error || 'contacts failed' };
      }

      const peers = (rel.data?.relationships || [])
        .map((row) => {
          const id = Number(row.friendId ?? row.friend_id ?? row.peerId ?? row.peer_id);
          return { id, username: row.username };
        })
        .filter((p) => Number.isFinite(p.id) && p.id > 0 && !isProtectedUser(p.id, p.username));

      contacts = peers.length;
      chaosLogger.logAction(
        this.config.agentId,
        'contact_n',
        contacts > 0,
        0,
        String(contacts)
      );

      for (const peer of peers) {
        const text = dmLine(Math.random() < 0.4);
        const r = await this.client.sendDm(peer.id, text);
        chaosLogger.logAction(
          this.config.agentId,
          `dm:${peer.username || peer.id}`,
          r.success,
          r.latency || 0,
          r.error
        );
        if (r.success) dms++;
      }

      const ok = contacts === 0 || dms === contacts;
      chaosLogger.logAction(this.config.agentId, 'dm', ok, 0, `${dms}/${contacts}`);
      return {
        ok,
        username,
        dms,
        contacts,
        error: ok ? undefined : `dm ${dms}/${contacts}`,
      };
    } catch (e) {
      return {
        ok: false,
        username,
        dms,
        contacts,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /** @deprecated use phased friend methods */
  async runFriendGate(agentNames: Set<string>): Promise<FriendGateResult> {
    return this.runFriendDiscoverRequest(agentNames);
  }

  /**
   * Auth assumed. Upload one library avatar (images only) and set profile URL.
   * No friends / DM / lounge writes.
   */
  async runAvatarGate(): Promise<AvatarGateResult> {
    const username = this.credentials.username;
    const libraryRoot = this.config.libraryRoot || DEFAULT_LIBRARY_ROOT;
    const filePath = pickAvatarPath(libraryRoot, this.config.deviceIndex);

    if (!filePath) {
      chaosLogger.logAction(this.config.agentId, 'avatar', false, 0, 'empty library');
      return { ok: false, username, error: 'no avatar images in library' };
    }

    const file = path.basename(filePath);

    try {
      if (!this.client.isAuthenticated()) {
        const login = await this.client.login();
        chaosLogger.logAction(
          this.config.agentId,
          'login',
          login.success,
          login.latency || 0,
          login.error
        );
        if (!login.success) {
          return { ok: false, username, file, error: login.error || 'login failed' };
        }
      }

      const buf = fs.readFileSync(filePath);
      const mime = mimeForImage(filePath);
      const uploaded = await this.client.uploadAvatar(buf, mime);
      chaosLogger.logAction(
        this.config.agentId,
        'upload',
        uploaded.success,
        uploaded.latency || 0,
        uploaded.error || file
      );
      if (!uploaded.success || !uploaded.data?.url) {
        return {
          ok: false,
          username,
          file,
          error: uploaded.error || 'upload failed',
        };
      }

      const url = uploaded.data.url;
      const linked = await this.client.updateProfile({ avatarUrl: url, avatar: url });
      chaosLogger.logAction(
        this.config.agentId,
        'profile',
        linked.success,
        linked.latency || 0,
        linked.error
      );
      if (!linked.success) {
        return { ok: false, username, file, url, error: linked.error || 'profile link failed' };
      }

      const uid = this.client.getUserId();
      let verified = false;
      let got = '';
      if (uid != null) {
        const prof = await this.client.getUserProfile(uid);
        const raw = prof.data as
          | (VelumUser & { avatarUrl?: string; avatar?: string; userId?: number })
          | undefined;
        got = String(raw?.avatarUrl || raw?.avatar || '');
        verified =
          prof.success &&
          !!got &&
          (got === url || got.includes(`/uploads/avatars/${uid}/`) || got.includes('avatar'));
        chaosLogger.logAction(
          this.config.agentId,
          'verify',
          verified,
          prof.latency || 0,
          verified ? got : `got=${got || 'none'}`
        );
      }

      const ok = verified;
      chaosLogger.logAction(this.config.agentId, 'avatar', ok, 0, url);
      return {
        ok,
        username,
        file,
        url,
        error: ok ? undefined : 'avatar url not on profile',
      };
    } catch (e) {
      return {
        ok: false,
        username,
        file,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /**
   * Seller: fund EUR wallet (dev deposit), create EUR|VLM listing.
   * Buyer: fund → optional convert → purchase → RELEASE escrow.
   */
  async runMarketSellerGate(opts: {
    currency: 'EUR' | 'VLM';
    price: number;
  }): Promise<MarketGateResult> {
    const username = this.credentials.username;
    const currency = opts.currency;
    const price = opts.price;

    try {
      if (!this.client.isAuthenticated()) {
        const login = await this.client.login();
        chaosLogger.logAction(
          this.config.agentId,
          'login',
          login.success,
          login.latency || 0,
          login.error
        );
        if (!login.success) {
          return { ok: false, username, role: 'seller', error: login.error || 'login failed' };
        }
      }

      const dep = await this.client.walletDeposit(200, 'EUR');
      chaosLogger.logAction(
        this.config.agentId,
        'deposit',
        dep.success,
        dep.latency || 0,
        dep.error || '200 EUR'
      );
      if (!dep.success) {
        return { ok: false, username, role: 'seller', error: dep.error || 'deposit failed' };
      }

      const title = `Chaos ${currency} pack ${this.config.deviceIndex}`;
      const description =
        'Digital license pack for chaos market stress. Clean copy for auto-approve.';
      const created = await this.client.createListing({
        title,
        description,
        price,
        currency,
        category: 'General',
      });
      const listing = (created.data as { listing?: { id: number; status?: string } } | undefined)
        ?.listing;
      const listingId = listing?.id;
      const held = listing?.status === 'PENDING_REVIEW';
      chaosLogger.logAction(
        this.config.agentId,
        'list',
        created.success && !!listingId && !held,
        created.latency || 0,
        held ? 'held_review' : created.error || `${currency}#${listingId || '?'}`
      );
      if (!created.success || !listingId) {
        return {
          ok: false,
          username,
          role: 'seller',
          currency,
          error: created.error || 'create listing failed',
        };
      }
      if (held) {
        return {
          ok: false,
          username,
          role: 'seller',
          listingId,
          currency,
          error: 'listing held for review',
        };
      }

      return { ok: true, username, role: 'seller', listingId, currency };
    } catch (e) {
      return {
        ok: false,
        username,
        role: 'seller',
        currency,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async runMarketBuyerGate(opts: {
    listingId: number;
    payCurrency: string;
    fundEur?: number;
  }): Promise<MarketGateResult> {
    const username = this.credentials.username;
    const payCurrency = opts.payCurrency.toUpperCase();
    const fundEur = opts.fundEur ?? 500;

    try {
      if (!this.client.isAuthenticated()) {
        const login = await this.client.login();
        chaosLogger.logAction(
          this.config.agentId,
          'login',
          login.success,
          login.latency || 0,
          login.error
        );
        if (!login.success) {
          return { ok: false, username, role: 'buyer', error: login.error || 'login failed' };
        }
      }

      const dep = await this.client.walletDeposit(fundEur, 'EUR');
      chaosLogger.logAction(
        this.config.agentId,
        'deposit',
        dep.success,
        dep.latency || 0,
        dep.error || `${fundEur} EUR`
      );
      if (!dep.success) {
        return { ok: false, username, role: 'buyer', error: dep.error || 'deposit failed' };
      }

      if (payCurrency !== 'EUR') {
        const convertAmt = Math.max(50, Math.floor(fundEur * 0.6));
        const conv = await this.client.convertCurrency('EUR', payCurrency, convertAmt);
        chaosLogger.logAction(
          this.config.agentId,
          'convert',
          conv.success,
          conv.latency || 0,
          conv.error || `EUR→${payCurrency} ${convertAmt}`
        );
        if (!conv.success) {
          return {
            ok: false,
            username,
            role: 'buyer',
            payCurrency,
            error: conv.error || 'convert failed',
          };
        }
      }

      const buy = await this.client.purchaseListing(opts.listingId, payCurrency);
      const escrow = (buy.data as { escrow?: { id: number } } | undefined)?.escrow;
      const escrowId = escrow?.id;
      chaosLogger.logAction(
        this.config.agentId,
        'purchase',
        buy.success && !!escrowId,
        buy.latency || 0,
        buy.error || `escrow#${escrowId || '?'}`
      );
      if (!buy.success || !escrowId) {
        return {
          ok: false,
          username,
          role: 'buyer',
          listingId: opts.listingId,
          payCurrency,
          error: buy.error || 'purchase failed',
        };
      }

      const rel = await this.client.escrowAction(escrowId, 'RELEASE');
      chaosLogger.logAction(
        this.config.agentId,
        'release',
        rel.success,
        rel.latency || 0,
        rel.error
      );
      if (!rel.success) {
        return {
          ok: false,
          username,
          role: 'buyer',
          listingId: opts.listingId,
          escrowId,
          payCurrency,
          error: rel.error || 'release failed',
        };
      }

      return {
        ok: true,
        username,
        role: 'buyer',
        listingId: opts.listingId,
        escrowId,
        payCurrency,
      };
    } catch (e) {
      return {
        ok: false,
        username,
        role: 'buyer',
        listingId: opts.listingId,
        payCurrency,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /**
   * Upload one library media file; send media+caption to existing DM contacts
   * and a couple of joined Velum rooms. No avatar change, no friend requests.
   */
  async runMediaGate(): Promise<MediaGateResult> {
    const username = this.credentials.username;
    const libraryRoot = this.config.libraryRoot || DEFAULT_LIBRARY_ROOT;
    const filePath = pickMediaPath(libraryRoot, this.config.deviceIndex);

    if (!filePath) {
      chaosLogger.logAction(this.config.agentId, 'media', false, 0, 'empty library');
      return { ok: false, username, error: 'no media files in library' };
    }

    const file = path.basename(filePath);
    let dmOk = 0;
    let dmNeed = 0;
    let loungeOk = 0;
    const loungeNeed = MEDIA_LOUNGE_ROOMS.length;

    try {
      if (!this.client.isAuthenticated()) {
        const login = await this.client.login();
        chaosLogger.logAction(
          this.config.agentId,
          'login',
          login.success,
          login.latency || 0,
          login.error
        );
        if (!login.success) {
          return { ok: false, username, file, error: login.error || 'login failed' };
        }
      }

      const buf = fs.readFileSync(filePath);
      const mime = mimeForMedia(filePath);
      const uploaded = await this.client.uploadMedia(buf, mime);
      chaosLogger.logAction(
        this.config.agentId,
        'upload',
        uploaded.success,
        uploaded.latency || 0,
        uploaded.error || file
      );
      if (!uploaded.success || !uploaded.data?.url) {
        return {
          ok: false,
          username,
          file,
          error: uploaded.error || 'upload failed',
        };
      }

      const url = uploaded.data.url;
      const ext = path.extname(file).toLowerCase() || '.mp4';
      const anon = `clip_${crypto.randomBytes(4).toString('hex')}${ext}`;
      const body = attachmentMessage({
        name: anon,
        sizeLabel: formatByteSize(buf.length),
        mime,
        url,
        caption: mediaCaption(),
      });

      const rel = await this.client.getFriendRelationships();
      chaosLogger.logAction(
        this.config.agentId,
        'contacts',
        rel.success,
        rel.latency || 0,
        rel.error
      );
      const peers = (rel.success ? rel.data?.relationships || [] : [])
        .map((row) => {
          const id = Number(row.friendId ?? row.friend_id ?? row.peerId ?? row.peer_id);
          return { id, username: row.username };
        })
        .filter((p) => Number.isFinite(p.id) && p.id > 0 && !isProtectedUser(p.id, p.username))
        .slice(0, MAX_MEDIA_DM);

      dmNeed = peers.length;
      for (const peer of peers) {
        const r = await this.client.sendDm(peer.id, body);
        chaosLogger.logAction(
          this.config.agentId,
          `dm:${peer.username || peer.id}`,
          r.success,
          r.latency || 0,
          r.error
        );
        if (r.success) dmOk++;
      }
      chaosLogger.logAction(
        this.config.agentId,
        'dm',
        dmNeed === 0 || dmOk === dmNeed,
        0,
        `${dmOk}/${dmNeed}`
      );

      const jMaster = await this.client.joinLounge(master);
      chaosLogger.logAction(
        this.config.agentId,
        'join',
        jMaster.success,
        jMaster.latency || 0,
        jMaster.error
      );

      for (const room of MEDIA_LOUNGE_ROOMS) {
        const j = await this.client.joinLounge(room);
        if (!j.success) {
          chaosLogger.logAction(this.config.agentId, `lounge:${room}`, false, j.latency || 0, j.error);
          continue;
        }
        const sent = await this.client.sendMessage(room, body);
        chaosLogger.logAction(
          this.config.agentId,
          `lounge:${room}`,
          sent.success,
          sent.latency || 0,
          sent.error
        );
        if (sent.success) loungeOk++;
      }
      chaosLogger.logAction(
        this.config.agentId,
        'lounge',
        loungeOk === loungeNeed,
        0,
        `${loungeOk}/${loungeNeed}`
      );

      const ok =
        uploaded.success &&
        (dmNeed === 0 || dmOk === dmNeed) &&
        loungeOk === loungeNeed;
      chaosLogger.logAction(this.config.agentId, 'media', ok, 0, url);

      return {
        ok,
        username,
        file,
        url,
        dmOk,
        dmNeed,
        loungeOk,
        loungeNeed,
        error: ok
          ? undefined
          : `dm ${dmOk}/${dmNeed} lounge ${loungeOk}/${loungeNeed}`,
      };
    } catch (e) {
      return {
        ok: false,
        username,
        file,
        dmOk,
        dmNeed,
        loungeOk,
        loungeNeed,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  getUserId(): number | undefined {
    return this.client.getUserId();
  }

  getUsername(): string {
    return this.credentials.username;
  }

  getPersona(): string {
    return String(this.config.persona);
  }

  /** Join master + cue room for conversation-cue gate. */
  async joinCueRoom(): Promise<{ ok: boolean; error?: string }> {
    const jMaster = await this.client.joinLounge(master);
    chaosLogger.logAction(
      this.config.agentId,
      'join',
      jMaster.success,
      jMaster.latency || 0,
      jMaster.error
    );
    if (!jMaster.success) return { ok: false, error: jMaster.error || 'join master' };

    const j = await this.client.joinLounge(CUE_ROOM);
    chaosLogger.logAction(
      this.config.agentId,
      CUE_ROOM,
      j.success,
      j.latency || 0,
      j.error
    );
    if (!j.success) return { ok: false, error: j.error || `join ${CUE_ROOM}` };
    chaosLogger.logAction(this.config.agentId, 'open', true, 0);
    return { ok: true };
  }

  /**
   * Login + join velum_general for turn-based human talk.
   */
  async prepareHumanTalk(): Promise<{ ok: boolean; error?: string }> {
    if (!this.client.isAuthenticated()) {
      const login = await this.client.login();
      chaosLogger.logAction(
        this.config.agentId,
        'login',
        login.success,
        login.latency || 0,
        login.error
      );
      if (!login.success) return { ok: false, error: login.error || 'login' };
      this.persistCredentials(this.client.getUserId());
    }
    return this.joinCueRoom();
  }

  /**
   * One turn: reply to partner line (topic-aware) or open/seed if empty.
   */
  async humanSpeakTurn(
    replyTo: string,
    avoid: Set<string>,
    opts?: { seed?: string; topic?: string; pairTalks?: number }
  ): Promise<{ ok: boolean; text?: string; tag?: string; persona?: string; error?: string }> {
    const human = personaOf(String(this.config.persona));
    let text: string;
    let tag: string;

    if (opts?.seed && !replyTo.trim()) {
      text = opts.seed;
      tag = 'seed';
    } else {
      let pick = pickTalkLine(human.id as PersonaId, replyTo, avoid, {
        topic: opts?.topic,
        pairTalks: opts?.pairTalks,
      });
      if (pick.text.trim().split(/\s+/).length < 2 || /^(nm|eh|k|ok|m|y)$/i.test(pick.text.trim())) {
        pick = pickTalkLine(human.id as PersonaId, replyTo || 'hey', avoid, {
          topic: opts?.topic || 'hangout',
          pairTalks: Math.max(2, opts?.pairTalks ?? 2),
        });
      }
      text = pick.text;
      tag =
        pick.tag ||
        (pick.kind === 'cue' ? `cue:${pick.cue}` : pick.kind === 'reply' ? 'reply' : 'open');
    }

    text = stripMdash(text);

    avoid.add(text);
    if (avoid.size > 40) {
      const first = avoid.values().next().value as string | undefined;
      if (first) avoid.delete(first);
    }

    const sent = await this.client.sendMessage(CUE_ROOM, text);
    chaosLogger.logAction(
      this.config.agentId,
      tag,
      sent.success,
      sent.latency || 0,
      sent.success ? `${human.id}|${text.slice(0, 56)}` : sent.error
    );
    if (!sent.success) return { ok: false, error: sent.error || 'send', persona: human.id };
    return { ok: true, text, tag, persona: human.id };
  }

  getHumanPersonaId(): string {
    return personaOf(String(this.config.persona)).id;
  }

  /**
   * @deprecated Prefer controller turn loop + humanSpeakTurn.
   * Kept for compatibility; runs parallel session (noisy).
   */
  async runHumanTalkSession(durationMs: number): Promise<SessionResult> {
    const username = this.credentials.username;
    const human = personaOf(String(this.config.persona));
    const style = styleFor(
      (['social', 'casual', 'tech', 'drama', 'support', 'attention'].includes(
        String(this.config.persona)
      )
        ? this.config.persona
        : 'casual') as PersonaType,
      this.config.deviceIndex
    );
    let talks = 0;
    let joined = false;
    const avoid = new Set<string>();
    this.isRunning = true;

    try {
      const prep = await this.prepareHumanTalk();
      joined = prep.ok;
      if (!prep.ok) {
        this.isRunning = false;
        return {
          ok: false,
          username,
          style,
          talks: 0,
          joined: false,
          loggedOut: false,
          error: prep.error || 'join',
        };
      }

      const deadline = Date.now() + durationMs;
      let last = '';
      while (Date.now() < deadline && this.isRunning) {
        const turn = await this.humanSpeakTurn(last, avoid);
        if (turn.ok && turn.text) {
          talks++;
          last = turn.text;
        }
        const gap = humanTalkGapMs(human);
        const left = deadline - Date.now();
        if (left <= 0) break;
        await this.sleepPlain(Math.min(gap, left));
      }

      this.isRunning = false;
      return {
        ok: talks > 0,
        username,
        style,
        talks,
        joined,
        loggedOut: false,
        error: talks > 0 ? undefined : 'no talks',
      };
    } catch (e) {
      this.isRunning = false;
      return {
        ok: false,
        username,
        style,
        talks,
        joined,
        loggedOut: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /** Post a seeded line that should trigger `cue`. */
  async postCueSeed(cue: Exclude<CueId, 'general'>): Promise<{ ok: boolean; text?: string; error?: string }> {
    const text = seedForCue(cue);
    const sent = await this.client.sendMessage(CUE_ROOM, text);
    chaosLogger.logAction(
      this.config.agentId,
      'seed',
      sent.success,
      sent.latency || 0,
      sent.success ? cue : sent.error
    );
    if (!sent.success) return { ok: false, error: sent.error || 'seed send' };
    return { ok: true, text };
  }

  /**
   * Read cue room, detect cue from peer seed (exact text when provided), reply from bank.
   * Passes when detected cue equals expectedCue.
   */
  async replyToCue(
    expectedCue: Exclude<CueId, 'general'>,
    seedText?: string
  ): Promise<{
    ok: boolean;
    cue?: CueId;
    text?: string;
    error?: string;
  }> {
    const mine = this.client.getUserId();
    const got = await this.client.getMessages(CUE_ROOM, 30);
    if (!got.success || !Array.isArray(got.data)) {
      chaosLogger.logAction(this.config.agentId, 'cue', false, got.latency || 0, got.error || 'read');
      return { ok: false, error: got.error || 'getMessages' };
    }

    const others = got.data.filter(
      (m) => m.senderId !== mine && typeof m.content === 'string' && m.content.trim()
    );
    const target = seedText
      ? [...others].reverse().find((m) => m.content === seedText)
      : [...others].reverse()[0];
    if (!target?.content) {
      chaosLogger.logAction(this.config.agentId, 'cue', false, 0, 'no peer line');
      return { ok: false, error: 'no peer line' };
    }

    const cue = detectCue(target.content);
    const matched = cue === expectedCue;
    chaosLogger.logAction(
      this.config.agentId,
      'cue',
      matched,
      0,
      matched ? cue : `got=${cue} want=${expectedCue}`
    );
    if (!matched) {
      return { ok: false, cue, error: `cue mismatch got=${cue} want=${expectedCue}` };
    }

    const text = replyForCue(cue);
    const sent = await this.client.sendMessage(CUE_ROOM, text);
    chaosLogger.logAction(
      this.config.agentId,
      'reply',
      sent.success,
      sent.latency || 0,
      sent.error
    );
    if (!sent.success) return { ok: false, cue, error: sent.error || 'reply send' };
    return { ok: true, cue, text };
  }

  /** Connect Velum /ws with current session. */
  async connectWs(): Promise<{ ok: boolean; error?: string }> {
    const uid = this.client.getUserId();
    const token = this.client.getSessionToken();
    if (uid == null || !token) {
      chaosLogger.logAction(this.config.agentId, 'ws', false, 0, 'no session');
      return { ok: false, error: 'no session for ws' };
    }

    this.disconnectWs();
    this.ws = new WsClient(uid, token, httpBaseToWsUrl(this.config.baseUrl));
    const t0 = Date.now();
    const ok = await this.ws.connect(12000);
    chaosLogger.logAction(
      this.config.agentId,
      'ws',
      ok,
      Date.now() - t0,
      ok ? undefined : 'connect failed'
    );
    return { ok, error: ok ? undefined : 'ws connect failed' };
  }

  disconnectWs(): void {
    if (this.ws) {
      this.ws.disconnect();
      this.ws = null;
    }
  }

  /**
   * Receiver: wait for a WS dm frame containing marker.
   */
  async waitWsPeerDm(marker: string, timeoutMs = 20000): Promise<boolean> {
    if (!this.ws?.isOpen()) {
      chaosLogger.logAction(this.config.agentId, 'peer', false, 0, 'ws closed');
      return false;
    }
    const t0 = Date.now();
    const msg = await this.ws.waitFor((m) => {
      if (m.type !== 'dm') return false;
      const body = String(m.body ?? '');
      return body.includes(marker);
    }, timeoutMs);
    const ok = !!msg;
    chaosLogger.logAction(
      this.config.agentId,
      'peer',
      ok,
      Date.now() - t0,
      ok ? 'recv' : 'timeout'
    );
    return ok;
  }

  /**
   * Sender: push a WS dm to peer with marker body.
   */
  async sendWsPeerDm(toUserId: number, marker: string): Promise<boolean> {
    if (!this.ws?.isOpen()) {
      chaosLogger.logAction(this.config.agentId, 'peer', false, 0, 'ws closed');
      return false;
    }
    const t0 = Date.now();
    const ok = this.ws.sendDm(toUserId, marker);
    // brief wait for dm_ack
    if (ok) {
      await this.ws.waitFor((m) => m.type === 'dm_ack' || m.type === 'error', 8000);
    }
    chaosLogger.logAction(
      this.config.agentId,
      'peer',
      ok,
      Date.now() - t0,
      ok ? 'send' : 'send failed'
    );
    return ok;
  }

  private async authenticate(): Promise<boolean> {
    const login = await this.client.login();
    chaosLogger.logAction(this.config.agentId, 'login', login.success, login.latency || 0, login.error);
    if (login.success) {
      this.persistCredentials(this.client.getUserId());
      return true;
    }

    const reg = await this.client.register();
    chaosLogger.logAction(this.config.agentId, 'register', reg.success, reg.latency || 0, reg.error);
    if (reg.success) {
      this.persistCredentials(this.client.getUserId());
      return true;
    }
    return false;
  }

  private async performAction(): Promise<void> {
    if (!this.client.isAuthenticated() || this.compromised) {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        chaosLogger.logFailure(
          this.config.agentId,
          'authentication',
          'Failed to authenticate',
          true,
          false
        );
        return;
      }
    }

    if (this.actionCount % 5 === 0) {
      await this.discoverUsers();
      await this.discoverLounges();
    }

    const action = this.selectAction();
    await this.executeAction(action);

    this.actionCount++;
    this.lastActionTime = Date.now();
  }

  private selectAction(): string {
    const actions = [];

    actions.push('sendMessage');

    switch (this.config.persona) {
      case 'social':
        actions.push('sendMessage', 'joinLounge', 'uploadAvatar');
        break;
      case 'casual':
        actions.push('sendMessage', 'joinLounge', 'uploadAvatar', 'createTicket');
        break;
      case 'tech':
        actions.push('sendMessage', 'createTicket', 'compromiseAccount');
        break;
      case 'drama':
        actions.push('reportUser', 'blockUser', 'muteUser', 'sendMessage');
        break;
      case 'support':
        actions.push('createTicket', 'sendMessage', 'uploadAvatar');
        break;
      case 'attention':
        actions.push('sendMessage', 'sendMessage', 'uploadAvatar', 'joinLounge');
        break;
    }

    if (this.mutedByAdmin) {
      actions.push('attemptBypass');
    }

    if (this.compromised) {
      actions.push('attemptRecovery');
    }

    return actions[Math.floor(Math.random() * actions.length)];
  }

  private async executeAction(action: string): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      switch (action) {
        case 'sendMessage':
          success = await this.actionSendMessage();
          break;
        case 'createLounge':
          success = await this.actionCreateLounge();
          break;
        case 'joinLounge':
          success = await this.actionJoinLounge();
          break;
        case 'uploadAvatar':
          success = await this.actionUploadAvatar();
          break;
        case 'readMessages':
          success = await this.actionReadMessages();
          break;
        case 'getMessages':
          success = await this.actionGetMessages();
          break;
        case 'blockUser':
          success = await this.actionBlockUser();
          break;
        case 'muteUser':
          success = await this.actionMuteUser();
          break;
        case 'reportUser':
          success = await this.actionReportUser();
          break;
        case 'createTicket':
          success = await this.actionCreateTicket();
          break;
        case 'compromiseAccount':
          success = await this.actionCompromiseAccount();
          break;
        case 'attemptBypass':
          success = await this.actionAttemptBypass();
          break;
        case 'attemptRecovery':
          success = await this.actionAttemptRecovery();
          break;
        default:
          error = `Unknown action: ${action}`;
      }
    } catch (e) {
      error = (e as Error).message;
    }

    const latency = Date.now() - startTime;
    chaosLogger.logAction(this.config.agentId, action, success, latency, error);
  }

  private async actionSendMessage(): Promise<boolean> {
    if (!this.currentSublounge && !this.currentLounge) {
      return false;
    }

    const targetLounge = this.currentSublounge || this.currentLounge;
    if (!targetLounge) return false;

    const roomId = targetLounge.slug || String(targetLounge.id);
    const message = this.getRandomMessage();

    const result = await this.client.sendMessage(roomId, message);

    if (!result.success) {
      if (result.error?.includes('muted') || result.error?.includes('blocked')) {
        this.mutedByAdmin = true;
        chaosLogger.logAdminInteraction(
          this.config.agentId,
          'mute',
          true,
          false,
          false
        );
      }
      return false;
    }

    const verifyResult = await this.client.getMessages(roomId, 5);
    if (verifyResult.success && verifyResult.data) {
      const messageExists = verifyResult.data.some(msg =>
        msg.content === message && msg.senderId === this.client.getUserId()
      );
      if (!messageExists) {
        chaosLogger.logFailure(
          this.config.agentId,
          'sendMessage',
          'API returned success but message not found in recent messages',
          false,
          false
        );
        return false;
      }
    }

    return true;
  }

  private async actionCreateLounge(): Promise<boolean> {
    // Banned: agents must not create lounges.
    return false;
  }

  private async actionJoinLounge(): Promise<boolean> {
    if (this.discoveredLounges.length === 0) {
      return false;
    }

    const randomLounge = this.discoveredLounges[Math.floor(Math.random() * this.discoveredLounges.length)];
    const roomId = randomLounge.lounge_id || randomLounge.slug || `lounge_${randomLounge.id}`;

    const result = await this.client.joinLounge(roomId);

    if (!result.success) {
      return false;
    }

    const verifyResult = await this.client.getUserLounges();
    if (verifyResult.success && verifyResult.data) {
      const joined = verifyResult.data.lounges.some(lounge =>
        lounge.id === randomLounge.id || lounge.slug === randomLounge.slug
      );
      if (!joined) {
        chaosLogger.logFailure(
          this.config.agentId,
          'joinLounge',
          'API returned success but lounge not found in user lounges',
          false,
          false
        );
        return false;
      }
      this.currentLounge = randomLounge;
    }

    return true;
  }

  private async actionUploadAvatar(): Promise<boolean> {
    const avatarData = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x12, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x4c, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x41, 0x4d, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);

    const result = await this.client.uploadAvatar(avatarData);

    if (!result.success) {
      return false;
    }

    if (!result.data?.url) {
      chaosLogger.logFailure(
        this.config.agentId,
        'uploadAvatar',
        'API returned success but no avatar URL provided',
        false,
        false
      );
      return false;
    }

    return true;
  }

  private async actionReadMessages(): Promise<boolean> {
    if (!this.currentSublounge && !this.currentLounge) {
      return false;
    }

    const targetLounge = this.currentSublounge || this.currentLounge;
    if (!targetLounge) return false;

    const roomId = targetLounge.slug || String(targetLounge.id);
    const result = await this.client.getMessages(roomId, 10);

    if (result.success && result.data && result.data.length > 0) {
      const lastMessage = result.data[result.data.length - 1];
      await this.client.markAsRead(roomId, String(lastMessage.id));
    }

    return result.success;
  }

  private async actionGetMessages(): Promise<boolean> {
    if (!this.currentSublounge && !this.currentLounge) {
      return false;
    }

    const targetLounge = this.currentSublounge || this.currentLounge;
    if (!targetLounge) return false;

    const roomId = targetLounge.slug || String(targetLounge.id);

    const result = await this.client.getMessages(roomId, 20);
    return result.success;
  }

  private async actionBlockUser(): Promise<boolean> {
    if (this.discoveredUsers.length === 0) {
      return false;
    }

    const randomUser = this.discoveredUsers[Math.floor(Math.random() * this.discoveredUsers.length)];
    const result = await this.client.blockUser(randomUser.id);

    return result.success;
  }

  private async actionMuteUser(): Promise<boolean> {
    if (this.discoveredUsers.length === 0) {
      return false;
    }

    const randomUser = this.discoveredUsers[Math.floor(Math.random() * this.discoveredUsers.length)];
    const result = await this.client.muteUser(randomUser.id);

    return result.success;
  }

  private async actionReportUser(): Promise<boolean> {
    if (this.discoveredUsers.length === 0) {
      return false;
    }

    const randomUser = this.discoveredUsers[Math.floor(Math.random() * this.discoveredUsers.length)];
    const reasons = ['Inappropriate behavior', 'Spamming', 'Harassment', 'Offensive content', 'Trolling'];
    const reason = reasons[Math.floor(Math.random() * reasons.length)];

    const result = await this.client.reportUser(randomUser.id, reason);
    return result.success;
  }

  private async actionCreateTicket(): Promise<boolean> {
    const ticket = this.getRandomTicket();
    const result = await this.client.createTicket(ticket.reason, ticket.description);

    if (!result.success) {
      return false;
    }

    if (!result.data || !result.data.ticket_id) {
      chaosLogger.logFailure(
        this.config.agentId,
        'createTicket',
        'API returned success but no ticket_id provided',
        false,
        false
      );
      return false;
    }

    return true;
  }

  private async actionCompromiseAccount(): Promise<boolean> {
    this.compromised = true;
    this.credentials.password = `COMPROMISED_${crypto.randomBytes(4).toString('hex')}`;

    chaosLogger.logCompromiseEvent(
      this.config.agentId,
      'password_change',
      false,
      false
    );

    const result = await this.client.login();

    if (!result.success) {
      chaosLogger.logCompromiseEvent(
        this.config.agentId,
        'password_change',
        true,
        false
      );
    }

    return false; // Compromise always fails initially
  }

  private async actionAttemptBypass(): Promise<boolean> {
    if (!this.currentSublounge && !this.currentLounge) {
      return false;
    }

    const targetLounge = this.currentSublounge || this.currentLounge;
    if (!targetLounge) return false;

    const roomId = targetLounge.slug || String(targetLounge.id);

    const bypassMethods = [
      () => this.client.sendMessage(roomId, 'Bypass attempt 1'),
      () => this.client.joinLounge(roomId),
    ];

    const randomMethod = bypassMethods[Math.floor(Math.random() * bypassMethods.length)];
    const result = await randomMethod();

    chaosLogger.logAdminInteraction(
      this.config.agentId,
      'mute',
      true,
      true,
      result.success
    );

    return result.success;
  }

  private async actionAttemptRecovery(): Promise<boolean> {
    const storedCreds = persistenceManager.getCredentials(this.credentials.username);

    if (!storedCreds) {
      return false;
    }

    this.credentials.password = storedCreds.password;
    this.credentials.panicPhrase = storedCreds.panicPhrase;
    this.credentials.safeWord = storedCreds.safeWord;
    this.credentials.salt = storedCreds.salt;

    const result = await this.client.login();

    chaosLogger.logCompromiseEvent(
      this.config.agentId,
      'password_change',
      true,
      result.success
    );

    if (result.success) {
      this.compromised = false;
    }

    return result.success;
  }

  async start(duration: number = 60000): Promise<void> {
    this.isRunning = true;
    const endTime = Date.now() + duration;

    while (this.isRunning && Date.now() < endTime) {
      try {
        await this.performAction();
        await this.sleep(this.getRandomInterval());
      } catch (error) {
        chaosLogger.logFailure(
          this.config.agentId,
          'action_execution',
          (error as Error).message,
          false,
          false
        );
      }
    }

    this.stop();
  }

  stop(): void {
    this.isRunning = false;
    chaosLogger.logSessionEnd(this.config.agentId, false);
  }

  getMetrics(): any {
    return chaosLogger.getMetrics(this.config.agentId);
  }
}
