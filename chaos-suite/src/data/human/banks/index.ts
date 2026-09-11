import type { PersonaId } from '../personas.js';
import type { CueId } from '../cues/detect.js';
import { isDeadFiller, resolveReplyCue } from '../cues/detect.js';
import { pickCoherentReply } from '../talkReply.js';
import type { CueBank, CueBankMap, MessageBank, MessageBankMap } from './types.js';

import { messages as social } from './social/messages.js';
import { messages as casual } from './casual/messages.js';
import { messages as tech } from './tech/messages.js';
import { messages as drama } from './drama/messages.js';
import { messages as support } from './support/messages.js';
import { messages as attention } from './attention/messages.js';
import { messages as lurker } from './lurker/messages.js';
import { messages as market } from './market/messages.js';
import { messages as creative } from './creative/messages.js';
import { messages as nightowl } from './nightowl/messages.js';
import { messages as newbie } from './newbie/messages.js';
import { messages as organizer } from './organizer/messages.js';
import { messages as skeptic } from './skeptic/messages.js';
import { messages as cheer } from './cheer/messages.js';
import { messages as gamer } from './gamer/messages.js';
import { messages as mentor } from './mentor/messages.js';
import { messages as mature } from './mature/messages.js';
import { messages as childish } from './childish/messages.js';
import { messages as emotional } from './emotional/messages.js';
import { messages as emoji_addict } from './emoji_addict/messages.js';
import { messages as clueless_newbie } from './clueless_newbie/messages.js';
import { messages as rage_quitter } from './rage_quitter/messages.js';
import { messages as lowballer_hustler } from './lowballer_hustler/messages.js';
import { messages as short_texter } from './short_texter/messages.js';
import { messages as heavy_texter } from './heavy_texter/messages.js';
import { messages as chat_spammer } from './chat_spammer/messages.js';
import { messages as scammer_phisher } from './scammer_phisher/messages.js';
import { messages as stalker_inspector } from './stalker_inspector/messages.js';
import { messages as flirty } from './flirty/messages.js';
import { messages as professional } from './professional/messages.js';
import { messages as sarcastic } from './sarcastic/messages.js';
import { messages as supportive } from './supportive/messages.js';
import { messages as chaotic } from './chaotic/messages.js';
import { messages as formal } from './formal/messages.js';

import { cues as socialCues } from './social/cues.js';
import { cues as casualCues } from './casual/cues.js';
import { cues as techCues } from './tech/cues.js';
import { cues as dramaCues } from './drama/cues.js';
import { cues as supportCues } from './support/cues.js';
import { cues as attentionCues } from './attention/cues.js';
import { cues as lurkerCues } from './lurker/cues.js';
import { cues as marketCues } from './market/cues.js';
import { cues as creativeCues } from './creative/cues.js';
import { cues as nightowlCues } from './nightowl/cues.js';
import { cues as newbieCues } from './newbie/cues.js';
import { cues as organizerCues } from './organizer/cues.js';
import { cues as skepticCues } from './skeptic/cues.js';
import { cues as cheerCues } from './cheer/cues.js';
import { cues as gamerCues } from './gamer/cues.js';
import { cues as mentorCues } from './mentor/cues.js';
import { cues as matureCues } from './mature/cues.js';
import { cues as childishCues } from './childish/cues.js';
import { cues as emotionalCues } from './emotional/cues.js';
import { cues as emoji_addictCues } from './emoji_addict/cues.js';
import { cues as clueless_newbieCues } from './clueless_newbie/cues.js';
import { cues as rage_quitterCues } from './rage_quitter/cues.js';
import { cues as lowballer_hustlerCues } from './lowballer_hustler/cues.js';
import { cues as short_texterCues } from './short_texter/cues.js';
import { cues as heavy_texterCues } from './heavy_texter/cues.js';
import { cues as chat_spammerCues } from './chat_spammer/cues.js';
import { cues as scammer_phisherCues } from './scammer_phisher/cues.js';
import { cues as stalker_inspectorCues } from './stalker_inspector/cues.js';
import { cues as flirtyCues } from './flirty/cues.js';
import { cues as professionalCues } from './professional/cues.js';
import { cues as sarcasticCues } from './sarcastic/cues.js';
import { cues as supportiveCues } from './supportive/cues.js';
import { cues as chaoticCues } from './chaotic/cues.js';
import { cues as formalCues } from './formal/cues.js';

export const MESSAGE_BANKS: MessageBankMap = {
  social,
  casual,
  tech,
  drama,
  support,
  attention,
  lurker,
  market,
  creative,
  nightowl,
  newbie,
  organizer,
  skeptic,
  cheer,
  gamer,
  mentor,
  mature,
  childish,
  emotional,
  emoji_addict,
  clueless_newbie,
  rage_quitter,
  lowballer_hustler,
  short_texter,
  heavy_texter,
  chat_spammer,
  scammer_phisher,
  stalker_inspector,
  flirty,
  professional,
  sarcastic,
  supportive,
  chaotic,
  formal,
};

export const CUE_BANKS: CueBankMap = {
  social: socialCues,
  casual: casualCues,
  tech: techCues,
  drama: dramaCues,
  support: supportCues,
  attention: attentionCues,
  lurker: lurkerCues,
  market: marketCues,
  creative: creativeCues,
  nightowl: nightowlCues,
  newbie: newbieCues,
  organizer: organizerCues,
  skeptic: skepticCues,
  cheer: cheerCues,
  gamer: gamerCues,
  mentor: mentorCues,
  mature: matureCues,
  childish: childishCues,
  emotional: emotionalCues,
  emoji_addict: emoji_addictCues,
  clueless_newbie: clueless_newbieCues,
  rage_quitter: rage_quitterCues,
  lowballer_hustler: lowballer_hustlerCues,
  short_texter: short_texterCues,
  heavy_texter: heavy_texterCues,
  chat_spammer: chat_spammerCues,
  scammer_phisher: scammer_phisherCues,
  stalker_inspector: stalker_inspectorCues,
  flirty: flirtyCues,
  professional: professionalCues,
  sarcastic: sarcasticCues,
  supportive: supportiveCues,
  chaotic: chaoticCues,
  formal: formalCues,
};

function pickFrom(bank: readonly string[], avoid: ReadonlySet<string>): string {
  const substantive = (line: string) =>
    !isDeadFiller(line) && line.trim().split(/\s+/).length >= 2;

  let free = bank.filter((line) => !avoid.has(line) && substantive(line));
  if (!free.length) free = bank.filter((line) => !avoid.has(line));
  if (!free.length) free = bank.filter(substantive);
  const pool = free.length ? free : [...bank];
  // Prefer longer lines when available (more conversational)
  const long = pool.filter((l) => l.length >= 18);
  const use = long.length >= 2 ? long : pool;
  return use[Math.floor(Math.random() * use.length)];
}

export function messagesFor(persona: PersonaId): MessageBank {
  return MESSAGE_BANKS[persona];
}

export function cuesFor(persona: PersonaId): CueBank {
  return CUE_BANKS[persona];
}

export function pickMessage(persona: PersonaId, avoid: ReadonlySet<string> = new Set()): string {
  const bank = messagesFor(persona);
  const rich = bank.filter(
    (line) =>
      !avoid.has(line) &&
      (/[?]/.test(line) ||
        /\b(hey|hi|hello|bug|glitch|price|event|help|anyone)\b/i.test(line))
  );
  if (rich.length) return pickFrom(rich, avoid);
  return pickFrom(bank, avoid);
}

export function pickCueReply(
  persona: PersonaId,
  cue: CueId,
  avoid: ReadonlySet<string> = new Set()
): string {
  const cues = cuesFor(persona);
  const primary = cues[cue] || cues.general;
  let text = pickFrom(primary, avoid);
  // If cue bank only yielded a stub, fall back to greeting / hype voice
  if (isDeadFiller(text) || text.trim().split(/\s+/).length < 2) {
    text = pickFrom(cues.greeting.length ? cues.greeting : cues.hype, avoid);
  }
  return text;
}

/** Detect cue from peer line, reply from this persona's cue bank only. */
export function replyToPeer(
  persona: PersonaId,
  lastOther: string,
  avoid: ReadonlySet<string> = new Set()
): { cue: CueId; text: string } {
  const cue = resolveReplyCue(lastOther);
  return { cue, text: pickCueReply(persona, cue, avoid) };
}

/**
 * Conversation pick for a single turn.
 * Empty → opener. Peer line → topic-aware coherent reply (cue lottery is last resort).
 */
export function pickTalkLine(
  persona: PersonaId,
  lastOther: string,
  avoid: ReadonlySet<string> = new Set(),
  opts?: { topic?: string; pairTalks?: number }
): { kind: 'open' | 'cue' | 'reply'; cue?: CueId; text: string; tag?: string } {
  const peer = (lastOther || '').trim();
  if (!peer) {
    return { kind: 'open', text: pickMessage(persona, avoid) };
  }

  const coherent = pickCoherentReply(peer, {
    persona,
    topic: opts?.topic || '',
    avoid,
    pairTalks: opts?.pairTalks ?? 1,
  });
  if (coherent.text && !avoid.has(coherent.text)) {
    return { kind: 'reply', text: coherent.text, tag: coherent.tag };
  }

  // Last resort: persona message bank, still avoid stubs
  const bankLine = pickMessage(persona, avoid);
  if (bankLine && !isDeadFiller(bankLine)) {
    return { kind: 'reply', text: bankLine, tag: 'reply:bank' };
  }

  const cue = resolveReplyCue(peer);
  return { kind: 'cue', cue, text: pickCueReply(persona, cue, avoid) };
}
